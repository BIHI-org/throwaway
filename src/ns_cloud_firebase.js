/* ================= BIIXIPAY CLOUD SYNC (Firebase) ================= */
/* Replaces the Supabase sync in the claude.ai export (scripts/build_ns.py swaps it in).
   Same screens and the same sync logic; data lives in Firebase Firestore, project mrchef-b8507:
     nsStores/{store}                 name, memberIds, roles {uid: owner|staff}, emails, invites [email]
     nsStores/{store}/records/{kind:id}  kind, id, json (the record as text), deleted, updatedAt (server time)
   Who can see what is enforced by firestore.rules (only members of a store). */
const CKEY='ns_cloud_fb_v1',HKEY='ns_cloud_fb_hash_v1';
const FB_VER='10.12.2',FB_JS=n=>'https://www.gstatic.com/firebasejs/'+FB_VER+'/firebase-'+n+'-compat.js';
const FB_CFG={apiKey:"AIzaSyDlmI4QciY20gcjIZ6mt_lJ2tiISGPRMi8",authDomain:"mrchef-b8507.firebaseapp.com",projectId:"mrchef-b8507",
 storageBucket:"mrchef-b8507.firebasestorage.app",messagingSenderId:"984219635381",appId:"1:984219635381:web:e13e1a22a79071b73238fc"};
const COLS=['products','units','customers','sales','repairs','buys','pos','closes','counts','log'];
let CL={cfg:{},app:null,auth:null,fs:null,user:null,status:'off',msg:'',hash:{},since:null,timer:null,busy:false,again:false,stores:null,invites:null,team:null,loading:false};
try{CL.cfg=JSON.parse(localStorage.getItem(CKEY)||'{}')}catch(e){}
try{const h=JSON.parse(localStorage.getItem(HKEY)||'{}');CL.hash=h.hash||{};CL.since=h.since||null}catch(e){}
function cSave(){try{localStorage.setItem(CKEY,JSON.stringify(CL.cfg));localStorage.setItem(HKEY,JSON.stringify({hash:CL.hash,since:CL.since}))}catch(e){}}
function hsh(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(h2>>>0).toString(36)+(h1>>>0).toString(36)}
const CST={off:'Not set up',sync:'Syncing…',ok:'✓ Synced',offline:'✗ Offline — will sync when back online',error:'⚠ Sync problem',login:'Sign in needed'};
function cloudInfoHTML(){return `<div class="card"><b>Status:</b> <span class="${CL.status==='ok'?'ok':CL.status==='sync'||CL.status==='off'?'muted':'warnc'}">${CST[CL.status]||CL.status}</span> <span class="muted small">${esc(CL.msg)}</span></div>`}
function setCloud(st,msg=''){CL.status=st;CL.msg=msg;const e=$('cloudSt');
 if(e){e.textContent={sync:'☁ …',ok:'☁ ✓',offline:'☁ ✗',error:'☁ !',login:'☁ ?'}[st]||'';e.title=(CST[st]||'')+' '+msg;e.style.display=st==='off'?'none':'';e.style.color=st==='ok'?'#4ade80':st==='sync'?'#9fb0d6':'#f59e0b'}
 const ci=$('cloudInfo');if(ci)ci.innerHTML=cloudInfoHTML()}
function loadJS(src){return new Promise((res,rej)=>{const sc=document.createElement('script');sc.src=src;sc.onload=res;sc.onerror=()=>rej(new Error('Could not load Firebase (no internet?)'));document.head.appendChild(sc)})}
async function loadFB(){if(!window.firebase)await loadJS(FB_JS('app'));if(!firebase.auth)await loadJS(FB_JS('auth'));if(!firebase.firestore)await loadJS(FB_JS('firestore'))}
const FV=()=>firebase.firestore.FieldValue;
const STORES=()=>CL.fs.collection('nsStores');
const RC=()=>STORES().doc(CL.cfg.storeId).collection('records');
async function cEnsure(){if(CL.fs)return;await loadFB();
 // Its own named app, so this sign-in never mixes with the Bismillah POS on the same site.
 const app=firebase.apps.find(a=>a.name==='ns-store')||firebase.initializeApp(FB_CFG,'ns-store');
 const auth=app.auth();await new Promise(r=>{const off=auth.onAuthStateChanged(u=>{CL.user=u;off();r()})});
 auth.onAuthStateChanged(u=>{CL.user=u});CL.app=app;CL.auth=auth;CL.fs=app.firestore()}
