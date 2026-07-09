use futures::StreamExt;
use goose_providers::{
    api_client::{ApiClient, AuthMethod},
    base::Provider,
    conversation::message::Message,
    model::ModelConfig,
    openai::OpenAiProvider,
};
use js_sys::Function;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub async fn stream_openai(
    api_key: String,
    base_url: String,
    model: String,
    prompt: String,
    on_chunk: Function,
) -> Result<String, JsValue> {
    let api_client = ApiClient::new_with_tls(base_url, AuthMethod::BearerToken(api_key), None)
        .map_err(to_js_error)?;

    let provider = OpenAiProvider::new(api_client);
    let model = ModelConfig::new(model);
    let messages = [Message::user().with_text(prompt)];

    let mut stream = provider
        .stream(&model, "You are a concise assistant.", &messages, &[])
        .await
        .map_err(to_js_error)?;

    let mut output = String::new();
    while let Some(item) = stream.next().await {
        let (message, _) = item.map_err(to_js_error)?;
        if let Some(message) = message {
            let chunk = message.as_concat_text();
            if !chunk.is_empty() {
                output.push_str(&chunk);
                on_chunk
                    .call1(&JsValue::NULL, &JsValue::from_str(&chunk))
                    .map_err(|error| {
                        JsValue::from_str(&format!("chunk callback failed: {error:?}"))
                    })?;
            }
        }
    }

    Ok(output)
}

fn to_js_error(error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&error.to_string())
}
