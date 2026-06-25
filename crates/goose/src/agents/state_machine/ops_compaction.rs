use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;

use crate::agents::state_machine::operation::{Emitter, Operation, OperationResult, TurnEffect};
use crate::agents::AgentEvent;
use crate::config::Config;
use crate::context_mgmt::{compact_messages, DEFAULT_COMPACTION_THRESHOLD};
use crate::conversation::message::{Message, MessageErrorKind, SystemNotificationType};
use crate::conversation::Conversation;
use crate::providers::base::Provider;
use crate::session::Session;
use goose_providers::model::ModelConfig;

const COMPACTION_THINKING_TEXT: &str = "goose is compacting the conversation...";

/// How many times we'll compact-and-retry after a `ContextLengthExceeded`
/// before giving up and letting `ExitOnError` hand control to the client.
const MAX_CONTEXT_ERROR_RETRIES: usize = 2;

/// Count `ContextLengthExceeded` error messages since the last real user turn —
/// the reactive retry budget.
fn context_error_count(conversation: &Conversation) -> usize {
    let mut count = 0;
    for message in conversation.messages().iter().rev() {
        match message.error_kind() {
            Some(MessageErrorKind::ContextLengthExceeded) => count += 1,
            _ => {
                if message.role == rmcp::model::Role::User && !message.is_tool_response() {
                    break;
                }
            }
        }
    }
    count
}

/// Proactively summarizes the conversation once its token usage crosses the
/// auto-compact threshold, before handing off to the LLM. Replaces the
/// `check_if_compaction_needed` / `compact_messages` block in `Agent::reply`.
///
/// The op does the cheap synchronous ratio check using the session's recorded
/// token total against the model's context limit (both known at construction).
/// When the token total is unknown the op stays out of the way —
/// proactive compaction is best-effort, and the reactive `ContextLengthExceeded`
/// path remains the backstop.
pub struct CompactionOperation {
    provider: Arc<dyn Provider>,
    model_config: ModelConfig,
    context_limit: usize,
    threshold: f64,
    manages_own_context: bool,
}

impl CompactionOperation {
    pub fn new(provider: Arc<dyn Provider>, model_config: ModelConfig) -> Self {
        let context_limit = model_config.context_limit();
        let manages_own_context = provider.manages_own_context();
        let threshold = Config::global()
            .get_param::<f64>("GOOSE_AUTO_COMPACT_THRESHOLD")
            .unwrap_or(DEFAULT_COMPACTION_THRESHOLD);
        Self {
            provider,
            model_config,
            context_limit,
            threshold,
            manages_own_context,
        }
    }

    fn over_threshold(&self, tokens: usize) -> bool {
        if self.threshold <= 0.0 || self.threshold >= 1.0 {
            return false;
        }
        (tokens as f64 / self.context_limit as f64) > self.threshold
    }
}

#[async_trait]
impl Operation for CompactionOperation {
    fn name(&self) -> &'static str {
        "compaction"
    }

    async fn run(&self, session: &Session, emit: Emitter) -> Result<OperationResult> {
        if self.manages_own_context {
            return Ok(OperationResult::NotApplicable(emit));
        }
        let Some(conversation) = session.conversation.as_ref() else {
            return Ok(OperationResult::NotApplicable(emit));
        };

        let reactive_context_error = matches!(
            conversation.last().and_then(|m| m.error_kind()),
            Some(MessageErrorKind::ContextLengthExceeded)
        );

        // Reactive: the LLM op just appended a ContextLengthExceeded error.
        // Compact and retry, up to a cap, before letting ExitOnError take it.
        if reactive_context_error {
            if context_error_count(conversation) > MAX_CONTEXT_ERROR_RETRIES {
                return Ok(OperationResult::NotApplicable(emit));
            }
        } else {
            // Proactive: a pending user turn whose recorded token total is over the
            // threshold. We compact before the doomed LLM call rather than after.
            let last_is_user = conversation
                .last()
                .map(|m| m.role == rmcp::model::Role::User && !m.is_tool_response())
                .unwrap_or(false);
            if !last_is_user {
                return Ok(OperationResult::NotApplicable(emit));
            }
            match session.usage.total_tokens {
                Some(tokens) if tokens > 0 && self.over_threshold(tokens as usize) => {}
                _ => return Ok(OperationResult::NotApplicable(emit)),
            }
        }

        // In the reactive case the conversation ends in an error message that we
        // must not feed into the summary; compact everything before it.
        let trimmed;
        let conversation = if reactive_context_error {
            let mut messages = conversation.messages().to_vec();
            messages.pop();
            trimmed = Conversation::new_unvalidated(messages);
            &trimmed
        } else {
            conversation
        };

        let threshold_percentage = (self.threshold * 100.0) as u32;
        emit.emit(AgentEvent::Message(
            Message::assistant().with_system_notification(
                SystemNotificationType::InlineMessage,
                format!(
                    "Exceeded auto-compact threshold of {threshold_percentage}%. \
                     Performing auto-compaction..."
                ),
            ),
        ))
        .await;
        emit.emit(AgentEvent::Message(
            Message::assistant().with_system_notification(
                SystemNotificationType::ThinkingMessage,
                COMPACTION_THINKING_TEXT,
            ),
        ))
        .await;

        match compact_messages(
            self.provider.as_ref(),
            &self.model_config,
            &session.id,
            conversation,
            false,
        )
        .await
        {
            Ok((compacted, _usage)) => {
                emit.emit(AgentEvent::Message(
                    Message::assistant().with_system_notification(
                        SystemNotificationType::InlineMessage,
                        "Compaction complete",
                    ),
                ))
                .await;
                Ok(OperationResult::Applied(vec![compacted.into()]))
            }
            Err(e) => {
                emit.emit(AgentEvent::Message(Message::assistant().with_text(
                    format!(
                        "Ran into this error trying to compact: {e}.\n\n\
                     Please try again or create a new session"
                    ),
                )))
                .await;
                Ok(OperationResult::Applied(vec![TurnEffect::YieldToClient]))
            }
        }
    }
}
