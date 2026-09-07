const plans={
 breakfast:{name:'Breakfast Only Pass',single:50,fifteen:700,monthly:1350},
 lunch:{name:'Lunch Only Pass',single:80,fifteen:1150,monthly:2250},
 dinner:{name:'Dinner Only Pass',single:80,fifteen:1150,monthly:2250},
 breakfastLunch:{name:'Breakfast + Lunch Pass',single:120,fifteen:1750,monthly:3350},
 lunchDinner:{name:'Lunch + Dinner Pass',single:150,fifteen:2150,monthly:4200},
 all:{name:'All-In-One Combo Pass',single:190,fifteen:2750,monthly:5200}
};
let selected={key:'',duration:'',price:0};
const rupees=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const $=id=>document.getElementById(id);

function setStatus(t,cls='status'){
  const s=$('status'); if(!s)return; s.className=cls; s.textContent=t;
}
function selectPass(key,duration){
 const p=plans[key]; selected={key,duration,price:p[duration]};
 $('planKey').value=key; $('duration').value=duration;
 $('selectedPass').textContent=`${p.name} · ${duration==='single'?'Single':duration==='fifteen'?'15 Days':'Monthly'}`;
 $('selectedPrice').textContent=rupees(p[duration]);
 $('passAmount').textContent=rupees(p[duration]);
 const discount=duration==='monthly'?150:0;
 $('discountAmount').textContent=discount?'-'+rupees(discount):rupees(0);
 $('grandTotal').textContent=rupees(Math.max(0,p[duration]-discount+30));
 $('order').scrollIntoView({behavior:'smooth'});
}

const start=$('startDate');
if(start) start.min=new Date().toISOString().split('T')[0];
const nameEl=$('name'),phoneEl=$('phone'),emailEl=$('email'),addressEl=$('address');

$('orderForm')?.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!selected.price){setStatus('Please select a pass first.','status error');return;}
 const auth=await fetch('/api/me');
 if(!auth.ok){setStatus('Please login to continue.','status error');openAccountModal();return;}
 setStatus('Creating secure payment...');
 const customer={name:nameEl.value.trim(),phone:phoneEl.value.trim(),email:emailEl.value.trim(),address:addressEl.value.trim(),startDate:start.value,note:''};
 try{
  const res=await fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planKey:selected.key,duration:selected.duration,customer})});
  const out=await res.json(); if(!res.ok) throw new Error(out.error||'Unable to create payment order.');
  const options={key:out.keyId,amount:out.amount,currency:'INR',name:'Tiffin Mart',description:`${out.planName} - ${out.duration}`,order_id:out.orderId,prefill:{name:customer.name,email:customer.email,contact:customer.phone},notes:{address:customer.address},theme:{color:'#2e7d32'},
   handler:async response=>{
    setStatus('Verifying payment...');
    const vr=await fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...response,orderDetails:{...customer,planKey:selected.key,planName:out.planName,duration:out.duration,base:out.base,discount:out.advanceDiscount,delivery:out.delivery,total:out.amountRupees}})});
    const vd=await vr.json(); if(!vr.ok) throw new Error(vd.error||'Payment verification failed.');
    setStatus(`Payment successful! Order confirmed: ${vd.confirmationId}`,'status ok');
    const invoiceBtn=document.createElement('a'); invoiceBtn.href=vd.invoiceUrl; invoiceBtn.target='_blank'; invoiceBtn.rel='noopener'; invoiceBtn.textContent='📄 View / Print Invoice'; invoiceBtn.className='invoice-link'; invoiceBtn.style.display='inline-block'; invoiceBtn.style.marginTop='10px'; invoiceBtn.style.fontWeight='700'; invoiceBtn.style.textDecoration='none';
    $('status').appendChild(document.createElement('br')); $('status').appendChild(invoiceBtn);
    await loadAccount();
    const msg=encodeURIComponent(`Tiffin Mart Order\nOrder: ${vd.confirmationId}\nName: ${customer.name}\nPass: ${out.planName}\nDuration: ${out.duration}\nAmount: ₹${out.amountRupees}\nStart: ${customer.startDate}\nAddress: ${customer.address}`);
    setTimeout(()=>window.open('https://wa.me/916206652317?text='+msg,'_blank'),400);
   }};
  const rzp=new Razorpay(options); rzp.on('payment.failed',()=>setStatus('Payment failed/cancelled. Please try again.','status error')); rzp.open();
 }catch(err){setStatus(err.message||'Something went wrong.','status error');}
});

