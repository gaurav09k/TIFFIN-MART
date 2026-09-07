const plans={
 breakfast:{name:'Breakfast Only Pass',single:50,fifteen:700,monthly:1350},
 lunch:{name:'Lunch Only Pass',single:80,fifteen:1150,monthly:2250},
 dinner:{name:'Dinner Only Pass',single:80,fifteen:1150,monthly:2250},
 breakfastLunch:{name:'Breakfast + Lunch Pass',single:120,fifteen:1750,monthly:3350},
 lunchDinner:{name:'Lunch + Dinner Pass',single:150,fifteen:2150,monthly:4200},
 all:{name:'All-In-One Combo Pass',single:190,fifteen:2750,monthly:5200}
};
let selected={key:'',duration:'',price:0};
const rupees=n=>'₹'+Number(n).toLocaleString('en-IN');
function selectPass(key,duration){
 const p=plans[key]; selected={key,duration,price:p[duration]};
 document.getElementById('planKey').value=key; document.getElementById('duration').value=duration;
 document.getElementById('selectedPass').textContent=`${p.name} · ${duration==='single'?'Single':duration==='fifteen'?'15 Days':'Monthly'}`;
 document.getElementById('selectedPrice').textContent=rupees(p[duration]);
 document.getElementById('passAmount').textContent=rupees(p[duration]);
 const discount=duration==='monthly'?150:0;
 document.getElementById('discountAmount').textContent=discount?'-'+rupees(discount):rupees(0);
 document.getElementById('grandTotal').textContent=rupees(Math.max(0,p[duration]-discount+30));
 document.getElementById('order').scrollIntoView({behavior:'smooth'});
}
const start=document.getElementById('startDate'); start.min=new Date().toISOString().split('T')[0];
function setStatus(t,cls='status'){const s=document.getElementById('status');s.className=cls;s.textContent=t;}
document.getElementById('orderForm').addEventListener('submit',async e=>{
 e.preventDefault(); if(!selected.price){setStatus('Please select a pass first.','status error');return;} const auth=await fetch('/api/me'); if(!auth.ok){setStatus('Please create an account or login first.','status error');document.getElementById('account').scrollIntoView({behavior:'smooth'});return;}
 setStatus('Creating secure payment...');
 const customer={name:nameEl.value.trim(),phone:phoneEl.value.trim(),email:emailEl.value.trim(),address:addressEl.value.trim(),startDate:start.value,note:''};
 try{
  const res=await fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planKey:selected.key,duration:selected.duration,customer})});
  const out=await res.json(); if(!res.ok) throw new Error(out.error||'Unable to create payment order.');
  const options={key:out.keyId,amount:out.amount,currency:'INR',name:'Tiffin Mart',description:`${out.planName} - ${out.duration}`,order_id:out.orderId,prefill:{name:customer.name,email:customer.email,contact:customer.phone},notes:{address:customer.address},theme:{color:'#2e7d32'},
   handler:async response=>{setStatus('Verifying payment...');
    const vr=await fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...response,orderDetails:{...customer,planKey:selected.key,planName:out.planName,duration:out.duration,base:out.base,discount:out.advanceDiscount,delivery:out.delivery,total:out.amountRupees}})});
    const vd=await vr.json(); if(!vr.ok) throw new Error(vd.error||'Payment verification failed.');
    setStatus(`Payment successful! Order confirmed: ${vd.confirmationId}`,'status ok');
    const invoiceBtn=document.createElement('a'); invoiceBtn.href=vd.invoiceUrl; invoiceBtn.target='_blank'; invoiceBtn.rel='noopener'; invoiceBtn.textContent='📄 View / Print Invoice'; invoiceBtn.className='invoice-link'; invoiceBtn.style.display='inline-block'; invoiceBtn.style.marginTop='10px'; invoiceBtn.style.fontWeight='700'; invoiceBtn.style.textDecoration='none'; document.getElementById('status').appendChild(document.createElement('br')); document.getElementById('status').appendChild(invoiceBtn);
    const msg=encodeURIComponent(`Tiffin Mart Order\nOrder: ${vd.confirmationId}\nName: ${customer.name}\nPass: ${out.planName}\nDuration: ${out.duration}\nAmount: ₹${out.amountRupees}\nStart: ${customer.startDate}\nAddress: ${customer.address}`);
    setTimeout(()=>window.open('https://wa.me/916206652317?text='+msg,'_blank'),400);
   }};
  const rzp=new Razorpay(options); rzp.on('payment.failed',()=>setStatus('Payment failed/cancelled. Please try again.','status error')); rzp.open();
 }catch(err){setStatus(err.message||'Something went wrong.','status error');}
});
const nameEl=document.getElementById('name'),phoneEl=document.getElementById('phone'),emailEl=document.getElementById('email'),addressEl=document.getElementById('address');


