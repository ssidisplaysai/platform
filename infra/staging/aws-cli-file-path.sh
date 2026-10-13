#!/usr/bin/env bash

aws_cli_file_path() {
  local path="$1"
  local platform

  platform="$(uname -s 2>/dev/null || true)"
  case "${MSYSTEM:-} $platform" in
    MINGW*|MSYS*|CYGWIN*|*' MINGW'*|*' MSYS'*|*' CYGWIN'*)
      if command -v cygpath >/dev/null 2>&1; then
        cygpath -w "$path"
        return
      fi
      ;;
  esac

  printf '%s\n' "$path"
}

aws_cli_file_uri() {
  printf 'file://%s\n' "$(aws_cli_file_path "$1")"
}
