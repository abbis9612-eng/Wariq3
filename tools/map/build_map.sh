#!/bin/sh
# يبني خريطة العالم كاملة بالترتيب: bash tools/map/build_map.sh <مجلد Natural Earth> <مجلد بلاطات الارتفاع z5>
# البيانات الخام (Natural Earth من raw.githubusercontent.com/nvkelso/natural-earth-vector، والارتفاع من s3.amazonaws.com/elevation-tiles-prod/terrarium/5/x/y.png) مو بالمستودع لأنها كبيرة.
set -e; cd "$(dirname "$0")/../.."
python3 tools/map/regions.py "$1"; python3 tools/map/terrain.py "$1" "$2"; python3 tools/map/seas.py "$1"; python3 tools/map/energy.py
node tests/regions.test.mjs | tail -2
