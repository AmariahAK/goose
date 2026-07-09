# goose-providers OpenAI wasm chat POC

This is a local browser proof-of-concept that compiles `goose-providers` to wasm,
constructs an `OpenAiProvider`, and runs a streaming chat UI.

## Run

```bash
cd examples/wasm-openai-provider-poc
wasm-pack build --target web
python3 -m http.server 8080
```

Open <http://localhost:8080>, enter an OpenAI API key, choose a model, and chat.

## Base URL

The Base URL defaults to direct OpenAI:

```text
https://api.openai.com
```

You can also use any OpenAI-compatible server or proxy as the Base URL.

## Notes

This sends the API key from your browser and keeps it only in page memory. Use
only for local experiments. For a real application, keep API keys server-side.
