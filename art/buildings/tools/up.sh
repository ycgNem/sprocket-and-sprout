#!/bin/sh
# usage: up.sh <upload url> <png>...   -> prints upload refs
U=$1; shift
for f in "$@"; do printf '%s ' "$f"; curl -sS -F "file=@$f" "$U" | sed 's/.*"ref":"\([^"]*\)".*/\1/'; echo; done
