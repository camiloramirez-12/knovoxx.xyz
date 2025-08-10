// Core utilities (localStorage-based demo). HTML/CSS/JS puro.
const DB = {
  USERS: 'knx_users',
  ADMIN: 'knx_admin',
  LOGS: 'knx_logs',
  MODELS: 'knx_models',
  PLANS: 'knx_plans',
  BILLING: 'knx_billing',
  PROMPTS: 'knx_prompts',
  CFG: 'knx_cfg'
};

// Seed data
(function seed(){
  if(!localStorage.getItem(DB.USERS)) localStorage.setItem(DB.USERS, JSON.stringify([]));
  if(!localStorage.getItem(DB.ADMIN)){
    localStorage.setItem(DB.ADMIN, JSON.stringify({ email:'admin@knovoxx.ai', passHash:null, mfa:false }));
  }
  if(!localStorage.getItem(DB.MODELS)){
    localStorage.setItem(DB.MODELS, JSON.stringify([
      {id: crypto.randomUUID(), name:'gpt-neo-pro', type:'text', temp:0.5, active:true},
      {id: crypto.randomUUID(), name:'vision-x', type:'vision', temp:0.2, active:true},
    ]));
  }
  if(!localStorage.getItem(DB.PLANS)){
    localStorage.setItem(DB.PLANS, JSON.stringify([
      {id: crypto.randomUUID(), name:'Starter', price:0, tokens:1_000_000},
      {id: crypto.randomUUID(), name:'Pro', price:29, tokens:10_000_000},
      {id: crypto.randomUUID(), name:'Enterprise', price:0, tokens:100_000_000},
    ]));
  }
  if(!localStorage.getItem(DB.LOGS)) localStorage.setItem(DB.LOGS, JSON.stringify([]));
  if(!localStorage.getItem(DB.BILLING)) localStorage.setItem(DB.BILLING, JSON.stringify([]));
  if(!localStorage.getItem(DB.PROMPTS)) localStorage.setItem(DB.PROMPTS, JSON.stringify([]));
  if(!localStorage.getItem(DB.CFG)) localStorage.setItem(DB.CFG, JSON.stringify({ idleMinutes:20, theme:'dark' }));
})();

// Utils
function logEvent(type, detail){
  const logs = JSON.parse(localStorage.getItem(DB.LOGS)||'[]');
  logs.unshift({ id:crypto.randomUUID(), ts:new Date().toISOString(), type, detail });
  localStorage.setItem(DB.LOGS, JSON.stringify(logs.slice(0,1000)));
}
async function hash(text){
  if(window.crypto?.subtle){
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } else { let h=0; for(let i=0;i<text.length;i++){h=((h<<5)-h)+text.charCodeAt(i); h|=0;} return String(h); }
}
function setSession(role, payload){ sessionStorage.setItem('knx_session', JSON.stringify({role, ...payload, at:Date.now()})); }
function getSession(){ try{return JSON.parse(sessionStorage.getItem('knx_session')||'null');}catch{return null;} }
function clearSession(){ sessionStorage.removeItem('knx_session'); }
function setupViews(){
  const links = document.querySelectorAll('.navlink');
  const views = document.querySelectorAll('.view');
  const title = document.getElementById('view-title');
  links.forEach(btn=>btn.addEventListener('click', ()=>{
    links.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    views.forEach(v=>v.classList.remove('active'));
    const v = document.getElementById('view-'+btn.dataset.view);
    if(v) v.classList.add('active');
    if(title) title.textContent = btn.textContent;
  }));
}
function downloadJSON(filename, data){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
function downloadCSV(filename, rows){
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
function requireRole(expectedRole, redirect='login.html'){
  const s = getSession();
  if(!s || s.role!==expectedRole) location.href = redirect;
}
function setTheme(mode){
  const root = document.documentElement;
  if(mode==='light') root.classList.add('light'); else root.classList.remove('light');
  const cfg = JSON.parse(localStorage.getItem(DB.CFG)); cfg.theme = mode; localStorage.setItem(DB.CFG, JSON.stringify(cfg));
}
function initTheme(){
  const cfg = JSON.parse(localStorage.getItem(DB.CFG));
  setTheme(cfg.theme==='light'?'light':'dark');
  const btn = document.getElementById('themeToggle');
  if(btn){ btn.addEventListener('click', ()=>{ const next = document.documentElement.classList.contains('light')?'dark':'light'; setTheme(next); }); }
}
function csrfToken(){ const t = crypto.randomUUID().replace(/-/g,''); sessionStorage.setItem('csrf', t); return t; }
function checkCSRF(inputId){ const sent = document.getElementById(inputId)?.value; return sent && sent===sessionStorage.getItem('csrf'); }
function setupIdleGuard(){
  const cfg = JSON.parse(localStorage.getItem(DB.CFG));
  let last = Date.now();
  const reset=()=>{ last=Date.now(); }
  ['click','keydown','mousemove','scroll','touchstart'].forEach(ev=>document.addEventListener(ev, reset, {passive:true}));
  setInterval(()=>{
    const s = getSession(); if(!s) return;
    const mins = (Date.now()-last)/60000;
    if(mins>(cfg.idleMinutes||20)){ clearSession(); alert('Sesión cerrada por inactividad'); location.href='login.html'; }
  }, 10_000);
}
// Password score (0-4)
function scorePass(p){
  let s=0; if(p.length>=8) s++; if(/[A-Z]/.test(p)) s++; if(/[a-z]/.test(p)) s++; if(/[0-9]/.test(p)) s++; if(/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, Math.max(0, s-1));
}

// PWA SW registration handled in index.html footer
initTheme();

window.knx = { DB, logEvent, hash, setSession, getSession, clearSession, setupViews, downloadJSON, downloadCSV, requireRole, csrfToken, checkCSRF, setupIdleGuard, scorePass };
