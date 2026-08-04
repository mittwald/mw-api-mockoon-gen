# mockoon-toolchain-ts

Node/TypeScript-only pipeline to build a working Mockoon environment from raw OpenAPI.

## What it does

**tl;dr:** Starting from original JSON API specs, rework with strict overlay application, avoid patching JSON by hand

1. Downloads OpenAPI JSON.
2. Generates overlay to remove deprecated operations (and optionally non-matching tags).
3. Applies filter overlay using bump-cli.
4. Generates recursion-unroll overlay for self-referencing schemas.
5. Applies unroll overlay.
6. Dereferences the resulting OpenAPI using swagger-cli.
7. Imports into Mockoon.
8. Patches known Mockoon templating quirks in generated response bodies.
   ( check! upstream patches should be in place by now! )

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

## Reusable GitHub workflow template

This repository includes a reusable workflow that mirrors the same 8-step sequence from `build-mockoon-env.sh`:

- `.github/workflows/build-mockoon-env-reusable.yml`

Use it from another repository workflow via `workflow_call`:

```yaml
name: Build Mockoon Env

on:
  workflow_dispatch:

jobs:
  build-mockoon:
    uses: <owner>/<repo>/.github/workflows/build-mockoon-env-reusable.yml@main
    with:
      openapi_url: https://api.mittwald.de/v2/openapi.json
      allowed_tags: Project,Customer
      essential_tags: User
      openapi_dir: openapi_prepared
      overlays_dir: overlays
      mockoon_dir: mockoon_envs
      node_version: "22"
      upload_artifact: true
      artifact_name: mockoon-env-patched
```

Notes:

- The caller repository must contain this toolchain project structure (`scripts/`, `package.json`, overlays/openapi directories, etc.), because the reusable workflow executes the same local commands.
- The workflow output `mockoon_env_patched` contains the relative path to the generated patched environment file.
- By default, generated files are uploaded as an artifact.

## Links!

- [mockoon](https://github.com/mockoon/mockoon)
- [bump-cli](https://github.com/bump-sh/cli)