#!/bin/bash
# Emma Dashboard — local launcher
# Runs on port 9000 so the existing Google OAuth client origin matches.
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
echo ""
echo "  ✦ Emma Dashboard"
echo "  Opening in your browser..."
echo ""
echo "  When you're done, come back here and press Ctrl+C to stop."
echo ""
open http://localhost:9000/index.html
python3 -m http.server 9000
