use futures::StreamExt;
use goose_providers::{
    api_client::{ApiClient, AuthMethod},
    base::Provider,
    conversation::message::Message,
    model::ModelConfig,
    openai::OpenAiProvider,
};
use js_sys::{Array, Function, Reflect};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub async fn stream_openai_chat(
    api_key: String,
    base_url: String,
    model: String,
    messages: JsValue,
    on_chunk: Function,
) -> Result<String, JsValue> {
    let api_client = ApiClient::new_with_tls(base_url, AuthMethod::BearerToken(api_key), None)
        .map_err(to_js_error)?;

    let provider = OpenAiProvider::new(api_client);
    let model = ModelConfig::new(model);
    let messages = parse_messages(messages)?;

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

fn parse_messages(value: JsValue) -> Result<Vec<Message>, JsValue> {
    if !Array::is_array(&value) {
        return Err(JsValue::from_str("messages must be an array"));
    }

    let messages = Array::from(&value);
    let mut parsed = Vec::with_capacity(messages.length() as usize);

    for message in messages.iter() {
        let role = get_string_property(&message, "role")?;
        let content = get_string_property(&message, "content")?;
        let message = match role.as_str() {
            "user" => Message::user().with_text(content),
            "assistant" => Message::assistant().with_text(content),
            other => return Err(JsValue::from_str(&format!("unsupported role: {other}"))),
        };
        parsed.push(message);
    }

    Ok(parsed)
}

fn get_string_property(value: &JsValue, property: &str) -> Result<String, JsValue> {
    Reflect::get(value, &JsValue::from_str(property))?
        .as_string()
        .ok_or_else(|| JsValue::from_str(&format!("message.{property} must be a string")))
}

fn to_js_error(error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&error.to_string())
}