// Mandatory authentication gate: no home/menu/pass content is visible until customer is logged in.
(function(){
  const gate=document.getElementById('authGate');
  const main=document.getElementById('home');
  const regTab=document.getElementById('showGateRegister');
  const loginTab=document.getElementById('showGateLogin');
  const regForm=document.getElementById('gateRegisterForm');
  const loginForm=document.getElementById('gateLoginForm');
  function unlock(){ gate.style.display='none'; main.classList.remove('site-locked'); main.style.display='block'; if(typeof loadAccount==='function') loadAccount(); window.scrollTo(0,0); }
  function tab(which){ const r=which==='register'; regForm.hidden=!r; loginForm.hidden=r; regTab.classList.toggle('active',r); loginTab.classList.toggle('active',!r); }
  regTab?.addEventListener('click',()=>tab('register')); loginTab?.addEventListener('click',()=>tab('login'));
  regForm?.addEventListener('submit',async e=>{ e.preventDefault(); const st=document.getElementById('gateRegisterStatus'); st.className='status'; st.textContent='Creating account...'; try{ const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:gateRegisterName.value.trim(),phone:gateRegisterPhone.value.trim(),email:gateRegisterEmail.value.trim(),password:gateRegisterPassword.value})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not create account.'); st.className='status ok'; st.textContent='Account created. Opening Tiffin Mart...'; setTimeout(unlock,350); }catch(err){st.className='status error';st.textContent=err.message;} });
  loginForm?.addEventListener('submit',async e=>{ e.preventDefault(); const st=document.getElementById('gateLoginStatus'); st.className='status'; st.textContent='Logging in...'; try{ const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:gateLoginPhone.value.trim(),password:gateLoginPassword.value})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Login failed'); st.className='status ok'; st.textContent='Login successful. Opening Tiffin Mart...'; setTimeout(unlock,350); }catch(err){st.className='status error';st.textContent=err.message;} });
  const forgotPanel=document.getElementById('forgotPasswordPanel');
  document.getElementById('openForgotPassword')?.addEventListener('click',()=>{forgotPanel.hidden=false;loginForm.hidden=true;});
  document.getElementById('closeForgotPassword')?.addEventListener('click',()=>{forgotPanel.hidden=true;loginForm.hidden=false;});
  document.getElementById('forgotPasswordForm')?.addEventListener('submit',async e=>{e.preventDefault();const st=document.getElementById('forgotStatus');st.className='status';st.textContent='Sending reset link...';try{const r=await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('forgotPhone').value.trim(),email:document.getElementById('forgotEmail').value.trim()})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not send reset link.');st.className='status ok';st.textContent=d.message||'Reset link sent. Check your email.';}catch(err){st.className='status error';st.textContent=err.message;}});
  const params=new URLSearchParams(location.search); const resetToken=params.get('reset');
  if(resetToken){gate.style.display='none';document.getElementById('resetGate').hidden=false;document.getElementById('resetPasswordForm')?.addEventListener('submit',async e=>{e.preventDefault();const st=document.getElementById('resetStatus');const p1=document.getElementById('resetPassword').value;const p2=document.getElementById('resetPassword2').value;if(p1!==p2){st.className='status error';st.textContent='Passwords do not match.';return;}st.className='status';st.textContent='Resetting password...';try{const r=await fetch('/api/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:resetToken,password:p1})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not reset password.');st.className='status ok';st.textContent='Password reset successful. Opening Tiffin Mart...';history.replaceState({},'',location.pathname);setTimeout(()=>{document.getElementById('resetGate').hidden=true;unlock();},500);}catch(err){st.className='status error';st.textContent=err.message;}});}

  async function checkGate(){ try{const r=await fetch('/api/me'); if(r.ok) unlock();}catch(e){} }
  checkGate();
})();

// Customer account: create once, then login on future visits
async function loadAccount(){
  const r=await fetch('/api/me');
  const registerForm=document.getElementById('registerForm');
  const loginForm=document.getElementById('loginForm');
  const notice=document.getElementById('orderAuthNotice');
  if(!r.ok){
    document.getElementById('accountGreeting').textContent='Create an account first, or login if you already have one.';
    document.getElementById('logoutBtn').hidden=true;
    notice.textContent='Please create an account or login before placing an order.';
    notice.className='status error';
    if(registerForm) registerForm.hidden=false;
    if(loginForm) loginForm.hidden=false;
    return;
  }
  const me=await r.json();
  document.getElementById('accountGreeting').textContent=`Welcome, ${me.name}. Mobile: ${me.phone}`; if(document.getElementById('name')) document.getElementById('name').value=me.name||''; if(document.getElementById('phone')) document.getElementById('phone').value=me.phone||''; if(document.getElementById('email')) document.getElementById('email').value=me.email||'';
  document.getElementById('logoutBtn').hidden=false;
  if(registerForm) registerForm.hidden=true;
  if(loginForm){
    loginForm.querySelector('h3').textContent='You are logged in';
    loginForm.querySelectorAll('label').forEach(x=>x.hidden=true);
    loginForm.querySelector('button[type="submit"]').hidden=true;
  }
  notice.textContent='Account verified. You can now choose a pass and place your order.';
  notice.className='status ok';
  const rr=await fetch('/api/my-orders'); const data=await rr.json();
  const box=document.getElementById('accountOrders');
  if(!data.orders?.length){box.innerHTML='<p class="tiny">No paid orders found yet.</p>';return;}
  const fmt=x=>x?new Date(x+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-';
  box.innerHTML=data.orders.map(o=>`<div class="account-order"><div class="row"><strong>${o.planName||'-'}</strong><span class="badge-ok">PAID</span></div><div class="row"><span>Order ID</span><b>${o.confirmationId}</b></div><div class="row"><span>Valid Till</span><b>${fmt(o.endDate)}</b></div><div class="row"><span>Remaining</span><b>${o.remainingDays} days</b></div><div class="row"><span>Amount</span><b>₹${Number(o.total||0).toLocaleString('en-IN')}</b></div><div class="actions"><a class="btn ghost" href="${o.invoiceUrl}" target="_blank" rel="noopener">📄 Invoice</a></div></div>`).join('');
}
const registerForm=document.getElementById('registerForm');
if(registerForm){
 registerForm.addEventListener('submit',async e=>{
   e.preventDefault();
   const st=document.getElementById('registerStatus'); st.className='status'; st.textContent='Creating account...';
   try{
     const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('registerName').value.trim(),phone:document.getElementById('registerPhone').value.trim(),email:document.getElementById('registerEmail').value.trim(),password:document.getElementById('registerPassword').value})});
     const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not create account.');
     st.className='status ok'; st.textContent='Account created successfully. You are logged in.';
     document.getElementById('registerPassword').value='';
     await loadAccount();
     document.getElementById('passes').scrollIntoView({behavior:'smooth'});
   }catch(err){st.className='status error';st.textContent=err.message;}
 });
}
const loginForm=document.getElementById('loginForm');
if(loginForm){
 loginForm.addEventListener('submit',async e=>{e.preventDefault();const st=document.getElementById('loginStatus');st.className='status';st.textContent='Logging in...';try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('loginPhone').value.trim(),password:document.getElementById('loginPassword').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Login failed');st.className='status ok';st.textContent='Login successful.';document.getElementById('loginPassword').value='';await loadAccount();document.getElementById('passes').scrollIntoView({behavior:'smooth'});}catch(err){st.className='status error';st.textContent=err.message;}});
 document.getElementById('logoutBtn').addEventListener('click',async()=>{await fetch('/api/logout',{method:'POST'});location.reload();});
 loadAccount();
}

// Customer order lookup
const lookupForm=document.getElementById('lookupForm');
if(lookupForm){
  lookupForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const status=document.getElementById('lookupStatus'), result=document.getElementById('orderResult');
    status.className='status'; status.textContent='Order details loading...'; result.hidden=true; result.innerHTML='';
    try{
      const orderId=document.getElementById('lookupOrderId').value.trim();
      const phone=document.getElementById('lookupPhone').value.trim();
      const r=await fetch(`/api/order?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`);
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Order not found.');
      const o=d.orderDetails||{};
      const money=rupees(o.total||0);
      const durationLabel=d.totalDays===1?'Single':d.totalDays===15?'15 Days':'Monthly';
      const fmt=x=>x?new Date(x+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-';
      result.innerHTML=`<div class="result-head"><div><span>Order ID</span><strong>${d.confirmationId}</strong></div><span class="badge-ok">PAID</span></div><div class="result-grid"><div><span>Pass</span><b>${o.planName||'-'}</b></div><div><span>Duration</span><b>${durationLabel}</b></div><div><span>Start Date</span><b>${fmt(d.startDate)}</b></div><div><span>Valid Till</span><b>${fmt(d.endDate)}</b></div><div><span>Amount Paid</span><b>${money}</b></div><div><span>Remaining</span><b>${d.remainingDays} day${d.remainingDays===1?'':'s'}</b></div><div class="full"><span>Delivery Address</span><b>${o.address||'-'}</b></div></div><p class="tiny">For any change, pause request or support, WhatsApp Tiffin Mart on 6206652317.</p>`;
      result.hidden=false; status.className='status ok'; status.textContent='Order found successfully.';
    }catch(err){status.className='status error';status.textContent=err.message||'Something went wrong.';}
  });
}