function fbMsg(e){const c=(e&&e.code)||'';return({'auth/invalid-credential':'Wrong email or password','auth/wrong-password':'Wrong email or password','auth/user-not-found':'No account with that email — tap Create account',
 'auth/invalid-login-credentials':'Wrong email or password','auth/email-already-in-use':'That email already has an account — tap Sign in','auth/weak-password':'Password must be at least 6 characters',
 'auth/invalid-email':'That email address is not valid','auth/too-many-requests':'Too many tries — wait a few minutes','auth/network-request-failed':'No internet connection',
 'auth/operation-not-allowed':'Email sign-in is not turned on in Firebase yet (Authentication → Sign-in method → Email/Password)',
 'permission-denied':'No access — check the Firestore rules are published and you are a member of this store'})[c]||(e&&e.message)||String(e)}
async function cInit(){if(!CL.cfg.on){setCloud('off');return}
 try{await cEnsure();if(!CL.user)return setCloud('login','Sign in to BiixiPay Cloud');if(CL.cfg.storeId)cStart();else setCloud('login','Choose a store')}
 catch(e){setCloud('offline',fbMsg(e))}}
async function cOpen(){if(CL.fs||CL.loading)return;CL.loading=true;CL.cfg.on=true;cSave();await cInit();CL.loading=false;if(V==='menu'&&SUB==='cloud')render()}
function cloudOn(){return !!(CL.fs&&CL.user&&CL.cfg.storeId)}
function cStart(){clearInterval(CL.timer);CL.timer=setInterval(()=>{if(!document.hidden)cSync()},20000);cSync()}
let cDeb=null;function cDirty(){if(!cloudOn())return;clearTimeout(cDeb);cDeb=setTimeout(cSync,1500)}
function metaRec(){const{lang,...st}=D.settings;return{settings:st,seq:D.seq,sample:!!D.sample}}
function localRecs(){const out={};let fixed=false;
 for(const k of COLS){(D[k]=D[k]||[]).forEach(r=>{if(!r.id){r.id=uid();fixed=true}out[k+':'+r.id]={kind:k,id:r.id,data:r}})}
 out['meta:main']={kind:'meta',id:'main',data:metaRec()};if(fixed)saveLocal();return out}
async function cPush(){const cur=localRecs();const rows=[],newH={};
 for(const[key,r]of Object.entries(cur)){const h=hsh(JSON.stringify(r.data));if(CL.hash[key]!==h){rows.push({key,kind:r.kind,id:r.id,json:JSON.stringify(r.data),deleted:false});newH[key]=h}}
 for(const key of Object.keys(CL.hash))if(!cur[key]){const i=key.indexOf(':');rows.push({key,kind:key.slice(0,i),id:key.slice(i+1),json:'{}',deleted:true});newH[key]=null}
 for(let i=0;i<rows.length;i+=400){const part=rows.slice(i,i+400);const b=CL.fs.batch();
  part.forEach(r=>b.set(RC().doc(r.key),{kind:r.kind,id:r.id,json:r.json,deleted:r.deleted,updatedAt:FV().serverTimestamp()}));await b.commit();
  part.forEach(r=>{if(newH[r.key]===null)delete CL.hash[r.key];else CL.hash[r.key]=newH[r.key]})}
 cSave();return rows.length}
const docRow=d=>{const x=d.data();let data={};try{data=JSON.parse(x.json||'{}')}catch(e){}return{kind:x.kind,id:x.id,data,deleted:!!x.deleted,ts:x.updatedAt?x.updatedAt.toMillis():0}};
function applyRow(row){const key=row.kind+':'+row.id;
 if(row.kind==='meta'){const m=row.data||{};const dirty=CL.hash[key]&&CL.hash[key]!==hsh(JSON.stringify(metaRec()));
  if(!dirty&&m.settings)D.settings=Object.assign(blank().settings,m.settings,{lang:D.settings.lang});
  const seq=Object.assign({},D.seq);for(const k in(m.seq||{}))seq[k]=Math.max(seq[k]||0,m.seq[k]);D.seq=seq;if(!m.sample)delete D.sample;
  CL.hash[key]=hsh(JSON.stringify(m));return true}
 const arr=D[row.kind];if(!Array.isArray(arr))return false;const i=arr.findIndex(x=>x.id===row.id);
 if(i>=0&&CL.hash[key]&&hsh(JSON.stringify(arr[i]))!==CL.hash[key])return false; // local edit not uploaded yet — keep it
 if(row.deleted){delete CL.hash[key];if(i>=0){arr.splice(i,1);return true}return false}
 const h=hsh(JSON.stringify(row.data));CL.hash[key]=h;if(i>=0&&hsh(JSON.stringify(arr[i]))===h)return false;
 if(i>=0)arr[i]=row.data;else arr.push(row.data);return true}
