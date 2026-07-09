use anyhow::Result;
use async_trait::async_trait;

use crate::agents::state_machine::operation::{Emitter, Operation, OperationResult, TurnEffect};
use crate::conversation::Conversation;
use crate::session::Session;

/// Terminal catch-all: if the conversation ends in a tagged error message that
/// no earlier operation chose to recover from, hand control back to the client.
/// The error is already persisted (see `error_message`), so the user can read
/// it and send a new message to retry. This op is placed last so recovery ops
/// (e.g. compaction for `ContextLengthExceeded`) get first refusal.
pub struct ExitOnErrorOperation;

#[async_trait]
impl Operation for ExitOnErrorOperation {
    fn name(&self) -> &'static str {
        "exit_on_error"
    }

    async fn run(
        &self,
        _session: &Session,
        conversation: &Conversation,
        emit: Emitter,
    ) -> Result<OperationResult> {
        if conversation.last().and_then(|m| m.error_kind()).is_none() {
            return Ok(OperationResult::NotApplicable(emit));
        }

        Ok(OperationResult::Applied(vec![TurnEffect::YieldToClient]))
    }
}
