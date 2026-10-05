#!/usr/bin/env bash
set -euo pipefail

#
# build-macos-app.sh
# Compiles, bundles, signs with entitlements, and registers Nulla.app + NullaExtension.appex
# "0 bytes on your Mac. Terabytes in the cloud."
#

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_DIR="$ROOT_DIR/apps/macos"
BUILD_DIR="$ROOT_DIR/build"
ENTITLEMENTS_DIR="$MACOS_DIR/Entitlements"

APP_NAME="Nulla"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_PLUGINS="$APP_CONTENTS/PlugIns"

EXTENSION_NAME="NullaExtension"
EXTENSION_BUNDLE="$APP_PLUGINS/$EXTENSION_NAME.appex"
EXTENSION_CONTENTS="$EXTENSION_BUNDLE/Contents"
EXTENSION_MACOS="$EXTENSION_CONTENTS/MacOS"
EXTENSION_RESOURCES="$EXTENSION_CONTENTS/Resources"

APP_ENTITLEMENTS="$ENTITLEMENTS_DIR/NullaApp.entitlements"
EXTENSION_ENTITLEMENTS="$ENTITLEMENTS_DIR/NullaExtension.entitlements"

echo "=========================================================="
echo " [Nulla] Building Native macOS Client & FileProvider Extension"
echo "=========================================================="

# 1. Create Entitlements files
echo "==> Preparing Entitlements for Sandbox & runtime execution..."
mkdir -p "$ENTITLEMENTS_DIR"

cat << 'EOF' > "$APP_ENTITLEMENTS"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.get-task-allow</key>
    <true/>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.app.nulla.macos</string>
    </array>
</dict>
</plist>
EOF

cat << 'EOF' > "$EXTENSION_ENTITLEMENTS"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.get-task-allow</key>
    <true/>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.app.nulla.macos</string>
    </array>
</dict>
</plist>
EOF

# 2. Compile Swift targets in release mode
echo "==> Compiling Swift targets in release mode..."
cd "$MACOS_DIR"
swift build -c release

PRODUCTS_DIR="$MACOS_DIR/.build/out/Products/Release"
if [ ! -d "$PRODUCTS_DIR" ]; then
    PRODUCTS_DIR="$(swift build -c release --show-bin-path)"
fi

echo "==> Build products located at: $PRODUCTS_DIR"

if [ ! -f "$PRODUCTS_DIR/NullaApp" ]; then
    echo "ERROR: NullaApp binary not found in $PRODUCTS_DIR"
    exit 1
fi

if [ ! -f "$PRODUCTS_DIR/NullaExtension" ]; then
    echo "ERROR: NullaExtension binary not found in $PRODUCTS_DIR"
    exit 1
fi

# 3. Create bundle hierarchy
echo "==> Creating bundle structure..."
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS" "$APP_RESOURCES" "$APP_PLUGINS"
mkdir -p "$EXTENSION_MACOS" "$EXTENSION_RESOURCES"

# 4. Copy binaries
echo "==> Installing binaries..."
cp "$PRODUCTS_DIR/NullaApp" "$APP_MACOS/NullaApp"
chmod +x "$APP_MACOS/NullaApp"

cp "$PRODUCTS_DIR/NullaExtension" "$EXTENSION_MACOS/NullaExtension"
chmod +x "$EXTENSION_MACOS/NullaExtension"

# 5. Generate App Info.plist
echo "==> Generating $APP_NAME Info.plist..."
cat << 'EOF' > "$APP_CONTENTS/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>NullaApp</string>
    <key>CFBundleIdentifier</key>
    <string>app.nulla.macos</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>Nulla</string>
    <key>CFBundleDisplayName</key>
    <string>Nulla</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSFileProviderDomains</key>
    <array>
        <dict>
            <key>NSFileProviderDomainIdentifier</key>
            <string>app.nulla.vault</string>
            <key>NSFileProviderDomainDisplayName</key>
            <string>Nulla</string>
        </dict>
    </array>
</dict>
</plist>
EOF

# 6. Generate Extension Info.plist
echo "==> Generating $EXTENSION_NAME Info.plist..."
cat << 'EOF' > "$EXTENSION_CONTENTS/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>NullaExtension</string>
    <key>CFBundleIdentifier</key>
    <string>app.nulla.macos.extension</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>NullaExtension</string>
    <key>CFBundleDisplayName</key>
    <string>Nulla</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>CFBundleSupportedPlatforms</key>
    <array>
        <string>MacOSX</string>
    </array>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.fileprovider-nonui</string>
        <key>NSExtensionPrincipalClass</key>
        <string>FileProviderExtension</string>
        <key>NSExtensionFileProviderDocumentGroup</key>
        <string>group.app.nulla.macos</string>
    </dict>
</dict>
</plist>
EOF

# 7. Ad-hoc Codesign Bundles with Entitlements
echo "==> Signing Extension bundle with runtime options and entitlements..."
codesign --force --options runtime --entitlements "$EXTENSION_ENTITLEMENTS" --sign - --timestamp=none "$EXTENSION_BUNDLE"

echo "==> Signing Application bundle with runtime options and entitlements..."
codesign --force --options runtime --entitlements "$APP_ENTITLEMENTS" --sign - --timestamp=none "$APP_BUNDLE"

echo "==> Verifying codesign status..."
codesign --verify --deep "$APP_BUNDLE"

# 8. Register extension with macOS PlugInKit
echo "==> Registering extension with PlugInKit..."
pluginkit -a "$EXTENSION_BUNDLE" 2>/dev/null || true

# 9. Copy or link Nulla.app into /Applications so fileproviderd indexes the domain
echo "==> Installing Nulla.app into /Applications..."
rm -rf /Applications/Nulla.app
cp -R "$APP_BUNDLE" /Applications/

echo "==> Registering installed extension with PlugInKit..."
pluginkit -a -v /Applications/Nulla.app/Contents/PlugIns/NullaExtension.appex 2>/dev/null || true

# 10. Register with LaunchServices
if [ -f "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister" ]; then
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Nulla.app 2>/dev/null || true
fi

# 11. Restart running Nulla app instance
echo "==> Refreshing Nulla app instance..."
pkill -f NullaApp 2>/dev/null || true
open /Applications/Nulla.app

echo "=========================================================="
echo " [Nulla] Build & Installation Successful!"
echo " Installed at: /Applications/Nulla.app"
echo " Active Extension: /Applications/Nulla.app/Contents/PlugIns/NullaExtension.appex"
echo "=========================================================="
