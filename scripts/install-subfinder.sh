#!/usr/bin/env bash
# Unix-only — Vercel deploys to Linux and macOS covers local dev. Windows
# contributors should run via WSL or point SUBFINDER_BIN at a system install.
# SHA-256 values come from subfinder's published checksums.txt and MUST be
# refreshed alongside VERSION.
set -euo pipefail

VERSION='2.14.0'

log() { echo "[install-subfinder] $*"; }
bail() {
  log "$1"
  if [ -n "${CI:-}${VERCEL:-}" ]; then exit 1; else exit 0; fi
}

case "$(uname -s)_$(uname -m)" in
  Linux_x86_64)  ASSET='linux_amd64';  SHA='6529294788f56a20ed96a9b70e71f8f3c247f1d6104ba1e2c2e9e58d8a32c6cb' ;;
  Linux_aarch64) ASSET='linux_arm64';  SHA='e3dc19f1e1b1f01840989e5d2501fd59069e3fd6fc2387ca78fbe246ef5e0680' ;;
  Darwin_x86_64) ASSET='macOS_amd64';  SHA='f419cf27f8d04ec7de967e9661767908caf1905636276c6c05916b19027c1959' ;;
  Darwin_arm64)  ASSET='macOS_arm64';  SHA='622a711bf0dfd4aab5b0f6f1f5efe0d6d20fb75734f947a34a7f8ef1348f5435' ;;
  *)
    log "Unsupported platform $(uname -s)/$(uname -m) — skipping (Unix only; set SUBFINDER_BIN to use a system install)"
    exit 0
    ;;
esac

BIN_DIR="$PWD/bin"
BIN_PATH="$BIN_DIR/subfinder"

if [ -x "$BIN_PATH" ] && "$BIN_PATH" -version 2>&1 | grep -q "Current Version: v$VERSION"; then
  log "Already installed at $BIN_PATH (v$VERSION)"
  exit 0
fi

mkdir -p "$BIN_DIR"
WORK_DIR="$(mktemp -d -t subfinder-install.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT
ZIP_PATH="$WORK_DIR/subfinder.zip"
URL="https://github.com/projectdiscovery/subfinder/releases/download/v${VERSION}/subfinder_${VERSION}_${ASSET}.zip"

log "Downloading $URL"
curl -fsSL --max-time 120 -o "$ZIP_PATH" "$URL" || bail "Download failed"

ACTUAL_SHA="$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')"
if [ "$ACTUAL_SHA" != "$SHA" ]; then
  bail "Checksum mismatch for $ASSET: expected $SHA, got $ACTUAL_SHA"
fi
log "Checksum verified (sha256 $ACTUAL_SHA)"

unzip -o -j "$ZIP_PATH" -d "$WORK_DIR" >/dev/null
mv "$WORK_DIR/subfinder" "$BIN_PATH"
chmod 755 "$BIN_PATH"

log "Installed to $BIN_PATH (v$VERSION)"
