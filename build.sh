#!/bin/bash
# ============================================
# SION OS — build.sh
# Builds Sion OS as a Mac .app bundle
# Run: bash build.sh
# ============================================

set -e

echo ""
echo "  ╔══════════════════════════════╗"
echo "  ║   SION OS — Build Script     ║"
echo "  ║   v2.2.0 — Phase 2          ║"
echo "  ╚══════════════════════════════╝"
echo ""

# 1 — Check we're in the right folder
if [ ! -f "package.json" ]; then
  echo "  ✗ Error: Run this from your sion-os folder"
  exit 1
fi

echo "  → Step 1: Generating .icns icon..."

ICONSET="electron/assets/icon.iconset"
ICNS="electron/assets/icon.icns"

# Convert iconset to .icns using Mac's built-in tool
if [ -d "$ICONSET" ]; then
  iconutil -c icns "$ICONSET" -o "$ICNS"
  echo "  ✓ icon.icns created"
else
  echo "  ⚠ No iconset found — using PNG fallback"
fi

# 2 — Install dependencies
echo ""
echo "  → Step 2: Installing dependencies..."
npm install --silent
echo "  ✓ Dependencies ready"

# 3 — Package the app
echo ""
echo "  → Step 3: Packaging Sion OS.app..."
npm run pack
echo "  ✓ Build complete"

# 4 — Find the output
echo ""
APP_PATH=$(find dist -name "Sion OS.app" -maxdepth 3 2>/dev/null | head -1)

if [ -n "$APP_PATH" ]; then
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║   ✓ Sion OS.app built successfully!     ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo ""
  echo "  Location: $APP_PATH"
  echo ""
  echo "  To install:"
  echo "  cp -r \"$APP_PATH\" /Applications/"
  echo ""
  echo "  Or drag Sion OS.app to your Applications folder."
  echo ""
  
  # Open the dist folder in Finder
  open "$(dirname "$APP_PATH")"
else
  echo "  ✗ Build failed — check errors above"
  exit 1
fi
