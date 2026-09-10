const fs = require('fs');

function patchFile(file, replacements) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    if (s.includes(from)) s = s.replace(from, to);
  }
  fs.writeFileSync(file, s);
}

// Keep the owner dashboard public/direct as requested.
patchFile('server.js', [
  ["app.get('/api/admin/summary',requireAdmin,(req,res)=>", "app.get('/api/admin/summary',(req,res)=>"],
  [
    "notes:{plan:plan.name,duration,customer_name:name,phone}",
    "notes:{plan:plan.name,duration,customer_name:name,phone,email:email,address:address,start_date:startDate,note:note}"
  ]
]);

// Native Android checkout support. Desktop/mobile web continues using the normal
// Razorpay Web Checkout; only the Android app switches to native Checkout.
patchFile('public/app.js', [
  [
    "const rupees=n=>'₹'+Number(n||0).toLocaleString('en-IN');",
    "const rupees=n=>'₹'+Number(n||0).toLocaleString('en-IN');\nwindow.__tmNativePaymentSuccess=function(paymentId,orderId){try{window.__tmNativePaymentHandler&&window.__tmNativePaymentHandler({razorpay_payment_id:paymentId,razorpay_order_id:orderId,razorpay_signature:''});}catch(e){console.error(e);}};\nwindow.__tmNativePaymentFailed=function(message){window.__tmNativePayment=false;setStatus(message||'Payment failed or was cancelled.','status error');};"
  ],
  [
    "   const vr=await fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...response,orderDetails:{...customer,planKey:selected.key,planName:out.planName,duration:out.duration,base:out.base,discount:out.advanceDiscount,delivery:out.delivery,total:out.amountRupees}})});",
    "   const verifyEndpoint=window.__tmNativePayment?'/api/verify-native-payment':'/api/verify-payment';\n   const verifyPayload=window.__tmNativePayment?{razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,orderDetails:{...customer,planKey:selected.key,planName:out.planName,duration:out.duration,base:out.base,discount:out.advanceDiscount,delivery:out.delivery,total:out.amountRupees}}:{...response,orderDetails:{...customer,planKey:selected.key,planName:out.planName,duration:out.duration,base:out.base,discount:out.advanceDiscount,delivery:out.delivery,total:out.amountRupees}};\n   const vr=await fetch(verifyEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(verifyPayload)});"
  ],
  [
    "  const rzp=new Razorpay(options); rzp.on('payment.failed',()=>setStatus('Payment failed/cancelled. Please try again.','status error')); rzp.open();",
    "  if(window.TiffinMartNativePayment&&window.__tmNativePaymentAvailable){\n   window.__tmNativePayment=true; window.__tmNativePaymentHandler=options.handler;\n   window.TiffinMartNativePayment.startPayment(JSON.stringify(options));\n   return;\n  }\n  const rzp=new Razorpay(options); rzp.on('payment.failed',()=>setStatus('Payment failed/cancelled. Please try again.','status error')); rzp.open();"
  ]
]);

// Native Android verification: the server asks Razorpay directly whether the
// returned payment belongs to the server-created order and is captured.
patchFile('server.js', [
  [
    "app.post('/api/razorpay-webhook', (req,res)=>{",
    `app.post('/api/verify-native-payment', requireLogin, async (req,res)=>{
  try {
    if(!razorpay) return res.status(503).json({error:'Payment gateway is not configured on the server yet.'});
    const {razorpay_order_id,razorpay_payment_id,orderDetails={}}=req.body||{};
    if(!razorpay_order_id||!razorpay_payment_id) return res.status(400).json({error:'Missing payment details.'});
    if(normalizePhone(orderDetails.phone)!==req.customerPhone) return res.status(403).json({error:'Account mismatch. Please login again.'});
    const payment=await razorpay.payments.fetch(razorpay_payment_id);
    if(String(payment.order_id||'')!==String(razorpay_order_id)) return res.status(400).json({error:'Payment order mismatch.'});
    if(String(payment.status||'')!=='captured') return res.status(400).json({error:'Payment is not captured yet.'});
    const existing=readOrders().find(o=>o.razorpay_payment_id===razorpay_payment_id);
    if(existing){
      const invoiceUrl=\`${process.env.SITE_URL || ''}/invoice/\${existing.confirmationId}/\${invoiceToken(existing.confirmationId)}\`;
      return res.json({ok:true,confirmationId:existing.confirmationId,paymentStatus:existing.paymentStatus,invoiceUrl});
    }
    const confirmationId=\`TM-\${Date.now().toString().slice(-8)}\`;
    const order={confirmationId,paidAt:new Date().toISOString(),status:'paid',paymentStatus:payment.status,razorpay_order_id,razorpay_payment_id,orderDetails};
    saveOrder(order);
    await Promise.allSettled([notifyGoogleSheet(order),notifyEmail(order)]);
    const invoiceUrl=\`${process.env.SITE_URL || ''}/invoice/\${confirmationId}/\${invoiceToken(confirmationId)}\`;
    const wa=\`https://wa.me/916206652317?text=\${encodeURIComponent(\`Tiffin Mart Order\\nOrder: \${confirmationId}\\nName: \${orderDetails.name}\\nPass: \${orderDetails.planName}\\nDuration: \${orderDetails.duration}\\nAmount: ₹\${orderDetails.total}\\nStart: \${orderDetails.startDate}\\nAddress: \${orderDetails.address}\\nInvoice: \${invoiceUrl}\`)}\`;
    res.json({ok:true,confirmationId,paymentStatus:payment.status,whatsappUrl:wa,invoiceUrl});
  } catch(e){ console.error('Native payment verification failed:',e); res.status(500).json({error:'Native payment verification failed.'}); }
});

app.post('/api/razorpay-webhook', (req,res)=>{`
  ]
]);

require('./server.js');
