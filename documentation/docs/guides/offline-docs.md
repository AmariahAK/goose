---
title: Offline / Air-gapped Docs
sidebar_position: 95
sidebar_label: Offline Docs
---

# Offline / Air-gapped Docs

The `goose-doc-guide` skill reads official goose documentation before answering
goose-specific questions. By default it reads from `https://goose-docs.ai`. In
an offline or air-gapped environment, point goose at a **local copy** instead by
setting `GOOSE_DOCS_ROOT`.

- If `GOOSE_DOCS_ROOT` is set (in `config.yaml` or the environment), goose uses
  it as the docs root — either a local filesystem path or an HTTP(S) URL.
- If it is not set, goose falls back to `https://goose-docs.ai`.

When the root is a local path, goose reads the docs with its file tools; no
network access is required.

## Docs layout

A docs root contains a docs map and a `docs/` tree:

```
<docs-root>/
├── goose-docs-map.md
└── docs/
    ├── getting-started/...
    └── guides/...
```

`goose-docs-map.md` is the index the skill searches first; every page it reads
is referenced by a path listed there.

## Building a local docs root

Generate the tree from a goose checkout using the same version as your goose
binary, so the docs match the runtime. For example:

```bash
#!/usr/bin/env bash
set -euo pipefail

GOOSE_VERSION="${1:-v1.41.0}"
DOCS_ROOT="${2:-/opt/goose-docs}"
REPO="${GOOSE_REPO:-$(git rev-parse --show-toplevel)}"

cd "$REPO"
git checkout --quiet "$GOOSE_VERSION"

cd documentation
npm ci
node scripts/generate-docs-map.js

rm -rf "$DOCS_ROOT"
mkdir -p "$DOCS_ROOT/docs"
cp static/goose-docs-map.md "$DOCS_ROOT/goose-docs-map.md"
cp -r docs/getting-started docs/guides "$DOCS_ROOT/docs/"

CONFIG="${GOOSE_CONFIG_PATH:-$HOME/.config/goose/config.yaml}"
mkdir -p "$(dirname "$CONFIG")"
touch "$CONFIG"
sed -i.bak '/^GOOSE_DOCS_ROOT:/d' "$CONFIG" && rm -f "$CONFIG.bak"
echo "GOOSE_DOCS_ROOT: \"$DOCS_ROOT\"" >> "$CONFIG"
```

## Configuring goose

Set `GOOSE_DOCS_ROOT` in `config.yaml`:

```yaml
GOOSE_DOCS_ROOT: "/opt/goose-docs"
```

Or via the environment:

```bash
export GOOSE_DOCS_ROOT=/opt/goose-docs
```

For a managed distribution, bake the docs tree into your image and set
`GOOSE_DOCS_ROOT` in the shipped `config.yaml` or launcher environment.

## Notes

- Documentation links in goose's answers always render as canonical
  `https://goose-docs.ai/...` URLs, even when read locally.
- A custom HTTP(S) mirror also works: set `GOOSE_DOCS_ROOT` to its root URL.
- For MCP extension runtime issues offline, see
  [Airgapped/Offline Environment Issues](/docs/troubleshooting/known-issues#airgappedoffline-environment-issues).
