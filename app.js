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
 e.preventDefault(); if(!selected.price){setStatus('Please select a pass first.','status error');return;}
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
    const msg=encodeURIComponent(`Tiffin Mart Order\nOrder: ${vd.confirmationId}\nName: ${customer.name}\nPass: ${out.planName}\nDuration: ${out.duration}\nAmount: ₹${out.amountRupees}\nStart: ${customer.startDate}\nAddress: ${customer.address}`);
    setTimeout(()=>window.open('https://wa.me/916206652317?text='+msg,'_blank'),400);
   }};
  const rzp=new Razorpay(options); rzp.on('payment.failed',()=>setStatus('Payment failed/cancelled. Please try again.','status error')); rzp.open();
 }catch(err){setStatus(err.message||'Something went wrong.','status error');}
});
const nameEl=document.getElementById('name'),phoneEl=document.getElementById('phone'),emailEl=document.getElementById('email'),addressEl=document.getElementById('address');
