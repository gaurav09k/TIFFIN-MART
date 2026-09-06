const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
require('dotenv').config();
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

const plans = {
  test: { name: 'TEST PAYMENT (Temporary)', meal: 'Test', single: 1, fifteen: 1, monthly: 1, test: true },
  breakfast: { name: 'Breakfast Only Pass', meal: 'Breakfast', single: 50, fifteen: 700, monthly: 1350 },
  lunch: { name: 'Lunch Only Pass', meal: 'Lunch', single: 80, fifteen: 1150, monthly: 2250 },
  dinner: { name: 'Dinner Only Pass', meal: 'Dinner', single: 80, fifteen: 1150, monthly: 2250 },
  breakfastLunch: { name: 'Breakfast + Lunch Pass', meal: 'Breakfast + Lunch', single: 120, fifteen: 1750, monthly: 3350 },
  lunchDinner: { name: 'Lunch + Dinner Pass', meal: 'Lunch + Dinner', single: 150, fifteen: 2150, monthly: 4200 },
  all: { name: 'All-In-One Combo Pass', meal: 'Breakfast + Lunch + Dinner', single: 190, fifteen: 2750, monthly: 5200 }
};

const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) : null;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readOrders() { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
function saveOrder(order) {
  const all = readOrders(); all.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(all, null, 2));
}
function clean(v, max=500) { return String(v ?? '').trim().slice(0, max); }
function phoneOk(v) { return /^\+?\d{10,15}$/.test(String(v).replace(/[\s-]/g,'')); }

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', port: u.port || 443,
      headers: { 'Content-Type':'application/json', 'Content-Length': data.length } }, res => {
      let out=''; res.on('data',c=>out+=c); res.on('end',()=>resolve({status:res.statusCode, body:out}));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function notifyGoogleSheet(order) {
  if (!process.env.GOOGLE_SHEET_WEBHOOK_URL) return;
  try { await postJson(process.env.GOOGLE_SHEET_WEBHOOK_URL, order); }
  catch (e) { console.error('Google Sheet notification failed:', e.message); }
}

async function notifyEmail(order) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ORDER_EMAIL_TO) return;
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT||587), secure: String(process.env.SMTP_SECURE).toLowerCase()==='true', auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS} });
    await transporter.sendMail({ from: process.env.SMTP_USER, to: process.env.ORDER_EMAIL_TO, subject:`Tiffin Mart Paid Order ${order.confirmationId}`, text:`Order ${order.confirmationId}\nName: ${order.orderDetails.name}\nPhone: ${order.orderDetails.phone}\nPass: ${order.orderDetails.planName}\nDuration: ${order.orderDetails.duration}\nAmount: ₹${order.orderDetails.total}\nStart: ${order.orderDetails.startDate}\nAddress: ${order.orderDetails.address}` });
  } catch (e) { console.error('Email notification failed:', e.message); }
}

app.get('/api/config', (req,res)=>res.json({keyId:process.env.RAZORPAY_KEY_ID||'', currency:'INR', razorpayReady:!!razorpay}));
app.get('/api/plans', (req,res)=>res.json(plans));

app.post('/api/create-order', async (req,res)=>{
  try {
    if (!razorpay) return res.status(503).json({error:'Payment gateway is not configured on the server yet.'});
    const {planKey,duration,customer={}} = req.body || {};
    const plan=plans[planKey];
    if(!plan || !['single','fifteen','monthly'].includes(duration)) return res.status(400).json({error:'Invalid pass selected.'});
    const name=clean(customer.name,100), phone=clean(customer.phone,20), email=clean(customer.email,150), address=clean(customer.address,600), startDate=clean(customer.startDate,20), note=clean(customer.note,500);
    if(!name || !phone || !address || !startDate) return res.status(400).json({error:'Please fill name, phone, start date and delivery address.'});
    if(!phoneOk(phone)) return res.status(400).json({error:'Please enter a valid mobile number.'});
    const base=plan[duration], advanceDiscount=(duration==='monthly' && !plan.test)?150:0, delivery=plan.test?0:30, total=Math.max(0,base-advanceDiscount+delivery);
    const receipt=`TM-${Date.now()}`;
    const order=await razorpay.orders.create({amount:total*100,currency:'INR',receipt,notes:{plan:plan.name,duration,customer_name:name,phone}});
    res.json({orderId:order.id,amount:total*100,amountRupees:total,keyId:process.env.RAZORPAY_KEY_ID,planName:plan.name,duration,base,advanceDiscount,delivery,customer:{name,phone,email,address,startDate,note}});
  } catch(e){ console.error(e); res.status(500).json({error:'Could not create payment order.'}); }
});

app.post('/api/verify-payment', async (req,res)=>{
  try {
    if(!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({error:'Payment gateway secret is not configured.'});
    const {razorpay_order_id,razorpay_payment_id,razorpay_signature,orderDetails={}}=req.body||{};
    if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature) return res.status(400).json({error:'Missing payment details.'});
    const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a=Buffer.from(expected,'hex'), b=Buffer.from(razorpay_signature,'hex');
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return res.status(400).json({error:'Payment verification failed.'});

    let paymentStatus='unknown';
    if(razorpay){ try { const p=await razorpay.payments.fetch(razorpay_payment_id); paymentStatus=p.status; } catch(e){ console.error('Payment status lookup failed:',e.message); } }
    const confirmationId=`TM-${Date.now().toString().slice(-8)}`;
    const order={confirmationId,paidAt:new Date().toISOString(),status:'paid',paymentStatus,razorpay_order_id,razorpay_payment_id,orderDetails};
    saveOrder(order);
    await Promise.allSettled([notifyGoogleSheet(order),notifyEmail(order)]);
    const wa=`https://wa.me/916206652317?text=${encodeURIComponent(`Tiffin Mart Order\nOrder: ${confirmationId}\nName: ${orderDetails.name}\nPass: ${orderDetails.planName}\nDuration: ${orderDetails.duration}\nAmount: ₹${orderDetails.total}\nStart: ${orderDetails.startDate}\nAddress: ${orderDetails.address}`)}`;
    res.json({ok:true,confirmationId,paymentStatus,whatsappUrl:wa});
  } catch(e){ console.error(e); res.status(500).json({error:'Verification error.'}); }
});

app.post('/api/razorpay-webhook', (req,res)=>{
  if(!process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).send('Webhook secret not configured');
  const signature=req.headers['x-razorpay-signature']||'';
  const raw=JSON.stringify(req.body);
  const expected=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const a=Buffer.from(expected), b=Buffer.from(signature); if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(400).send('Invalid signature');
  console.log('Razorpay webhook:', req.body?.event); res.json({ok:true});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`Tiffin Mart running on port ${PORT}`));
