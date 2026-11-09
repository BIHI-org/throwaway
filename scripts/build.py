"""Build web/index.html from the POS exported from claude.ai.

Usage: python3 scripts/build.py [path/to/Mr_Chef_POS.html]
Without an argument it uses src/Mr_Chef_POS.html. Drop a new export there and rerun.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'src' / 'Mr_Chef_POS.html'
s = src.read_text(encoding='utf8')

HEAD = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Mr Chef POS</title>
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#18203A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mr Chef">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="platform.js"></script>
'''

# 1. Replace claude.ai's export wrapper head with the website head (keep its base <style>).
a = s.index('<style>')
b = s.index('</head><body>')
body = s[b + len('</head><body>'):]
for junk in ('<title>Mr Chef POS</title>\n', '<meta name="claude:viewport-fit-sides" content="cover">\n'):
    body = body.replace(junk, '', 1)
out = HEAD + s[a:b] + '</head><body>' + body

# 2. A brand-new Firebase database has no menu: seed the starter menu once.
SEED = ("if(!s.exists&&!s.metadata.fromCache&&!S.menu.length){const c=clone(STARTER);S.settings=c.settings;"
        "S.staff=staffFrom(c);S.menu=c.menu;S.cats=[];saveCfg()} /* brand-new database: seed the starter menu once */")
anchor = 'cfgLoaded=true;ok(s);'
if out.count(anchor) != 1:
    sys.exit('build: could not find the config-loaded line; check the seed patch')
out = out.replace(anchor, anchor + SEED, 1)

(ROOT / 'web' / 'index.html').write_text(out, encoding='utf8')
print('built web/index.html from', src)
