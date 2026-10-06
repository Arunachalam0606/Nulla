#!/usr/bin/env bash
set -euo pipefail

#
# create-dmg.sh
# Assembles Nulla.app into a distributable, signed macOS DMG installer with drag-to-Applications symlink.
# "0 bytes on your Mac. Terabytes in the cloud."
#

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
DIST_DIR="$ROOT_DIR/dist"
DMG_ROOT="$DIST_DIR/dmg-root"
DMG_OUTPUT="$BUILD_DIR/Nulla.dmg"

echo "=========================================================="
echo " [Nulla] Packaging Production macOS DMG Installer"
echo "=========================================================="

# 1. Build and sign Nulla.app and its FileProvider extension
echo "==> Building and signing Nulla.app..."
bash "$ROOT_DIR/scripts/build-macos-app.sh"

# 2. Stage files for DMG distribution
echo "==> Staging DMG root directory..."
rm -rf "$DMG_ROOT"
mkdir -p "$DMG_ROOT"

echo "==> Copying Nulla.app into staging area..."
cp -R "$BUILD_DIR/Nulla.app" "$DMG_ROOT/Nulla.app"

echo "==> Creating /Applications symlink for drag-and-drop installation..."
ln -s /Applications "$DMG_ROOT/Applications"

# 2b. Apply branded VolumeIcon to DMG
if [ -f "$ROOT_DIR/apps/macos/Resources/Nulla.icns" ]; then
    echo "==> Applying branded icon to DMG installer..."
    cp "$ROOT_DIR/apps/macos/Resources/Nulla.icns" "$DMG_ROOT/.VolumeIcon.icns"
    /usr/bin/SetFile -a C "$DMG_ROOT" 2>/dev/null || true
    /usr/bin/SetFile -a V "$DMG_ROOT/.VolumeIcon.icns" 2>/dev/null || true
fi

# 3. Create UDZO Compressed DMG image
echo "==> Generating compressed DMG image via hdiutil..."
mkdir -p "$BUILD_DIR"
rm -f "$DMG_OUTPUT"

hdiutil create \
  -volname "Nulla" \
  -srcfolder "$DMG_ROOT" \
  -ov \
  -format UDZO \
  "$DMG_OUTPUT"

echo "==> Cleaning up staging directory..."
rm -rf "$DIST_DIR"

echo "==> Checking DMG size and checksum..."
ls -lh "$DMG_OUTPUT"

echo "=========================================================="
echo " [Nulla] DMG Installer Created Successfully!"
echo " Output: $DMG_OUTPUT"
echo "=========================================================="
