#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 4 ]; then
  printf 'Usage: create-postgres-app-secret.sh <name> <description> <username> <database>\n' >&2
  exit 2
fi

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/aws-cli-file-path.sh"

secret_name="$1"
secret_description="$2"
secret_username="$3"
secret_database="$4"
secret_payload_dir=""
secret_payload_file=""

cleanup_secret_payload() {
  local status=$?
  trap - EXIT
  if [ -n "$secret_payload_dir" ]; then
    if ! rm -f -- "$secret_payload_file" || ! rmdir -- "$secret_payload_dir"; then
      printf 'Unable to remove temporary staging PostgreSQL secret payload\n' >&2
      status=1
    fi
  fi
  exit "$status"
}
trap cleanup_secret_payload EXIT

secret_payload_dir="$(mktemp -d "${TMPDIR:-/tmp}/genesis-staging-postgres-secret.XXXXXX")" ||
  { printf 'Unable to create temporary staging PostgreSQL secret directory\n' >&2; exit 1; }
chmod 700 "$secret_payload_dir" ||
  { printf 'Unable to secure temporary staging PostgreSQL secret directory\n' >&2; exit 1; }
secret_payload_file="$secret_payload_dir/secret.json"

repo_root="$(cd "$SCRIPT_DIR/../.." && pwd)"
case "$secret_payload_dir" in
  "$repo_root"|"$repo_root"/*)
    printf 'Temporary staging PostgreSQL secret directory must be outside the repository\n' >&2
    exit 1
    ;;
esac

node "$SCRIPT_DIR/create-postgres-app-secret-payload.mjs" \
  "$secret_payload_file" "$secret_username" "$secret_database" ||
  { printf 'Unable to create temporary staging PostgreSQL secret payload\n' >&2; exit 1; }

aws secretsmanager create-secret \
  --name "$secret_name" \
  --description "$secret_description" \
  --secret-string "$(aws_cli_file_uri "$secret_payload_file")" \
  --tags Key=Environment,Value=staging >/dev/null ||
  { printf 'AWS Secrets Manager could not create the staging PostgreSQL application secret\n' >&2; exit 1; }

rm -f -- "$secret_payload_file" ||
  { printf 'Unable to remove temporary staging PostgreSQL secret payload\n' >&2; exit 1; }
rmdir -- "$secret_payload_dir" ||
  { printf 'Unable to remove temporary staging PostgreSQL secret directory\n' >&2; exit 1; }
secret_payload_dir=""
