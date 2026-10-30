#!/usr/bin/env bash
# Unix-only — Vercel deploys to Linux and macOS covers local dev. Windows
# contributors should run via WSL or point SUBFINDER_BIN at a system install.
# SHA-256 values come from subfinder's published checksums.txt and MUST be
# refreshed alongside VERSION.
set -euo pipefail

VERSION='2.17.0'

log() { echo "[install-subfinder] $*"; }
bail() {
  log "$1"
  if [ -n "${CI:-}${VERCEL:-}" ]; then exit 1; else exit 0; fi
}

case "$(uname -s)_$(uname -m)" in
  Linux_x86_64)  ASSET='linux_amd64';  SHA='a39c3e5c7a26ef3c430915c4d6cbf7716a00f26769a75e9405aba796142eba37' ;;
  Linux_aarch64) ASSET='linux_arm64';  SHA='24913d49dddc1d3a5e99a4a7580da5be980959b9415b96f52c4f7f4124392190' ;;
  Darwin_x86_64) ASSET='macOS_amd64';  SHA='75bf5990b409c6fd1116c81cd64fbdfd2cfd5bfb1f43542035b42344cb9fdffa' ;;
  Darwin_arm64)  ASSET='macOS_arm64';  SHA='012d6ff91ef932ac6d1a321fb5735cf1412168d163e6adbc6cbe5fc42fe03c3b' ;;
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
