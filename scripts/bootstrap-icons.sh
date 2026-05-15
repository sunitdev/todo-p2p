#!/usr/bin/env bash
# Bootstrap Tauri icon set if missing. Idempotent.
# Generates a placeholder 1024x1024 PNG via python3 (preinstalled on macOS, common on Linux),
# then runs `tauri icon` to fan out to the platform-specific sizes/formats Tauri needs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON_SOURCE="$REPO_ROOT/apps/desktop/src-tauri/app-icon.png"
ICONS_DIR="$REPO_ROOT/apps/desktop/src-tauri/icons"
SENTINEL="$ICONS_DIR/32x32.png"

if [ -f "$SENTINEL" ]; then
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 required to generate placeholder icon. Install python3 or supply $ICON_SOURCE manually." >&2
  exit 1
fi

if [ ! -f "$ICON_SOURCE" ]; then
  echo "Generating placeholder source icon → $ICON_SOURCE"
  python3 - "$ICON_SOURCE" <<'PY'
import struct, zlib, sys, os

out = sys.argv[1]
W = H = 1024

pixels = bytearray()
for y in range(H):
    row = bytearray([0])
    for x in range(W):
        r = int(60 + 100 * (x / W))
        g = int(80 + 50 * (y / H))
        b = 200
        a = 255
        row += bytes([r, g, b, a])
    pixels += row

def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(pixels)))
png += chunk(b'IEND', b'')

os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'wb') as f:
    f.write(png)
PY
fi

echo "Generating Tauri icon set from $ICON_SOURCE"
cd "$REPO_ROOT" && bun --filter @todo-p2p/desktop tauri icon "$ICON_SOURCE"