async function cPull(){const since=CL.since?CL.since-15000:0;let maxTs=CL.since,changed=0,last=null;
 while(true){let q=RC().where('updatedAt','>',firebase.firestore.Timestamp.fromMillis(since)).orderBy('updatedAt').limit(1000);if(last)q=q.startAfter(last);
  const snap=await q.get();for(const d of snap.docs){const row=docRow(d);if(!maxTs||row.ts>maxTs)maxTs=row.ts;if(applyRow(row))changed++}
  if(snap.size<1000)break;last=snap.docs[snap.docs.length-1]}
 CL.since=maxTs;cSave();if(changed){saveLocal();if(!$('ov').classList.contains('on')&&!(V==='menu'&&SUB==='cloud'))render()}return changed}
async function cSync(){if(!cloudOn())return;if(CL.busy){CL.again=true;return}CL.busy=true;setCloud('sync');
 try{if(!navigator.onLine)throw new Error('offline');if(CL.cfg.pullFirst){await cPull();CL.cfg.pullFirst=false;cSave()}await cPush();await cPull();setCloud('ok','Last sync '+new Date().toLocaleTimeString())}
 catch(e){const c=(e&&e.code)||'',m=(e&&e.message)||String(e);if(c==='unauthenticated'||!CL.user)setCloud('login','Sign in again');
  else{const off=!navigator.onLine||c==='unavailable'||c==='deadline-exceeded'||/offline|network|fetch/i.test(m);setCloud(off?'offline':'error',off?'':fbMsg(e))}}
 CL.busy=false;if(CL.again){CL.again=false;setTimeout(cSync,300)}}
window.addEventListener('online',()=>cSync());window.addEventListener('focus',()=>cSync());
async function cSignIn(up){const em=$('cem').value.trim(),pw=$('cpw').value;if(!em||!pw)return toast('Enter email and password');
 try{await cEnsure();const r=up?await CL.auth.createUserWithEmailAndPassword(em,pw):await CL.auth.signInWithEmailAndPassword(em,pw);CL.user=r.user;
  if(up){try{await r.user.sendEmailVerification()}catch(e){}toast('Account created ✓ — a confirmation email was sent')}else toast('Signed in ✓');
  CL.stores=null;CL.invites=null;setCloud('login','Choose a store');render()}catch(e){toast(fbMsg(e))}}
async function cForgot(){const em=$('cem').value.trim();if(!em)return toast('Type your email first');try{await cEnsure();await CL.auth.sendPasswordResetEmail(em);toast('Password reset email sent ✓')}catch(e){toast(fbMsg(e))}}
async function cVerify(){try{await CL.user.sendEmailVerification();toast('Confirmation email sent ✓')}catch(e){toast(fbMsg(e))}}
async function cSignOut(){try{await CL.auth.signOut()}catch(e){}CL.user=null;clearInterval(CL.timer);Object.assign(CL.cfg,{storeId:null,storeName:null,role:null});CL.hash={};CL.since=null;CL.stores=null;CL.invites=null;CL.team=null;cSave();setCloud('login','Signed out');render()}
async function cLoadStores(){CL.stores=CL.stores||[];try{const u=CL.user;try{await u.reload();await u.getIdToken(true)}catch(e){}
  const mine=await STORES().where('memberIds','array-contains',u.uid).get();
  CL.stores=mine.docs.map(d=>({store_id:d.id,role:(d.data().roles||{})[u.uid]||'staff',pos_stores:{name:d.data().name}}));
  CL.invites=[];if(u.email&&CL.auth.currentUser.emailVerified){const inv=await STORES().where('invites','array-contains',u.email.toLowerCase()).get();
   CL.invites=inv.docs.filter(d=>!(d.data().memberIds||[]).includes(u.uid)).map(d=>({id:d.id,name:d.data().name}))}}
 catch(e){toast(fbMsg(e))}render()}
async function cCreateStore(){const name=$('csn').value.trim()||D.settings.name;const u=CL.user;
 try{const ref=STORES().doc();await ref.set({name,memberIds:[u.uid],roles:{[u.uid]:'owner'},emails:{[u.uid]:(u.email||'').toLowerCase()},invites:[],createdAt:FV().serverTimestamp()});
  await cUseStore(ref.id,name,'owner',true)}catch(e){toast(fbMsg(e))}}
