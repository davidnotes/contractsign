#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT_NAME:-contractsign}"
BRANCH_NAME="${CLOUDFLARE_PAGES_BRANCH:-}"
DIST_DIR="${CLOUDFLARE_PAGES_DIST_DIR:-dist}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to build and deploy this project." >&2
  exit 1
fi

echo "Building ${PROJECT_NAME}..."
npm run build

if [ ! -d "${DIST_DIR}" ]; then
  echo "Build output directory '${DIST_DIR}' was not found." >&2
  exit 1
fi

echo "Deploying ${DIST_DIR} to Cloudflare Pages project '${PROJECT_NAME}'..."
deploy_args=(
  "pages"
  "deploy"
  "${DIST_DIR}"
  "--project-name=${PROJECT_NAME}"
)

if [ -n "${BRANCH_NAME}" ]; then
  deploy_args+=("--branch=${BRANCH_NAME}")
fi

npx wrangler "${deploy_args[@]}"
