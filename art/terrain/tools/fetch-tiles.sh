#!/bin/sh
# fetch a tiles-pro result: fetch-tiles.sh <tile id> <count> <outdir>
id=$1; n=$2; out=$3
mkdir -p "$out"
i=0
while [ $i -lt $n ]; do
  node scripts/pl-fetch.mjs url "https://backblaze.pixellab.ai/file/pixellab-tiles/859e3c7d-c1c3-4eee-9e06-c95bf333277b/$id/tile_$i.png" "$out/$i.png" >/dev/null &
  i=$((i+1))
done
wait
