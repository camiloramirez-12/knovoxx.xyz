(function(){
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // CSRF tokens
  document.getElementById('csrf-client').value = knx.csrfToken();
  document.getElementById('csrf-signup').value = sessionStorage.getItem('csrf');
  document.getElementById('csrf-admin').value = sessionStorage.getItem('csrf');

  // Password strength meter
  const passIn = document.getElementById('client-pass');
  const meter = document.getElementById('client-strength');
  passIn?.addEventListener('input', ()=>{ meter.value = knx.scorePass(passIn.value); });

  // rate limit helper
  function bumpAttempts(key){
    const x = JSON.parse(sessionStorage.getItem(key)||'{"n":0,"t":0}');
    const now = Date.now();
    if(now-x.t>5*60_000){ x.n=0; } // reset after 5 min
    x.n++; x.t=now; sessionStorage.setItem(key, JSON.stringify(x)); return x.n;
  }

  // Client login
  document.getElementById('client-login')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!knx.checkCSRF('csrf-client')){ alert('CSRF inválido'); return; }
    const tries = bumpAttempts('rl_client');
    if(tries>10){ alert('Bloqueado por demasiados intentos. Espera 5 min.'); return; }
    const email = document.getElementById('client-email').value.trim().toLowerCase();
    const pass = document.getElementById('client-pass').value;
    const mfa = document.getElementById('client-mfa').checked;
    const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
    const user = users.find(u=>u.email===email && u.active!==false);
    if(!user){ alert('Usuario no encontrado o inactivo'); return; }
    const passHash = await knx.hash(pass);
    if(user.passHash!==passHash){ alert('Contraseña incorrecta'); return; }
    if((user.mfa || mfa)){
      const code = prompt('Ingresa el código 2FA (demo: 000111)');
      if(code!=='000111'){ alert('Código 2FA inválido'); return; }
    }
    knx.setSession('client', { email:user.email, name:user.name, plan:user.plan });
    knx.logEvent('auth','login-client '+email);
    location.href = 'client.html';
  });

  // Forgot password (demo)
  document.getElementById('forgot')?.addEventListener('click', (e)=>{
    e.preventDefault();
    const email = document.getElementById('client-email').value.trim();
    if(!email) return alert('Escribe tu email arriba');
    alert('Te enviamos un link de recuperación (simulado)');
    knx.logEvent('auth','forgot '+email);
  });

  // Client signup
  document.getElementById('client-signup')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!knx.checkCSRF('csrf-signup')){ alert('CSRF inválido'); return; }
    const name = document.getElementById('su-name').value.trim();
    const email = document.getElementById('su-email').value.trim().toLowerCase();
    const pass = document.getElementById('su-pass').value;
    const pass2 = document.getElementById('su-pass2').value;
    const enableMfa = document.getElementById('su-mfa').checked;
    if(pass!==pass2){ alert('Las contraseñas no coinciden'); return; }
    if(knx.scorePass(pass)<2){ alert('Contraseña muy débil'); return; }
    const users = JSON.parse(localStorage.getItem(knx.DB.USERS)||'[]');
    if(users.some(u=>u.email===email)){ alert('Ese email ya está registrado'); return; }
    const passHash = await knx.hash(pass);
    const newUser = { id:crypto.randomUUID(), name, email, passHash, plan:'Starter', active:true, tokens:0, credits:1000, keys:[], bills:[], mfa:enableMfa };
    users.push(newUser);
    localStorage.setItem(knx.DB.USERS, JSON.stringify(users));
    knx.logEvent('user','signup '+email);
    alert('Cuenta creada. Verifica tu email (simulado) y luego inicia sesión.');
  });

  // Admin login
  document.getElementById('admin-login')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!knx.checkCSRF('csrf-admin')){ alert('CSRF inválido'); return; }
    const tries = bumpAttempts('rl_admin');
    if(tries>10){ alert('Bloqueado por demasiados intentos. Espera 5 min.'); return; }
    const email = document.getElementById('admin-email').value.trim().toLowerCase();
    const pass = document.getElementById('admin-pass').value;
    const admin = JSON.parse(localStorage.getItem(knx.DB.ADMIN)||'{}');
    if(!admin.passHash){ admin.passHash = await knx.hash('Admin#2025'); localStorage.setItem(knx.DB.ADMIN, JSON.stringify(admin)); }
    const ok = admin.email===email && admin.passHash===await knx.hash(pass);
    if(!ok){ alert('Credenciales inválidas'); return; }
    if((admin.mfa || document.getElementById('admin-mfa').checked)){
      const code = prompt('Ingresa el código 2FA (demo: 000111)');
      if(code!=='000111'){ alert('Código 2FA inválido'); return; }
    }
    knx.setSession('admin', { email });
    knx.logEvent('auth','login-admin');
    location.href = 'admin.html';
  });

})();