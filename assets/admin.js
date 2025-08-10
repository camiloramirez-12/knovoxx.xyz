(function(){
  knx.requireRole('admin');
  knx.setupViews();
  knx.setupIdleGuard();
  document.getElementById('logout').addEventListener('click', ()=>{ knx.clearSession(); location.href='login.html'; });

  // Overview
  function refreshOverview(){
    const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
    const logs = JSON.parse(localStorage.getItem(knx.DB.LOGS)||'[]');
    const billing = JSON.parse(localStorage.getItem(knx.DB.BILLING)||'[]');
    document.getElementById('stat-users').textContent = users.length;
    const tokens = users.reduce((a,u)=>a+(u.tokens||0),0);
    document.getElementById('stat-tokens').textContent = tokens.toLocaleString();
    const amount = billing.reduce((a,b)=>a+(b.amount||0),0);
    document.getElementById('stat-billing').textContent = '$'+amount.toLocaleString();
    document.getElementById('recent-logs').innerHTML = logs.slice(0,12).map(l=>`<li>[${new Date(l.ts).toLocaleString()}] ${l.type}: ${l.detail}</li>`).join('');
    drawUsageChart(users);
  }
  function drawUsageChart(users){
    const c = document.getElementById('usageChart');
    if(!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    // Fake series
    const days = 30, H=200, W=880, left=10, bottom=200, step=W/(days-1);
    ctx.beginPath(); ctx.moveTo(left, bottom - Math.random()*H*0.3);
    for(let i=1;i<days;i++){ const y = bottom - (Math.sin(i/5)+1)/2*H*(0.7+Math.random()*0.3); ctx.lineTo(left+i*step, y); }
    ctx.lineWidth=2; ctx.strokeStyle = '#74c0ff'; ctx.stroke();
    ctx.font='12px Inter'; ctx.fillStyle='#9fb1c6'; ctx.fillText('Últimos 30 días', 10, 14);
  }
  refreshOverview();

  // Users
  const tbody = document.querySelector('#users-table tbody');
  const search = document.getElementById('user-search');
  function renderUsers(){
    const term = (search.value||'').toLowerCase();
    const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]')
      .filter(u=>[u.name,u.email,u.plan].join(' ').toLowerCase().includes(term));
    tbody.innerHTML = users.map(u=>`
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.plan}</td>
        <td>${u.active!==false?'Sí':'No'}</td>
        <td>${u.mfa?'Sí':'No'}</td>
        <td>
          <div class="row-actions">
            <button data-act="imp" data-id="${u.id}" class="btn btn-ghost small">Entrar</button>
            <button data-act="toggle" data-id="${u.id}" class="btn btn-ghost small">${u.active!==false?'Desactivar':'Activar'}</button>
            <button data-act="reset" data-id="${u.id}" class="btn btn-ghost small">Reset pass</button>
            <button data-act="del" data-id="${u.id}" class="btn danger small">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
  search?.addEventListener('input', renderUsers);
  document.getElementById('export-users').addEventListener('click', ()=>{
    const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
    knx.downloadJSON('usuarios.json', users);
  });
  document.getElementById('backup').addEventListener('click', ()=>{
    const dump = {}; Object.values(knx.DB).forEach(k=>dump[k]=JSON.parse(localStorage.getItem(k)||'null'));
    knx.downloadJSON('backup_knovoxxai.json', dump);
  });
  document.getElementById('restore').addEventListener('click', ()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.json'; inp.onchange=()=>{
      const f=inp.files[0]; const fr=new FileReader(); fr.onload=()=>{
        const data=JSON.parse(fr.result); Object.keys(data).forEach(k=>localStorage.setItem(k, JSON.stringify(data[k])));
        alert('Restore completo. Recarga.');
        location.reload();
      }; fr.readAsText(f);
    }; inp.click();
  });
  document.getElementById('btn-import').addEventListener('click', ()=>document.getElementById('import-users').click());
  document.getElementById('import-users').addEventListener('change', (e)=>{
    const f=e.target.files[0]; if(!f) return;
    const fr=new FileReader(); fr.onload=async ()=>{
      const lines = fr.result.split(/\r?\n/).filter(Boolean);
      const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
      for(const line of lines.slice(1)){ // skip header
        const [name,email,pass,plan] = line.split(',');
        if(!email) continue;
        if(users.some(u=>u.email===email)) continue;
        users.push({ id:crypto.randomUUID(), name:name?.trim(), email:email.trim().toLowerCase(), passHash:await knx.hash((pass||'Starter#123').trim()), plan:(plan||'Starter').trim(), active:true, mfa:false, tokens:0, credits:1000, keys:[], bills:[] });
      }
      localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
      knx.logEvent('user','import '+(lines.length-1)+' usuarios');
      renderUsers(); refreshOverview();
    }; fr.readAsText(f);
  });
  tbody.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
    const u = users.find(x=>x.id===id); if(!u) return;
    if(act==='toggle'){ u.active = !(u.active!==false); knx.logEvent('user','toggle '+u.email); }
    if(act==='reset'){ const newPass = prompt('Nueva contraseña para '+u.email); if(!newPass) return; u.passHash = await knx.hash(newPass); knx.logEvent('user','reset-pass '+u.email); }
    if(act==='del'){ if(!confirm('Eliminar usuario?')) return; users.splice(users.indexOf(u),1); knx.logEvent('user','delete '+u.email); }
    if(act==='imp'){ sessionStorage.setItem('impersonate', u.email); location.href='client.html'; return; }
    localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
    renderUsers(); refreshOverview();
  });
  document.getElementById('create-user').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('cu-name').value.trim();
    const email = document.getElementById('cu-email').value.trim().toLowerCase();
    const pass = document.getElementById('cu-pass').value;
    const plan = document.getElementById('cu-plan').value;
    const mfa = document.getElementById('cu-mfa').checked;
    const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
    if(users.some(u=>u.email===email)){ alert('Email ya existe'); return; }
    users.push({ id:crypto.randomUUID(), name, email, passHash:await knx.hash(pass), plan, active:true, tokens:0, credits:1000, keys:[], bills:[], mfa });
    localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
    knx.logEvent('user','create '+email);
    e.target.reset();
    renderUsers(); refreshOverview();
  });
  renderUsers();

  // Models
  const mtbody = document.querySelector('#models-table tbody');
  function renderModels(){
    const models = JSON.parse(localStorage.getItem(knx.DB.MODELS)||'[]');
    mtbody.innerHTML = models.map(m=>`
      <tr>
        <td>${m.name}</td>
        <td>${m.type}</td>
        <td>${m.temp}</td>
        <td>${m.active?'Activo':'Pausado'}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost small" data-id="${m.id}" data-act="toggle">${m.active?'Pausar':'Activar'}</button>
            <button class="btn btn-ghost small" data-id="${m.id}" data-act="temp">Temp</button>
            <button class="btn danger small" data-id="${m.id}" data-act="del">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
  document.getElementById('new-model').addEventListener('click', ()=>{
    const name = prompt('Nombre del modelo'); if(!name) return;
    const type = prompt('Tipo (text/vision/voice)')||'text';
    const temp = Number(prompt('Temperatura (0-1)')||'0.5');
    const models = JSON.parse(localStorage.getItem(knx.DB.MODELS)||'[]');
    models.push({ id:crypto.randomUUID(), name, type, temp, active:true });
    localStorage.setItem(knx.DB.MODELS, JSON.stringify(models));
    knx.logEvent('model','create '+name);
    renderModels();
  });
  mtbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    const models = JSON.parse(localStorage.getItem(knx.DB.MODELS)||'[]');
    const m = models.find(x=>x.id===id); if(!m) return;
    if(act==='toggle'){ m.active=!m.active; knx.logEvent('model','toggle '+m.name); }
    if(act==='temp'){ const t = Number(prompt('Nueva temperatura (0-1)', m.temp)); if(Number.isFinite(t)) m.temp = Math.max(0,Math.min(1,t)); }
    if(act==='del'){ if(!confirm('Eliminar modelo?')) return; models.splice(models.indexOf(m),1); knx.logEvent('model','delete '+m.name); }
    localStorage.setItem(knx.DB.MODELS, JSON.stringify(models));
    renderModels();
  });
  renderModels();

  // Prompts (global library)
  const ptbody = document.querySelector('#prompts-table tbody');
  function renderPrompts(){
    const prompts = JSON.parse(localStorage.getItem(knx.DB.PROMPTS)||'[]');
    ptbody.innerHTML = prompts.map(p=>`
      <tr>
        <td>${p.name}</td>
        <td>v${p.version}</td>
        <td>${(p.tags||[]).join(', ')}</td>
        <td>
          <div class="row-actions">
            <button data-id="${p.id}" data-act="edit" class="btn btn-ghost small">Editar</button>
            <button data-id="${p.id}" data-act="dup" class="btn btn-ghost small">Duplicar</button>
            <button data-id="${p.id}" data-act="del" class="btn danger small">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
  document.getElementById('new-prompt').addEventListener('click', ()=>{
    const name = prompt('Nombre del prompt'); if(!name) return;
    const body = prompt('Contenido inicial'); if(body==null) return;
    const tags = prompt('Etiquetas separadas por coma')||'';
    const prompts = JSON.parse(localStorage.getItem(knx.DB.PROMPTS)||'[]');
    prompts.push({ id:crypto.randomUUID(), name, body, version:1, tags:tags.split(',').map(x=>x.trim()).filter(Boolean) });
    localStorage.setItem(knx.DB.PROMPTS, JSON.stringify(prompts));
    knx.logEvent('prompt','create '+name);
    renderPrompts();
  });
  ptbody.addEventListener('click', (e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const id=btn.dataset.id, act=btn.dataset.act;
    const prompts = JSON.parse(localStorage.getItem(knx.DB.PROMPTS)||'[]');
    const p = prompts.find(x=>x.id===id); if(!p) return;
    if(act==='edit'){
      const newBody = prompt('Editar contenido', p.body); if(newBody==null) return;
      p.body = newBody; p.version++; knx.logEvent('prompt','edit '+p.name);
    }
    if(act==='dup'){
      const copy = {...p, id:crypto.randomUUID(), name:p.name+' copy'}; prompts.push(copy); knx.logEvent('prompt','duplicate '+p.name);
    }
    if(act==='del'){
      if(!confirm('Eliminar prompt?')) return; prompts.splice(prompts.indexOf(p),1); knx.logEvent('prompt','delete '+p.name);
    }
    localStorage.setItem(knx.DB.PROMPTS, JSON.stringify(prompts));
    renderPrompts();
  });
  renderPrompts();

  // Logs
  function renderLogs(){
    const logs = JSON.parse(localStorage.getItem(knx.DB.LOGS)||'[]');
    document.getElementById('logs-list').innerHTML = logs.map(l=>`<li>[${new Date(l.ts).toLocaleString()}] ${l.type}: ${l.detail}</li>`).join('');
  }
  document.getElementById('export-logs').addEventListener('click', ()=>{
    const logs = JSON.parse(localStorage.getItem(knx.DB.LOGS)||'[]');
    const rows = [['id','ts','type','detail'], ...logs.map(l=>[l.id,l.ts,l.type,l.detail])];
    knx.downloadCSV('logs.csv', rows);
  });
  renderLogs();

  // Security summary
  function renderSecurity(){
    const admin = JSON.parse(localStorage.getItem(knx.DB.ADMIN)||'{}');
    const cfg = JSON.parse(localStorage.getItem(knx.DB.CFG)||'{}');
    const items = [
      ['MFA admin', admin.mfa?'ON':'OFF'],
      ['Idle timeout', (cfg.idleMinutes||20)+' min'],
      ['CSRF', 'token por sesión'],
      ['Rate-limit', '10 intentos/5min (demo)']
    ];
    document.getElementById('sec-list').innerHTML = items.map(i=>`<li>${i[0]}: <strong>${i[1]}</strong></li>`).join('');
  }
  renderSecurity();

  // Settings
  const admin = JSON.parse(localStorage.getItem(knx.DB.ADMIN)||'{}');
  document.getElementById('set-admin-email').value = admin.email||'';
  document.getElementById('set-admin-pass').value = '';
  document.getElementById('set-idle').value = JSON.parse(localStorage.getItem(knx.DB.CFG)).idleMinutes||20;
  document.getElementById('admin-settings').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('set-admin-email').value.trim().toLowerCase();
    const pass = document.getElementById('set-admin-pass').value;
    const idle = Number(document.getElementById('set-idle').value)||20;
    if(pass.length<8){ alert('Contraseña mínima de 8'); return; }
    const a = { email, passHash: await knx.hash(pass), mfa: admin.mfa||false };
    localStorage.setItem(knx.DB.ADMIN, JSON.stringify(a));
    const cfg = JSON.parse(localStorage.getItem(knx.DB.CFG)); cfg.idleMinutes = idle; localStorage.setItem(knx.DB.CFG, JSON.stringify(cfg));
    knx.logEvent('admin','update-credentials');
    alert('Ajustes guardados');
    renderSecurity();
  });
  document.getElementById('wipe').addEventListener('click', ()=>{
    if(confirm('Esto borrará datos locales (usuarios, logs, etc).')){
      Object.values(knx.DB).forEach(k=>localStorage.removeItem(k));
      knx.logEvent('admin','wipe');
      alert('Datos borrados. Recarga.');
      location.reload();
    }
  });

  // Impersonate
  document.getElementById('impersonate').addEventListener('click', ()=>{
    const email = prompt('Email del usuario a impersonar'); if(!email) return;
    sessionStorage.setItem('impersonate', email.trim().toLowerCase());
    location.href='client.html';
  });

})();