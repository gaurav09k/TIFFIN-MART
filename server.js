const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
require('dotenv').config();
const Razorpay = require('razorpay');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

const plans = {
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

function invoiceToken(confirmationId) {
  const secret = process.env.RAZORPAY_KEY_SECRET || process.env.INVOICE_SECRET || 'tiffin-mart-invoice-secret';
  return crypto.createHmac('sha256', secret).update(String(confirmationId)).digest('hex').slice(0,32);
}

function buildInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    try {
      const d = order.orderDetails || {};
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = n => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
      const duration = d.duration === 'single' ? 'Single' : d.duration === 'fifteen' ? '15 Days' : 'Monthly';
      doc.fontSize(24).font('Helvetica-Bold').text('TIFFIN MART');
      doc.fontSize(11).font('Helvetica').text('Ghar Ka Swad, Har Din.');
      doc.moveDown(1);
      doc.fontSize(18).font('Helvetica-Bold').text('PAYMENT INVOICE');
      doc.moveDown(0.7);
      doc.fontSize(10).font('Helvetica')
        .text(`Invoice / Order ID: ${order.confirmationId}`)
        .text(`Payment ID: ${order.razorpay_payment_id || '-'}`)
        .text(`Payment Date: ${new Date(order.paidAt).toLocaleString('en-IN')}`);
      doc.moveDown(1);
      doc.font('Helvetica-Bold').text('Customer Details');
      doc.font('Helvetica')
        .text(`Name: ${d.name || '-'}`)
        .text(`Mobile: ${d.phone || '-'}`)
        .text(`Email: ${d.email || '-'}`)
        .text(`Delivery Address: ${d.address || '-'}`);
      doc.moveDown(1);
      doc.font('Helvetica-Bold').text('Order Details');
      doc.font('Helvetica')
        .text(`Pass: ${d.planName || '-'}`)
        .text(`Duration: ${duration}`)
        .text(`Start Date: ${d.startDate || '-'}`);
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').text(`Pass Price: ${money(d.base)}`);
      if (Number(d.discount || 0) > 0) doc.font('Helvetica').text(`Advance Discount: -${money(d.discount)}`);
      doc.font('Helvetica').text(`Delivery Charge: ${money(d.delivery)}`);
      doc.fontSize(14).font('Helvetica-Bold').text(`TOTAL PAID: ${money(d.total)}`);
      doc.moveDown(1.5);
      doc.fontSize(10).font('Helvetica').text('Payment Status: PAID');
      doc.text('Thank you for choosing Tiffin Mart.');
      doc.text('Fresh, Pure & Hygienic Home-Style Food Delivery Service');
      doc.end();
    } catch (e) { reject(e); }
  });
}

async function notifyEmail(order) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT||587), secure: String(process.env.SMTP_SECURE).toLowerCase()==='true', auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS} });
    const d = order.orderDetails || {};
    const invoicePdf = await buildInvoicePdf(order);
    const recipients = [process.env.ORDER_EMAIL_TO, d.email].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(',');
    if (!recipients) return;
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: recipients,
      subject:`Tiffin Mart Invoice ${order.confirmationId}`,
      text:`Thank you for your payment. Your Tiffin Mart invoice is attached.\n\nOrder: ${order.confirmationId}\nName: ${d.name}\nPass: ${d.planName}\nAmount Paid: Rs. ${d.total}`,
      attachments:[{filename:`Tiffin-Mart-Invoice-${order.confirmationId}.pdf`,content:invoicePdf,contentType:'application/pdf'}]
    });
  } catch (e) { console.error('Invoice email failed:', e.message); }
}

app.get('/api/config', (req,res)=>res.json({keyId:process.env.RAZORPAY_KEY_ID||'', currency:'INR', razorpayReady:!!razorpay}));
app.get('/api/plans', (req,res)=>res.json(plans));
app.get('/api/order', (req,res)=>{
  try {
    const confirmationId=clean(req.query.orderId,40);
    const phone=String(req.query.phone||'').replace(/[\s-]/g,'');
    if(!confirmationId || !phoneOk(phone)) return res.status(400).json({error:'Please enter a valid Order ID and mobile number.'});
    const order=readOrders().find(o=>o.confirmationId===confirmationId && String(o.orderDetails?.phone||'').replace(/[\s-]/g,'')===phone);
    if(!order) return res.status(404).json({error:'Order not found. Please check your Order ID and mobile number.'});
    const d=order.orderDetails||{};
    const days=d.duration==='single'?1:d.duration==='fifteen'?15:30;
    const start=new Date(`${d.startDate}T00:00:00`);
    const end=new Date(start); end.setDate(end.getDate()+days-1);
    const today=new Date(); today.setHours(0,0,0,0);
    const remaining=Math.max(0, Math.ceil((end-today)/86400000));
    res.json({confirmationId:order.confirmationId,status:order.status,paymentStatus:order.paymentStatus,paidAt:order.paidAt,orderDetails:d,startDate:d.startDate,endDate:end.toISOString().slice(0,10),totalDays:days,remainingDays:remaining});
  } catch(e){ console.error(e); res.status(500).json({error:'Could not find the order.'}); }
});

app.get('/invoice/:confirmationId/:token', async (req,res)=>{
  try {
    const id=clean(req.params.confirmationId,40);
    const token=clean(req.params.token,64);
    if(!id || token!==invoiceToken(id)) return res.status(404).send('Invoice not found');
    const order=readOrders().find(o=>o.confirmationId===id);
    if(!order) return res.status(404).send('Invoice not found');
    const pdf=await buildInvoicePdf(order);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`inline; filename="Tiffin-Mart-Invoice-${id}.pdf"`);
    res.send(pdf);
  } catch(e){ console.error('Invoice generation failed:',e); res.status(500).send('Could not generate invoice.'); }
});

app.post('/api/create-order', async (req,res)=>{
  try {
    if (!razorpay) return res.status(503).json({error:'Payment gateway is not configured on the server yet.'});
    const {planKey,duration,customer={}} = req.body || {};
    const plan=plans[planKey];
    if(!plan || !['single','fifteen','monthly'].includes(duration)) return res.status(400).json({error:'Invalid pass selected.'});
    const name=clean(customer.name,100), phone=clean(customer.phone,20), email=clean(customer.email,150), address=clean(customer.address,600), startDate=clean(customer.startDate,20), note=clean(customer.note,500);
    if(!name || !phone || !address || !startDate) return res.status(400).json({error:'Please fill name, phone, start date and delivery address.'});
    if(!phoneOk(phone)) return res.status(400).json({error:'Please enter a valid mobile number.'});
    const base=plan[duration], advanceDiscount=(duration==='monthly')?150:0, delivery=30, total=Math.max(0,base-advanceDiscount+delivery);
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
    const invoiceUrl=`${process.env.SITE_URL || ''}/invoice/${confirmationId}/${invoiceToken(confirmationId)}`;
    const wa=`https://wa.me/916206652317?text=${encodeURIComponent(`Tiffin Mart Order\nOrder: ${confirmationId}\nName: ${orderDetails.name}\nPass: ${orderDetails.planName}\nDuration: ${orderDetails.duration}\nAmount: ₹${orderDetails.total}\nStart: ${orderDetails.startDate}\nAddress: ${orderDetails.address}\nInvoice: ${invoiceUrl}`)}`;
    res.json({ok:true,confirmationId,paymentStatus,whatsappUrl:wa,invoiceUrl});
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
