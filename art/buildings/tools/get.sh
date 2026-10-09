#!/bin/sh
# usage: get.sh <dir> <name> <map object id> [...pairs]
export PATH="/c/Users/jacks/tools/node-v22.20.0-win-x64:$PATH"
cd /c/Users/jacks/Documents/sprocket-and-sprout
d=$1; shift
mkdir -p "$d"
while [ $# -ge 2 ]; do
  node scripts/pl-fetch.mjs url "https://api.pixellab.ai/mcp/map-objects/$2/download" "$d/$1.png" >/dev/null && echo "$d/$1.png"
  shift 2
done
