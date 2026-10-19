(()=>{
'use strict';
const $=s=>document.querySelector(s);
const gate=$('#authGate'),setup=$('#authSetup'),form=$('#loginForm'),err=$('#authError'),success=$('#authSuccess');
let client=null,mode='login';
const cfg=window.GEOTRACIA_SUPABASE_CONFIG||{};
const configured=!!(cfg.url&&cfg.anonKey&&!cfg.url.includes('TU-PROYECTO')&&!cfg.anonKey.includes('PEGA_AQUI'));
function showGate(){document.body.classList.remove('geo-authenticated');gate.classList.add('visible')}
function enter(session){document.body.classList.add('geo-authenticated');gate.classList.remove('visible');const email=session?.user?.email||'';const av=$('#userAvatar');if(av)av.textContent=(email.split('@')[0]||'GT').slice(0,2).toUpperCase();const logout=$('#logoutBtn');if(logout)logout.title=email}
function message(s){err.textContent=s;success.textContent=''}
function successMessage(s){success.textContent=s;err.textContent=''}
function setMode(next){mode=next;const signup=mode==='signup';$('#loginTab').classList.toggle('active',!signup);$('#signupTab').classList.toggle('active',signup);$('#loginTab').setAttribute('aria-selected',String(!signup));$('#signupTab').setAttribute('aria-selected',String(signup));$('#authTitle').textContent=signup?'Crear cuenta':'Inicia sesión';$('#authSubtitle').textContent=signup?'Registra tu cuenta para acceder a GEOTRACIA.':'Ingresa a tu espacio de trabajo de GEOTRACIA.';$('#signupFields').hidden=!signup;$('#authFullName').required=signup;$('#confirmPasswordWrap').hidden=!signup;$('#authConfirmPassword').required=signup;$('#authPassword').autocomplete=signup?'new-password':'current-password';$('#authSubmit').innerHTML=signup?'Crear cuenta <span>→</span>':'Ingresar <span>→</span>';$('#forgotPassword').hidden=signup;message('');}
$('#loginTab').addEventListener('click',()=>setMode('login'));
$('#signupTab').addEventListener('click',()=>setMode('signup'));
if(!configured||!window.supabase?.createClient){showGate();setup.hidden=false;form.hidden=true}else{
 client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});window.geoSupabase=client;showGate();setup.hidden=true;form.hidden=false;
 client.auth.getSession().then(({data,error})=>{if(error){message('No se pudo verificar la sesión. Revisa la configuración de Supabase.');return}if(data.session)enter(data.session)});
 client.auth.onAuthStateChange((event,session)=>{if(session)enter(session);else if(event==='SIGNED_OUT')showGate()});
 form.addEventListener('submit',async e=>{e.preventDefault();message('');const button=$('#authSubmit');const original=mode==='signup'?'Crear cuenta →':'Ingresar →';button.disabled=true;button.textContent=mode==='signup'?'Creando cuenta…':'Verificando…';
  try{
   const email=$('#authEmail').value.trim();const password=$('#authPassword').value;
   if(mode==='signup'){
    if(password!==$('#authConfirmPassword').value)throw new Error('Las contraseñas no coinciden.');
    const fullName=$('#authFullName').value.trim();const orgName=$('#authOrg').value.trim();
    const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:fullName,organization_name:orgName||null},emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;
    if(data.session){enter(data.session);successMessage('Cuenta creada correctamente.');}
    else successMessage('Cuenta creada. Revisa tu correo para confirmar la dirección antes de iniciar sesión.');
   }else{
    const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;if(data.session)enter(data.session);
   }
  }catch(ex){let msg=ex.message||'No se pudo completar la operación.';if(msg==='Invalid login credentials')msg='Correo o contraseña incorrectos.';else if(/User already registered/i.test(msg))msg='Ya existe una cuenta con ese correo. Inicia sesión.';else if(/Password should be at least/i.test(msg))msg='La contraseña debe tener al menos 6 caracteres.';message(msg)}
  finally{button.disabled=false;button.innerHTML=original}
 });
 $('#forgotPassword').addEventListener('click',async()=>{message('');const email=$('#authEmail').value.trim();if(!email){message('Ingresa tu correo electrónico para enviarte el enlace de recuperación.');return}const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)message(error.message);else successMessage('Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.');});
 const logout=$('#logoutBtn');if(logout)logout.addEventListener('click',async()=>{if(!client)return;logout.disabled=true;const {error}=await client.auth.signOut();logout.disabled=false;if(error)alert('No se pudo cerrar sesión: '+error.message)});
}
})();