// Authentication gate: home content is unavailable until a customer logs in.
(function(){
 const gate=$('authGate'), main=$('home');
 const regTab=$('showGateRegister'), loginTab=$('showGateLogin');
 const regForm=$('gateRegisterForm'), loginForm=$('gateLoginForm');
 const forgotPanel=$('forgotPasswordPanel');
 function unlock(){
   if(gate) gate.style.display='none';
   if(main){main.classList.remove('site-locked');main.style.display='block';}
   loadAccount(); window.scrollTo(0,0);
 }
 function tab(which){
   const r=which==='register';
   if(regForm) regForm.hidden=!r; if(loginForm) loginForm.hidden=r;
   regTab?.classList.toggle('active',r); loginTab?.classList.toggle('active',!r);
   if(forgotPanel) forgotPanel.hidden=true;
 }
 regTab?.addEventListener('click',()=>tab('register'));
 loginTab?.addEventListener('click',()=>tab('login'));
 regForm?.addEventListener('submit',async e=>{
  e.preventDefault(); const st=$('gateRegisterStatus'); st.className='status'; st.textContent='Creating account...';
  try{
   const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('gateRegisterName').value.trim(),phone:$('gateRegisterPhone').value.trim(),email:$('gateRegisterEmail').value.trim(),password:$('gateRegisterPassword').value})});
   const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not create account.');
   st.className='status ok'; st.textContent='Account created successfully. Opening your account...';
   setTimeout(unlock,350);
  }catch(err){st.className='status error';st.textContent=err.message;}
 });
 loginForm?.addEventListener('submit',async e=>{
  e.preventDefault(); const st=$('gateLoginStatus'); st.className='status'; st.textContent='Checking your account...';
  try{
   const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:$('gateLoginPhone').value.trim(),password:$('gateLoginPassword').value})});
   const d=await r.json(); if(!r.ok) throw new Error(d.error||'Login failed');
   st.className='status ok'; st.textContent='✓ Login successful. Welcome back!';
   $('gateLoginPassword').value=''; setTimeout(unlock,350);
  }catch(err){st.className='status error';st.textContent=err.message;}
 });
 $('openForgotPassword')?.addEventListener('click',()=>{forgotPanel.hidden=false;loginForm.hidden=true;});
 $('closeForgotPassword')?.addEventListener('click',()=>{forgotPanel.hidden=true;loginForm.hidden=false;});
 $('forgotPasswordForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const st=$('forgotStatus'); st.className='status'; st.textContent='Sending reset link...';
  try{
   const r=await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:$('forgotPhone').value.trim(),email:$('forgotEmail').value.trim()})});
   const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not send reset link.');
   st.className='status ok'; st.textContent=d.message||'Reset link sent. Check your email.';
  }catch(err){st.className='status error';st.textContent=err.message;}
 });
 const params=new URLSearchParams(location.search), resetToken=params.get('reset');
 if(resetToken){
   if(gate) gate.style.display='none'; $('resetGate').hidden=false;
   $('resetPasswordForm')?.addEventListener('submit',async e=>{
    e.preventDefault(); const st=$('resetStatus'),p1=$('resetPassword').value,p2=$('resetPassword2').value;
    if(p1!==p2){st.className='status error';st.textContent='Passwords do not match.';return;}
    st.className='status';st.textContent='Resetting password...';
    try{
     const r=await fetch('/api/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:resetToken,password:p1})});
     const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not reset password.');
     st.className='status ok';st.textContent='✓ Password reset successful. Opening your account...';
     history.replaceState({},'',location.pathname); setTimeout(()=>{$('resetGate').hidden=true;unlock();},500);
    }catch(err){st.className='status error';st.textContent=err.message;}
   });
 }
 async function checkGate(){try{const r=await fetch('/api/me');if(r.ok)unlock();}catch(e){}}
 checkGate();
})();

