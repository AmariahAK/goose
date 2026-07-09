# goose-providers OpenAI wasm POC

This is a local browser proof-of-concept that compiles `goose-providers` to wasm,
constructs an `OpenAiProvider`, and makes a live streaming provider call.

## Run

```bash
cd examples/wasm-openai-provider-poc
wasm-pack build --target web
python3 -m http.server 8080
```

Open <http://localhost:8080>, enter an OpenAI API key, choose a connection mode,
and click the button.

## Connection modes

- **Direct to OpenAI** uses `https://api.openai.com` directly from browser wasm.
  This is the simplest path, but may fail if the browser/OpenAI blocks the request
  with CORS.
- **Local CORS proxy** uses `http://localhost:8787`. Start it with:

  ```bash
  node proxy.mjs
  ```

- **Custom base URL** lets you point the demo at another OpenAI-compatible server
  or proxy.

## Notes

This sends the API key from your browser. Use only for local experiments. For a
real application, keep the API key server-side and proxy provider calls through a
backend you control.
