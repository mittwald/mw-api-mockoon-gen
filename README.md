# mockoon-toolchain-ts

Node/TypeScript-only pipeline to build a working Mockoon environment from raw OpenAPI.

## What it does

1. Downloads OpenAPI JSON.
2. Generates overlay to remove deprecated operations (and optionally non-matching tags).
3. Applies filter overlay using bump-cli.
4. Generates recursion-unroll overlay for self-referencing schemas.
5. Applies unroll overlay.
6. Dereferences the resulting OpenAPI using swagger-cli.
7. Imports into Mockoon.
8. Patches known Mockoon templating quirks in generated response bodies.

## Requirements

- Node.js 20+
- npm
- curl

## Install

```bash
npm install
chmod +x ./build-mockoon-env.sh
```

## Usage

```bash
npm run build:mockoon
```

Optional variables:

- `OPENAPI_URL`: source URL of OpenAPI JSON
- `ALLOWED_TAGS`: comma-separated tags to keep (empty means do not filter by tags)
- `ESSENTIAL_TAGS`: comma-separated tags always kept unless deprecated (default: `User`)
- `OPENAPI_DIR`, `OVERLAYS_DIR`, `MOCKOON_DIR`: output folders

Example:

```bash
ALLOWED_TAGS="Project,Customer" npm run build:mockoon
```

## Start server

```bash
npx mockoon-cli start -d mockoon_envs/mockoon-env-patched.json
```