// Account drawer/modal
const accountModal=$('accountModal');
function openAccountModal(){ if(accountModal){accountModal.hidden=false;document.body.classList.add('modal-open');loadAccount();} }
function closeAccountModal(){ if(accountModal){accountModal.hidden=true;document.body.classList.remove('modal-open');} }
$('openAccount')?.addEventListener('click',openAccountModal);
$('heroMyAccount')?.addEventListener('click',openAccountModal);
$('closeAccount')?.addEventListener('click',closeAccountModal);
$('accountBackdrop')?.addEventListener('click',closeAccountModal);

document.querySelectorAll('[data-account-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const target=document.querySelector(a.getAttribute('href'));closeAccountModal();setTimeout(()=>target?.scrollIntoView({behavior:'smooth'}),100);}));
$('accountOrdersLink')?.addEventListener('click',e=>{e.preventDefault();const panel=document.querySelector('.account-orders-panel');panel?.scrollIntoView({behavior:'smooth',block:'center'});});
$('accountLogout')?.addEventListener('click',async()=>{await fetch('/api/logout',{method:'POST'});location.reload();});

async function loadAccount(){
 try{
  const r=await fetch('/api/me');
  if(!r.ok)return;
  const me=await r.json();
  $('accountGreeting').textContent=`Welcome, ${me.name}`;
  $('profileView').innerHTML=`<div><span>Full Name</span><b>${escapeHtml(me.name)}</b></div><div><span>Mobile</span><b>${escapeHtml(me.phone)}</b></div><div><span>Email</span><b>${escapeHtml(me.email||'-')}</b></div>`;
  $('editName').value=me.name||''; $('editPhone').value=me.phone||''; $('editEmail').value=me.email||'';
  if(nameEl)nameEl.value=me.name||''; if(phoneEl)phoneEl.value=me.phone||''; if(emailEl)emailEl.value=me.email||'';
  const rr=await fetch('/api/my-orders'); const data=await rr.json();
  const box=$('accountOrders');
  if(!data.orders?.length){box.innerHTML='<p class="tiny">No paid orders yet. Choose a pass to place your first order.</p>';return;}
  const fmt=x=>x?new Date(x+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-';
  box.innerHTML=data.orders.map(o=>`<div class="account-order"><div class="row"><strong>${escapeHtml(o.planName||'-')}</strong><span class="badge-ok">PAID</span></div><div class="row"><span>Order ID</span><b>${escapeHtml(o.confirmationId)}</b></div><div class="row"><span>Valid Till</span><b>${fmt(o.endDate)}</b></div><div class="row"><span>Remaining</span><b>${o.remainingDays} days</b></div><div class="row"><span>Amount</span><b>${rupees(o.total)}</b></div><div class="actions"><a class="btn ghost" href="${o.invoiceUrl}" target="_blank" rel="noopener">📄 Invoice</a></div></div>`).join('');
 }catch(e){console.error(e);}
}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

$('editProfileBtn')?.addEventListener('click',()=>{$('profileEditForm').hidden=false;$('profileView').hidden=true;});
$('cancelEditProfile')?.addEventListener('click',()=>{$('profileEditForm').hidden=true;$('profileView').hidden=false;});
$('profileEditForm')?.addEventListener('submit',async e=>{
 e.preventDefault(); const st=$('profileStatus');st.className='status';st.textContent='Saving changes...';
 try{
  const r=await fetch('/api/me',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('editName').value.trim(),email:$('editEmail').value.trim()})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not update details.');
  st.className='status ok';st.textContent='✓ Details updated.';$('profileEditForm').hidden=true;$('profileView').hidden=false;await loadAccount();
 }catch(err){st.className='status error';st.textContent=err.message;}
});
