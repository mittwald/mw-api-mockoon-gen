#!/usr/bin/env bash
set -euo pipefail

OPENAPI_URL="${OPENAPI_URL:-https://api.mittwald.de/v2/openapi.json}"

OPENAPI_DIR="${OPENAPI_DIR:-openapi_prepared}"
OVERLAYS_DIR="${OVERLAYS_DIR:-overlays}"
MOCKOON_DIR="${MOCKOON_DIR:-mockoon_envs}"

RAW_SPEC="${OPENAPI_DIR}/openapi.json"
FILTER_OVERLAY="${OVERLAYS_DIR}/filter_deprecated.overlay.json"
FILTERED_SPEC="${OPENAPI_DIR}/openapi.filtered.json"
UNROLL_OVERLAY="${OVERLAYS_DIR}/unroll_recursion.overlay.json"
UNROLLED_SPEC="${OPENAPI_DIR}/openapi.unrolled.json"
INTERNALVERSION_OVERLAY="${OVERLAYS_DIR}/internalversion_example.overlay.json"
EXAMPLED_SPEC="${OPENAPI_DIR}/openapi.exampled.json"
DEREF_SPEC="${OPENAPI_DIR}/openapi.deref.json"
MOCKOON_ENV_RAW="${MOCKOON_DIR}/mockoon_env.json"
MOCKOON_ENV_PATCHED="${MOCKOON_DIR}/mockoon-env-patched.json"

mkdir -p "${OPENAPI_DIR}" "${OVERLAYS_DIR}" "${MOCKOON_DIR}"

echo "1/10 Fetch OpenAPI"
curl --location --fail --silent "${OPENAPI_URL}" > "${RAW_SPEC}"

echo "2/10 Generate filter overlay"
npx tsx ./scripts/generate-filter-overlay.ts \
  --input "${RAW_SPEC}" \
  --output "${FILTER_OVERLAY}"

echo "3/10 Apply filter overlay"
npx bump overlay "${RAW_SPEC}" "${FILTER_OVERLAY}" > "${FILTERED_SPEC}"

echo "4/10 Generate recursion unroll overlay"
npx tsx ./scripts/generate-unroll-overlay.ts \
  --input "${FILTERED_SPEC}" \
  --output "${UNROLL_OVERLAY}" \
  --title "Unroll Recursion Overlay"

echo "5/10 Apply recursion overlay"
npx bump overlay "${FILTERED_SPEC}" "${UNROLL_OVERLAY}" > "${UNROLLED_SPEC}"

echo "6/10 Generate internalversion example overlay"
npx tsx ./scripts/generate-internalversion-example-overlay.ts \
  --input "${UNROLLED_SPEC}" \
  --output "${INTERNALVERSION_OVERLAY}" \
  --title "Add internalversion examples"

echo "7/10 Apply internalversion example overlay"
npx bump overlay "${UNROLLED_SPEC}" "${INTERNALVERSION_OVERLAY}" > "${EXAMPLED_SPEC}"

echo "8/10 Dereference OpenAPI"
npx swagger-cli bundle "${EXAMPLED_SPEC}" --outfile "${DEREF_SPEC}" --dereference

echo "9/10 Import into Mockoon"
npx mockoon-cli import --input "${DEREF_SPEC}" --output "${MOCKOON_ENV_RAW}" --prettify

echo "10/10 Patch Mockoon template quirks"
npx tsx ./scripts/patch-mockoon-env.ts --input "${MOCKOON_ENV_RAW}" --output "${MOCKOON_ENV_PATCHED}"

echo "Done. Generated: ${MOCKOON_ENV_PATCHED}"
echo "Start mock server with:"
echo "npx mockoon-cli start -d ${MOCKOON_ENV_PATCHED}"
