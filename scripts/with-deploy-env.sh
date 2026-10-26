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

exec "$@"
