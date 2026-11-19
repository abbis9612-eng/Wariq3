#!/bin/bash
# يسحب صفحات pages.json كلها بهدوء (ثانيتين بين صفحة وصفحة) — node/python بس
cd "$(dirname "$0")/../.."
python3 -I - <<'P'
import json, subprocess, time, os
pages = json.load(open('tools/data/pages.json'))
for cid, d in pages.items():
    for kind, title in d.items():
        out = f'data/raw/wiki/{cid}_{kind}.json'
        if os.path.exists(out): continue
        r = subprocess.run(['python3', '-I', 'tools/data/wiki_tables.py', title, out], capture_output=True, text=True)
        print(cid, kind, (r.stdout or r.stderr).strip()[:160], flush=True)
        time.sleep(2)
P
