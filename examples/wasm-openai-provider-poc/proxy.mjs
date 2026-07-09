import http from "node:http";

const OPENAI_ORIGIN = "https://api.openai.com";
const PORT = Number(process.env.PORT || 8787);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,openai-organization,openai-project",
  "access-control-expose-headers": "*",
};

http
  .createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    try {
      const target = new URL(req.url ?? "/", OPENAI_ORIGIN);
      const headers = new Headers();

      for (const [key, value] of Object.entries(req.headers)) {
        if (!value) continue;

        const lower = key.toLowerCase();
        if (
          lower === "host" ||
          lower === "connection" ||
          lower === "content-length" ||
          lower === "origin" ||
          lower === "referer"
        ) {
          continue;
        }

        headers.set(key, Array.isArray(value) ? value.join(",") : value);
      }

      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body,
      });

      const responseHeaders = {
        ...corsHeaders,
        "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      };

      const transferEncoding = upstream.headers.get("transfer-encoding");
      if (transferEncoding) {
        responseHeaders["transfer-encoding"] = transferEncoding;
      }

      res.writeHead(upstream.status, responseHeaders);

      if (upstream.body) {
        for await (const chunk of upstream.body) {
          res.write(chunk);
        }
      }

      res.end();
    } catch (error) {
      res.writeHead(500, {
        ...corsHeaders,
        "content-type": "text/plain",
      });
      res.end(error?.stack || String(error));
    }
  })
  .listen(PORT, () => {
    console.log(`OpenAI CORS proxy listening on http://localhost:${PORT}`);
    console.log(`Use base URL http://localhost:${PORT} in the wasm demo.`);
  });

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
