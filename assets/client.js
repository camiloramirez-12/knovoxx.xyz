(function(){
  // Impersonation support
  const imp = sessionStorage.getItem('impersonate');
  if(imp){
    // allow bypass for demo but set role as client
    knx.setSession('client', { email: imp, name: imp, plan: 'Starter' });
    sessionStorage.removeItem('impersonate');
  }
  knx.requireRole('client');
  knx.setupViews();
  knx.setupIdleGuard();
  document.getElementById('logout').addEventListener('click', ()=>{ knx.clearSession(); location.href='login.html'; });

  const s = knx.getSession();
  const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
  let me = users.find(u=>u.email===s.email);
  if(!me){ alert('Usuario no encontrado'); location.href='login.html'; return; }
  document.getElementById('clientChip').textContent = me.name||me.email;

  function refresh(){
    document.getElementById('cl-plan').textContent = me.plan;
    document.getElementById('cl-tokens').textContent = (me.tokens||0).toLocaleString();
    document.getElementById('cl-credits').textContent = (me.credits||0).toLocaleString();
  }
  refresh();

  // Playground (simulated)
  document.getElementById('pg-run').addEventListener('click', ()=>{
    const prompt = document.getElementById('pg-input').value.trim();
    const temp = Number(document.getElementById('pg-temp').value);
    const output = `\u23F5 Respuesta simulada (temp=${temp}):\n- Idea 1 basada en tu prompt\n- Idea 2 con más creatividad\n- Idea 3 con enfoque práctico`;
    document.getElementById('pg-output').textContent = output;
    me.tokens = (me.tokens||0) + Math.floor(200 + Math.random()*300);
    const bill = { id:crypto.randomUUID(), ts:new Date().toISOString(), amount:0.01, desc:'Uso de playground'};
    const billing = JSON.parse(localStorage.getItem(knx.DB.BILLING)||'[]');
    billing.unshift(bill);
    localStorage.setItem(knx.DB.BILLING, JSON.stringify(billing));
    knx.logEvent('usage', me.email+' playground');
    localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
    refresh();
    renderBills();
  });

  document.getElementById('pg-save').addEventListener('click', ()=>{
    const text = document.getElementById('pg-input').value.trim(); if(!text) return alert('Nada que guardar');
    const name = prompt('Nombre para el prompt'); if(!name) return;
    const tags = prompt('Etiquetas (coma)')||'';
    const prompts = JSON.parse(localStorage.getItem(knx.DB.PROMPTS)||'[]');
    prompts.push({ id:crypto.randomUUID(), name, body:text, version:1, tags:tags.split(',').map(x=>x.trim()).filter(Boolean), owner:me.email });
    localStorage.setItem(knx.DB.PROMPTS, JSON.stringify(prompts));
    knx.logEvent('prompt','save '+name+' by '+me.email);
    renderMyPrompts();
  });

  // API Keys
  function renderKeys(){
    const ul = document.getElementById('keys-list');
    ul.innerHTML = (me.keys||[]).map(k=>`<li><code>${k}</code> <button data-k="${k}" class="btn danger small">Revocar</button></li>`).join('');
  }
  document.getElementById('new-key').addEventListener('click', ()=>{
    const k = 'knx_'+crypto.randomUUID().replace(/-/g,'');
    me.keys = me.keys||[]; me.keys.unshift(k);
    localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
    knx.logEvent('key','create '+me.email);
    renderKeys();
  });
  document.getElementById('keys-list').addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const k = btn.dataset.k;
    me.keys = (me.keys||[]).filter(x=>x!==k);
    localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
    knx.logEvent('key','revoke '+me.email);
    renderKeys();
  });
  renderKeys();

  // Billing history
  function renderBills(){
    const bills = JSON.parse(localStorage.getItem(knx.DB.BILLING)||'[]');
    document.getElementById('bill-list').innerHTML = bills.map(b=>`<li>[${new Date(b.ts).toLocaleString()}] $${b.amount} — ${b.desc}</li>`).join('');
  }
  renderBills();

  // Profile
  document.getElementById('pr-name').value = me.name;
  document.getElementById('pr-email').value = me.email;
  document.getElementById('pr-plan').value = me.plan;
  document.getElementById('pr-mfa').checked = !!me.mfa;
  document.getElementById('client-profile').addEventListener('submit', (e)=>{
    e.preventDefault();
    me.name = document.getElementById('pr-name').value.trim();
    me.plan = document.getElementById('pr-plan').value;
    me.mfa = document.getElementById('pr-mfa').checked;
    localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
    knx.logEvent('profile','update '+me.email);
    document.getElementById('clientChip').textContent = me.name||me.email;
    refresh();
    alert('Perfil actualizado');
  });

  // My prompts (owned)
  function renderMyPrompts(){
    const tbody = document.querySelector('#my-prompts-table tbody');
    const prompts = (JSON.parse(localStorage.getItem(knx.DB.PROMPTS)||'[]')).filter(p=>p.owner===me.email);
    tbody.innerHTML = prompts.map(p=>`
      <tr>
        <td>${p.name}</td>
        <td>v${p.version}</td>
        <td>${(p.tags||[]).join(', ')}</td>
        <td>
          <div class="row-actions">
            <button data-id="${p.id}" data-act="load" class="btn btn-ghost small">Cargar</button>
            <button data-id="${p.id}" data-act="edit" class="btn btn-ghost small">Editar</button>
            <button data-id="${p.id}" data-act="del" class="btn danger small">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
    tbody.onclick = (e)=>{
      const btn=e.target.closest('button'); if(!btn) return;
      const id=btn.dataset.id, act=btn.dataset.act;
      const all = JSON.parse(localStorage.getItem(knx.DB.PROMPTS)||'[]');
      const p = all.find(x=>x.id===id);
      if(!p) return;
      if(act==='load'){ document.getElementById('pg-input').value = p.body; knx.logEvent('prompt','load '+p.name); }
      if(act==='edit'){ const body=prompt('Editar', p.body); if(body==null) return; p.body=body; p.version++; }
      if(act==='del'){ if(!confirm('Eliminar?')) return; all.splice(all.indexOf(p),1); }
      localStorage.setItem(knx.DB.PROMPTS, JSON.stringify(all));
      renderMyPrompts();
    };
  }
  renderMyPrompts();

  // Command palette (Ctrl/Cmd+K)
  const palette = document.getElementById('cmdk');
  const input = document.getElementById('cmdk-input');
  const list = document.getElementById('cmdk-list');
  const actions = [
    {name:'Ir a Playground', run:()=>document.querySelector('[data-view="playground"]').click()},
    {name:'Ir a Mis Prompts', run:()=>document.querySelector('[data-view="prompts"]').click()},
    {name:'Crear API Key', run:()=>document.getElementById('new-key').click()},
    {name:'Cerrar sesión', run:()=>document.getElementById('logout').click()},
  ];
  function openPalette(){
    palette.classList.add('show'); palette.setAttribute('open',''); palette.setAttribute('aria-hidden','false'); input.value=''; input.focus(); renderList('');
  }
  function closePalette(){ palette.classList.remove('show'); palette.removeAttribute('open'); palette.setAttribute('aria-hidden','true'); }
  function renderList(q){ list.innerHTML = actions.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())).map(a=>`<li>${a.name}</li>`).join(''); }
  input?.addEventListener('input', ()=>renderList(input.value));
  list?.addEventListener('click', (e)=>{ const i=[...list.children].indexOf(e.target); if(i>=0){ actions[i].run(); closePalette(); }});
  document.addEventListener('keydown', (e)=>{
    const mod = e.ctrlKey||e.metaKey;
    if(mod && e.key.toLowerCase()==='k'){ e.preventDefault(); openPalette(); }
    if(e.key==='Escape') closePalette();
    // quick nav G then P
    if(e.key.toLowerCase()==='g'){ let once=true; const handler=(ev)=>{ if(once && ev.key.toLowerCase()==='p'){ document.querySelector('[data-view="playground"]').click(); once=false; } document.removeEventListener('keydown',handler); }; document.addEventListener('keydown',handler); }
  });

})();