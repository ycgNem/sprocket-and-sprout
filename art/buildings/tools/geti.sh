#!/bin/sh
# usage: geti.sh <file> <image job id>   (edit_image / raw image results)
export PATH="/c/Users/jacks/tools/node-v22.20.0-win-x64:$PATH"
cd /c/Users/jacks/Documents/sprocket-and-sprout
mkdir -p "$(dirname "$1")"
node scripts/pl-fetch.mjs url "https://api.pixellab.ai/mcp/images/$2/download" "$1" >/dev/null && echo "$1"
