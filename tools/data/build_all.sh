#!/bin/sh
# يبني كل بيانات «العالم» من الخام + التصحيح: bash tools/data/build_all.sh
set -e; cd "$(dirname "$0")/../.."
python3 -I tools/data/build_lists.py; python3 -I tools/data/build_leaders.py; python3 -I tools/data/build_rel.py
for c in $(python3 -c "import json;print(' '.join(c['id'] for c in json.load(open('data/world/countries.json'))))"); do python3 -I tools/data/build_country.py $c > /dev/null; done
node tests/data.test.mjs | tail -3
