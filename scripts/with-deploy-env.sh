#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
credentials="$root/infra/envs/dev/deploy.env"

if [[ -f "$credentials" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$credentials"
  set +a
fi

# Cloudflare tooling reads its credentials from the environment. Export the
# deploy file's values for Tofu and wrangler.
if [[ -n "${TF_VAR_cloudflare_api_token:-}" && -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  export CLOUDFLARE_API_TOKEN="$TF_VAR_cloudflare_api_token"
fi

if [[ -n "${TF_VAR_account_id:-}" && -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  export CLOUDFLARE_ACCOUNT_ID="$TF_VAR_account_id"
fi

exec "$@"