function cUseIdx(i){const m=CL.stores[i];cUseStore(m.store_id,(m.pos_stores||{}).name||'Store',m.role,false)}
async function cJoin(i){const s=CL.invites[i];const u=CL.user;const em=u.email.toLowerCase();
 try{await STORES().doc(s.id).update({memberIds:FV().arrayUnion(u.uid),['roles.'+u.uid]:'staff',['emails.'+u.uid]:em,invites:FV().arrayRemove(em)});
  toast('Joined '+s.name+' ✓');await cUseStore(s.id,s.name,'staff',false)}catch(e){toast(fbMsg(e))}}
async function cUseStore(id,name,role,isNew){let count=0;
 if(!isNew){try{const s=await STORES().doc(id).collection('records').limit(1).get();count=s.size}catch(e){return toast(fbMsg(e))}}
 if(count>0){if(!(await yes('Load cloud data?','"'+name+'" already has data in the cloud. Load it onto this device?\n\nThis device\'s current data will be replaced. A backup file of it is downloaded first.','Load cloud data')))return;
  if(D.sales.length||D.repairs.length||D.customers.length)await download('ns-store-before-cloud-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(D));
  const lang=D.settings.lang;D=blank();D.settings.lang=lang;CL.cfg.pullFirst=true}
 CL.hash={};CL.since=null;CL.team=null;Object.assign(CL.cfg,{storeId:id,storeName:name,role});cSave();saveLocal();toast('Connected to '+name+' ✓');cStart();render()}
async function cBackup(){if(!cloudOn())return toast('Connect to BiixiPay Cloud first');toast('Downloading from cloud…');
 try{if(CL.busy)await new Promise(r=>setTimeout(r,1500));await cPush();const out=blank();delete out.sample;let n=0,last=null;
  while(true){let q=RC().orderBy(firebase.firestore.FieldPath.documentId()).limit(1000);if(last)q=q.startAfter(last);const snap=await q.get();
   for(const d of snap.docs){const r=docRow(d);if(r.deleted)continue;n++;if(r.kind==='meta'){Object.assign(out.settings,r.data.settings||{});Object.assign(out.seq,r.data.seq||{});if(r.data.sample)out.sample=true}else if(Array.isArray(out[r.kind]))out[r.kind].push(r.data)}
   if(snap.size<1000)break;last=snap.docs[snap.docs.length-1]}
  out.settings.lang=D.settings.lang;out.cloudBackup={store:CL.cfg.storeName,ts:Date.now(),records:n};
  const ok=await download('biixipay-cloud-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(out));
  if(ok){D.lastBackup=Date.now();logEv('settings','Cloud backup downloaded');CL.cfg.lastCloudBackup=Date.now();cSave();toast('Cloud backup saved — '+n+' records ✓');render()}}
 catch(e){toast('Backup failed: '+fbMsg(e))}}
async function cLoadTeam(){try{const d=(await STORES().doc(CL.cfg.storeId).get()).data()||{};CL.team={roles:d.roles||{},emails:d.emails||{},invites:d.invites||[]}}catch(e){CL.team={roles:{},emails:{},invites:[],err:fbMsg(e)}}if(V==='menu'&&SUB==='cloud')render()}
async function cAddStaff(){const em=$('cst').value.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(em))return toast('Enter their email');
 try{await STORES().doc(CL.cfg.storeId).update({invites:FV().arrayUnion(em)});logEv('settings','Cloud staff invited: '+em);toast(em+' invited ✓');CL.team=null;render()}catch(e){toast(fbMsg(e))}}
async function cUninvite(em){try{await STORES().doc(CL.cfg.storeId).update({invites:FV().arrayRemove(em)});CL.team=null;render()}catch(e){toast(fbMsg(e))}}
async function cRemoveStaff(uidv){const em=(CL.team&&CL.team.emails[uidv])||'this person';if(!(await yes('Remove '+em+'?','They can no longer open this store in the cloud.','Remove',true)))return;
 try{await STORES().doc(CL.cfg.storeId).update({memberIds:FV().arrayRemove(uidv),['roles.'+uidv]:FV().delete(),['emails.'+uidv]:FV().delete()});logEv('settings','Cloud staff removed: '+em);CL.team=null;render()}catch(e){toast(fbMsg(e))}}
async function cDisconnect(){if(!(await yes('Disconnect?','Disconnect this device from the cloud store? The data stays on this device.','Disconnect',true)))return;clearInterval(CL.timer);Object.assign(CL.cfg,{storeId:null,storeName:null,role:null});CL.hash={};CL.since=null;CL.stores=null;CL.invites=null;CL.team=null;cSave();setCloud('login','Choose a store');render()}
function vCloud(){const c=CL.cfg,u=CL.user;if(!CL.fs){setTimeout(cOpen,0)}
 if(cloudOn()&&c.role==='owner'&&!CL.team)setTimeout(cLoadTeam,0);
 const team=CL.team;
 return `<h2>☁ BiixiPay Cloud</h2>
 <p class="muted small">Every sale, repair and stock change is saved online (Firebase) and all your devices stay in sync. The app still works without internet — changes upload when the connection is back.</p>
 <div id="cloudInfo">${cloudInfoHTML()}</div>
 ${!CL.fs?`<div class="card" style="margin-top:12px"><p class="muted">${CL.status==='offline'?'Could not reach Firebase. Check the internet connection, then open this page again.':'Connecting…'}</p></div>`:`
 <div class="card" style="margin-top:12px"><h3 style="margin-top:0">1. Account</h3>${u?`<p>Signed in as <b>${esc(u.email||'')}</b>${u.emailVerified?'':` <span class="warnc small">(email not confirmed)</span>`}</p>
 <div class="row">${u.emailVerified?'':`<button class="btn ghost sm" onclick="cVerify()">Resend confirmation email</button>`}<button class="btn ghost sm" onclick="cSignOut()">Sign out</button></div>`
 :`<div class="g2"><div><label>Email</label><input id="cem" type="email" autocomplete="username"></div><div><label>Password (6+ characters)</label><input id="cpw" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')cSignIn(false)"></div></div>
 <div class="row" style="margin-top:10px"><button class="btn" onclick="cSignIn(false)">Sign in</button><button class="btn ghost" onclick="cSignIn(true)">Create account</button><a class="small" style="color:var(--mango);cursor:pointer;margin-left:auto" onclick="cForgot()">Forgot password?</a></div>`}</div>
 ${u?`<div class="card" style="margin-top:12px"><h3 style="margin-top:0">2. Store</h3>${c.storeId?`<p>Connected to <b>${esc(c.storeName||'')}</b> <span class="badge">${esc(c.role||'')}</span></p>
 <div class="row"><button class="btn" onclick="cSync()">Sync now</button><button class="btn blue" onclick="cBackup()">💾 Download cloud backup</button><button class="btn ghost" onclick="cDisconnect()">Disconnect</button></div>
 <p class="small muted">Last cloud backup: ${c.lastCloudBackup?fmtDT(c.lastCloudBackup):t('never')}. Save the file to Google Drive or a USB stick each week. Restore it from Menu → Backup.</p>
 ${c.role==='owner'?`<h3>Staff on other devices</h3>${!team?'<p class="muted small">Loading…</p>':team.err?`<p class="warnc small">${esc(team.err)}</p>`:`
 ${Object.entries(team.roles).map(([id,r])=>`<div class="line"><div class="nm"><b>${esc(team.emails[id]||id)}</b> <span class="badge ${r==='owner'?'ready':''}">${esc(r)}</span>${id===u.uid?' <span class="muted small">(you)</span>':''}</div>${id===u.uid?'':`<button class="btn ghost sm" onclick="cRemoveStaff('${esc(id)}')">${t('del')}</button>`}</div>`).join('')}
 ${team.invites.map(em=>`<div class="line"><div class="nm">${esc(em)} <span class="muted small">invited — not joined yet</span></div><button class="qb" onclick="cUninvite('${esc(em)}')">×</button></div>`).join('')}`}
 <label>Invite staff by email</label><div class="row"><input id="cst" type="email" style="flex:1" placeholder="staff@email.com"><button class="btn" onclick="cAddStaff()">${t('add')}</button></div>
 <p class="small muted">They open this page, tap Create account with that email, confirm it from the email they get, then tap Join.</p>`:''}`
 :`${CL.stores===null?'<p class="muted">Loading stores…</p>':CL.stores.length?CL.stores.map((m,i)=>`<div class="line"><div class="nm"><b>${esc((m.pos_stores||{}).name||'Store')}</b> <span class="muted small">${esc(m.role)}</span></div><button class="btn sm" onclick="cUseIdx(${i})">Use this store</button></div>`).join(''):'<p class="muted">No stores yet.</p>'}
 ${(CL.invites||[]).map((s,i)=>`<div class="line"><div class="nm">📩 Invited to <b>${esc(s.name)}</b></div><button class="btn sm blue" onclick="cJoin(${i})">Join</button></div>`).join('')}
 ${u.emailVerified?'':`<p class="small muted">Invited by the store owner? Confirm your email first (check your inbox), then tap <a style="color:var(--mango);cursor:pointer" onclick="CL.stores=null;render()">Refresh</a>.</p>`}
 <label>New store name</label><div class="row"><input id="csn" style="flex:1" value="${esc(D.settings.name)}"><button class="btn" onclick="cCreateStore()">Create & upload this device's data</button></div>`}</div>`:''}`}`}

