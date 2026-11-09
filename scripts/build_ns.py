"""Build web/ns/index.html (NS Cellphone Store POS) from src/NS_Cellphone_Store.html.

Usage: python3 scripts/build_ns.py [path/to/new-export.html]
It adds what makes it an installable, offline website, and swaps BiixiPay Cloud from Supabase to
Firebase (src/ns_cloud_firebase.js). The rest of the app is unchanged.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'src' / 'NS_Cellphone_Store.html'
s = src.read_text(encoding='utf8')

HEAD = '''<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#071126">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="NS Store">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-180.png">
'''
SW = '''<script>if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))</script>
'''

def once(old, new):
    global s
    if s.count(old) != 1:
        sys.exit(f'build_ns: expected one "{old}" in the export, found {s.count(old)}')
    s = s.replace(old, new, 1)

once('</title>\n', '</title>\n' + HEAD)

# BiixiPay Cloud on Firebase instead of Supabase: swap the whole sync section.
A = '/* ================= BIIXIPAY CLOUD SYNC (Supabase) ================= */'
B = '/* ================= START ================= */'
if s.count(A) != 1 or s.count(B) != 1:
    sys.exit('build_ns: could not find the BiixiPay Cloud section in the export')
fb = (ROOT / 'src' / 'ns_cloud_firebase.js').read_text(encoding='utf8')
s = s[:s.index(A)] + fb + s[s.index(B):]
i = s.rfind('</body>')  # the page's own closing tag (an earlier one is inside the print template)
s = s[:i] + SW + s[i:]
out = ROOT / 'web' / 'ns' / 'index.html'
out.write_text(s, encoding='utf8')
print('wrote', out.relative_to(ROOT))
