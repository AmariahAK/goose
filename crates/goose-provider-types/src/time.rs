#[cfg(not(target_arch = "wasm32"))]
pub fn timestamp() -> i64 {
    chrono::Utc::now().timestamp()
}

#[cfg(target_arch = "wasm32")]
pub fn timestamp() -> i64 {
    (js_sys::Date::now() / 1000.0) as i64
}
