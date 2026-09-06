require("dotenv").config();
const express=require("express");
const crypto=require("crypto");
const Razorpay=require("razorpay");
const path=require("path");
const app=express();
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const PORT=process.env.PORT||3000;
const KEY_ID=process.env.RAZORPAY_KEY_ID;
const KEY_SECRET=process.env.RAZORPAY_KEY_SECRET;
if(!KEY_ID||!KEY_SECRET) console.warn("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env before live payments.");

const razorpay=new Razorpay({key_id:KEY_ID||"dummy",key_secret:KEY_SECRET||"dummy"});

app.post("/api/create-order",async(req,res)=>{
  try{
    const {plan,planPrice,name,phone,email,address,startDate,foodType}=req.body;
    if(!plan||!planPrice||!name||!phone||!email||!address||!startDate) return res.status(400).json({message:"Please fill all required details."});
    const amount=Math.round((Number(planPrice)+30)*100);
    if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({message:"Invalid amount."});
    const order=await razorpay.orders.create({amount,currency:"INR",receipt:"TM_"+Date.now(),notes:{plan,name,phone,email,address,startDate,foodType}});
    res.json({keyId:KEY_ID,orderId:order.id,amount:order.amount,plan});
  }catch(err){console.error(err);res.status(500).json({message:"Could not create payment order."});}
});

app.post("/api/verify-payment",async(req,res)=>{
  try{
    const {razorpay_order_id,razorpay_payment_id,razorpay_signature,customer}=req.body;
    if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature) return res.status(400).json({message:"Incomplete payment response."});
    const expected=crypto.createHmac("sha256",KEY_SECRET).update(razorpay_order_id+"|"+razorpay_payment_id).digest("hex");
    if(expected!==razorpay_signature) return res.status(400).json({message:"Payment signature verification failed."});
    // TODO: Save the paid order to Google Sheets / email / WhatsApp automation.
    console.log("PAID ORDER",JSON.stringify({orderId:razorpay_order_id,paymentId:razorpay_payment_id,customer}));
    res.json({orderId:razorpay_order_id,paymentId:razorpay_payment_id});
  }catch(err){console.error(err);res.status(500).json({message:"Verification error."});}
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Tiffin Mart running on port ${PORT}`));
