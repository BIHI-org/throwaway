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
<meta name="apple-mobile-web-app-title" content="Bismillah">
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

def patch(old, new, what):
    global out
    if out.count(old) != 1:
        sys.exit(f'build: could not apply "{what}" (found {out.count(old)} matches); check the patch')
    out = out.replace(old, new, 1)

# 3. Bismillah Restaurant: their name and menu (data/bismillah-menu.json).
import json
shop = json.loads((ROOT / 'data' / 'bismillah-menu.json').read_text(encoding='utf8'))
name = shop['settings']['name']
out = out.replace('<title>Mr Chef POS</title>', '<title>Bismillah POS</title>', 1)
out = out.replace("'Mr Chef'", json.dumps(name).replace('"', "'"))   # defaults and fallbacks in code
out = out.replace('Mr Chef', 'Bismillah')                           # on-screen text, in every language
a = out.index('const STARTER={')
b = out.index('.map(([cat,name,price],i)=>', a)
starter = ("const STARTER={settings:" + json.dumps(shop['settings']) + ",waiters:['Waiter 1','Waiter 2'],cats:"
           + json.dumps(shop['cats']) + ",menu:[" + ','.join(json.dumps(x) for x in shop['menu']) + "]")
out = out[:a] + starter + out[b:]
patch("S.menu=c.menu;S.cats=[];saveCfg()}", "S.menu=c.menu;S.cats=c.cats||[];saveCfg()}", 'seed with categories in menu order')

# 4. Market-price dishes: a dish priced 0 asks for the price when it is added.
patch("if(d.add){const m=S.menu.find(x=>x.id===d.add);if(!m||m.out)return;",
      "if(d.add){let m=S.menu.find(x=>x.id===d.add);if(!m||m.out)return;"
      "if(!(m.price>0)){const v=prompt(m.name+' is market price. Enter the price:','');const p=Math.round(parseFloat(String(v||'').replace(/[^0-9.]/g,''))*100)/100;"
      "if(!(p>0))return;m={...m,price:p,side:false};return addItem(m)}",
      'ask the price for market-price dishes')
patch("const ex=o.lines.find(l=>l.mid===m.id&&!l.sent", "const ex=o.lines.find(l=>l.mid===m.id&&l.price===m.price&&!l.sent",
      'keep market-price lines with different prices apart')
patch('<span class="p num">${fmt(m.price)}</span>', '<span class="p num">${m.price>0?fmt(m.price):\'Market price\'}</span>',
      'show "Market price" on the button')

# 5. Delete a sale entirely (for test orders). Refund keeps the sale on record; this removes it from
#    every total. Admin only: two taps, then an admin's PIN every time. With no admin PIN set, it is refused.
patch("    ${s.refunded?`<div class=\"warnbox\">Refunded",
      "    <button class=\"btn sec\" style=\"color:var(--danger)\" data-delsale=\"${s.id}\">${confirmKey==='delsale'+s.id?'Tap again, then enter an admin PIN':'Delete sale (admin PIN)'}</button>\n"
      "    ${s.refunded?`<div class=\"warnbox\">Refunded",
      'delete-sale button on the receipt')
patch("  if(d.closeday!==undefined)",
      "  if(d.delsale){const s=S.sales.find(x=>x.id===d.delsale);if(!s)return;\n"
      "    if(confirmKey!=='delsale'+s.id){confirmKey='delsale'+s.id;return openReceipt(s,false)}\n"
      "    confirmKey=null;const ad=S.staff.filter(x=>x.role==='admin'&&x.pin);openReceipt(s,false);\n"
      "    if(!ad.length)return toast('Only an admin can delete sales. Give an admin a PIN in Settings first.');\n"
      "    return openPin({approval:true,title:'Admin PIN',sub:'Admin PIN to delete sale'+(s.no?' #'+s.no:''),pool:ad,onOk:()=>{S.sales=S.sales.filter(x=>x.id!==s.id);put('sales/'+s.id,null);"
      "if(s.no){const rx='Receipt #'+s.no,mine=e=>e.type==='refund'&&e.detail===rx;"
      "S.log.filter(mine).forEach(e=>{if(mode==='live')put('log/'+e.id,null)});S.log=S.log.filter(e=>!mine(e));if(mode!=='live')saveLocal()}"
      "closeLayer();render();toast('Sale '+(s.no?'#'+s.no+' ':'')+'deleted')}})}\n"
      "  if(d.closeday!==undefined)",
      'delete-sale action')

# 6. No owner-password login on the website: the ★ Owner button never shows.
patch("isOwnerAcct=await u.isOwner();if(!isOwnerAcct)return;", "isOwnerAcct=false;return;",
      'turn off the owner-password login')

(ROOT / 'web' / 'index.html').write_text(out, encoding='utf8')
print('built web/index.html from', src)
