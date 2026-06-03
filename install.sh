#!/bin/bash
# ============================================
# SION OS — install.sh
# Installs Sion OS to /Applications
# Run after build.sh: bash install.sh
# ============================================

APP_PATH=$(find dist -name "Sion OS.app" -maxdepth 3 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
  echo "  ✗ Sion OS.app not found. Run build.sh first."
  exit 1
fi

echo ""
echo "  → Installing Sion OS to /Applications..."

# Remove old version if exists
if [ -d "/Applications/Sion OS.app" ]; then
  rm -rf "/Applications/Sion OS.app"
  echo "  → Removed old version"
fi

cp -r "$APP_PATH" /Applications/
echo "  ✓ Sion OS installed to /Applications"
echo ""
echo "  Launch from Spotlight: Cmd+Space → 'Sion OS'"
echo "  Or open /Applications/Sion OS.app"
echo ""

# Open Applications folder
open /Applications
