use std::collections::HashMap;

use serde_json::Value;

use crate::thinking::ThinkingEffort;

const DEFAULT_MAX_OUTPUT_TOKENS: i32 = 8192;

#[derive(Default)]
pub struct ModelConfigParams<'a> {
    pub model_name: &'a str,
    pub thinking_effort: Option<ThinkingEffort>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<i32>,
    pub request_params: Option<&'a HashMap<String, Value>>,
}

impl ModelConfigParams<'_> {
    pub fn max_output_tokens(&'_ self) -> i32 {
        self.max_tokens.unwrap_or(DEFAULT_MAX_OUTPUT_TOKENS)
    }
}
