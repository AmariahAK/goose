# Goose ACP Client Install Scenarios

This is a working note for the SDK README and release docs. It describes how
users should think about installing `@aaif/goose-sdk` and connecting to Goose
ACP.

## Scenario 1: Local stdio with npm-installed Goose binary

Use this when a Node app wants to start Goose locally.

Install:

```bash
npm install @aaif/goose-sdk
```

This installs:

- `@aaif/goose-sdk`, the TypeScript ACP client.
- The matching `@aaif/goose-binary-*` package for the user's platform, installed
  as an optional dependency.

Connection model:

```text
Node app
  <-> goose acp child process
  <-> stdin/stdout
```

The app starts Goose with `spawn`. This is a stdio connection, not HTTP.

```ts
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { PROTOCOL_VERSION, ndJsonStream } from "@agentclientprotocol/sdk";
import { GooseClient } from "@aaif/goose-sdk";
import { resolveGooseBinary } from "@aaif/goose-sdk/node";

const goose = spawn(resolveGooseBinary(), ["acp"], {
  stdio: ["pipe", "pipe", "inherit"],
});

const stream = ndJsonStream(
  Writable.toWeb(goose.stdin),
  Readable.toWeb(goose.stdout),
);

const client = new GooseClient(
  () => ({
    requestPermission: async () => ({
      outcome: { outcome: "cancelled" },
    }),
    sessionUpdate: async () => {},
  }),
  stream,
);

await client.initialize({
  protocolVersion: PROTOCOL_VERSION,
  clientInfo: { name: "my-app", version: "0.1.0" },
  clientCapabilities: {},
});
```

Important doc wording:

- `resolveGooseBinary()` finds the npm-installed Goose binary.
- Run the user's Node app the way their project normally runs it. The important
  part is that the app calls `resolveGooseBinary()` before spawning `goose acp`.
- The app still owns process startup and shutdown.
- The SDK does not currently hide the `spawn` step.

## Scenario 2: Local stdio with user-managed Goose binary

Use this when the user already has Goose installed and does not want npm to
install a binary.

Install only the client:

```bash
npm install @aaif/goose-sdk --omit=optional
```

This skips downloading the `@aaif/goose-binary-*` optional packages. The user
must already have a Goose executable somewhere on their machine.

Run the user's Node app with a custom Goose binary path:

```bash
GOOSE_BINARY=/path/to/goose node index.js
```

Replace `node index.js` with the command that starts the user's app.

The app code is the same as Scenario 1 if it calls `resolveGooseBinary()`. In
this path, `resolveGooseBinary()` returns `GOOSE_BINARY` instead of looking for
an npm-installed binary package.

Connection model:

```text
Node app
  <-> user-provided goose acp child process
  <-> stdin/stdout
```

Important doc wording:

- Set `GOOSE_BINARY` only when not using the npm-installed binary.
- `GOOSE_BINARY` must point to a `goose` executable.
- `GOOSE_BINARY` does not install Goose; it only tells the SDK where an existing
  Goose executable lives.
- The custom Goose binary should generally match the SDK version.

## Scenario 3: Existing Goose ACP HTTP server

Use this when Goose ACP is already running somewhere else and the app only needs
to connect to it.

Install only the client:

```bash
npm install @aaif/goose-sdk --omit=optional
```

Create the client with the server base URL:

```ts
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { GooseClient } from "@aaif/goose-sdk";

const client = new GooseClient(
  () => ({
    requestPermission: async () => ({
      outcome: { outcome: "cancelled" },
    }),
    sessionUpdate: async () => {},
  }),
  "http://localhost:3000",
);

await client.initialize({
  protocolVersion: PROTOCOL_VERSION,
  clientInfo: { name: "my-app", version: "0.1.0" },
  clientCapabilities: {},
});
```

Connection model:

```text
Node app
  <-> existing Goose ACP HTTP server
```

Important doc wording:

- No local Goose binary is required for this path.
- `resolveGooseBinary()` is not needed.
- Pass the server base URL. The SDK HTTP transport adds `/acp`.

## Scenario 4: App-started Goose ACP HTTP server

Use this when a Node app wants to start Goose locally, but connect over HTTP
instead of stdio.

Install with the bundled binary:

```bash
npm install @aaif/goose-sdk
```

Start `goose serve` from the app:

```ts
import { spawn } from "node:child_process";
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { GooseClient } from "@aaif/goose-sdk";
import { resolveGooseBinary } from "@aaif/goose-sdk/node";

const goose = spawn(resolveGooseBinary(), [
  "serve",
  "--host",
  "127.0.0.1",
  "--port",
  "3284",
]);

const client = new GooseClient(
  () => ({
    requestPermission: async () => ({
      outcome: { outcome: "cancelled" },
    }),
    sessionUpdate: async () => {},
  }),
  "http://127.0.0.1:3284",
);

await client.initialize({
  protocolVersion: PROTOCOL_VERSION,
  clientInfo: { name: "my-app", version: "0.1.0" },
  clientCapabilities: {},
});
```

Connection model:

```text
Node app
  -> starts goose serve
  <-> Goose ACP HTTP server
```

Important doc wording:

- `resolveGooseBinary()` can find the npm-installed Goose binary for starting
  `goose serve`.
- This is HTTP, not stdio.
- The app must choose a port, wait for server readiness, handle failures, and
  shut down the process.
- This path is more operationally complicated than local stdio.
- Do not recommend this as the easiest local path unless we add a helper that
  handles the server lifecycle.

## Public SDK Transport Scope

For the npm package docs, focus on these public paths:

- Local stdio: the app starts `goose acp` and creates a `GooseClient` over the
  stdio transport.
- Existing HTTP server: the app creates `GooseClient` with a server URL.

WebSocket transport exists in Goose's ACP server and is used by Goose Desktop,
but it is not currently exposed as a public SDK helper.

Do not advertise WebSocket as a supported npm SDK path until we export and test
a public WebSocket transport.

## Later Ergonomics Improvement

Docs are necessary, but the current stdio setup is still a lot for a new user:

```text
resolve binary -> spawn -> convert stdio to stream -> create GooseClient -> initialize
```

The SDK could later add a small Node helper that hides this setup:

```ts
const { client, close } = await createGooseClient({
  clientInfo: { name: "my-app", version: "0.1.0" },
});
```

Recommended follow-up API shape:

```ts
import { createGooseStdioClient } from "@aaif/goose-sdk/node";

const { client, close } = await createGooseStdioClient({
  clientInfo: { name: "my-app", version: "0.1.0" },
  callbacks,
});
```

Internally, this helper would:

- call `resolveGooseBinary()`
- spawn `goose acp`
- wire stdin/stdout to the ACP stream
- create `GooseClient`
- initialize the client
- expose `close()` for cleanup

Do not add an HTTP server-start helper yet. Starting `goose serve` from a
library means choosing ports, waiting for readiness, handling auth/token, and
cleaning up the server process. That needs more design.

For this release-coupling work, keep the scope to good docs, version coupling,
and binary resolution. Treat `createGooseStdioClient()` as a follow-up SDK
ergonomics improvement.
