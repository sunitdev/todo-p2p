#!/usr/bin/env bash
#
# Build the browser iroh transport (packages/iroh-wasm) into a wasm-bindgen
# package (pkg/) consumed by apps/web. See `make wasm-deps` for prerequisites.
#
# Usage: scripts/build-wasm.sh [release|dev]   (default: release)
set -euo pipefail

CRATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../packages/iroh-wasm" && pwd)"
PROFILE="${1:-release}"

# getrandom 0.3 requires the wasm backend to be selected explicitly.
export RUSTFLAGS="${RUSTFLAGS:-} --cfg getrandom_backend=\"wasm_js\""

# ring's C crypto must cross-compile to wasm32. Apple's system clang lacks the
# WebAssembly target, so point at Homebrew LLVM when present. On Linux the
# distro clang typically targets wasm32 already, so leave CC unset there.
if [ -z "${CC_wasm32_unknown_unknown:-}" ]; then
  for llvm in /opt/homebrew/opt/llvm /usr/local/opt/llvm; do
    if [ -x "$llvm/bin/clang" ] && "$llvm/bin/clang" --print-targets 2>/dev/null | grep -qi wasm32; then
      export CC_wasm32_unknown_unknown="$llvm/bin/clang"
      export AR_wasm32_unknown_unknown="$llvm/bin/llvm-ar"
      break
    fi
  done
fi

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "[build-wasm] wasm-pack not found. Run 'make wasm-deps'." >&2
  exit 1
fi

FLAG="--release"
[ "$PROFILE" = "dev" ] && FLAG="--dev"

echo "[build-wasm] profile=$PROFILE cc=${CC_wasm32_unknown_unknown:-<system clang>}"
cd "$CRATE_DIR"
wasm-pack build "$FLAG" --target web --out-dir pkg
echo "[build-wasm] done -> $CRATE_DIR/pkg"
