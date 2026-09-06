let selected={name:"",price:0};
function rupees(n){return "₹"+Number(n).toLocaleString("en-IN")}
function selectPass(name,price){
  selected={name,price};
  document.getElementById("plan").value=name;
  document.getElementById("planPrice").value=price;
  document.getElementById("selectedPass").textContent=name;
  document.getElementById("selectedPrice").textContent=rupees(price);
  document.getElementById("passAmount").textContent=rupees(price);
  document.getElementById("grandTotal").textContent=rupees(price+30);
  document.getElementById("order").scrollIntoView({behavior:"smooth"});
}
document.getElementById("startDate").min=new Date().toISOString().split("T")[0];
document.getElementById("orderForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const status=document.getElementById("status");
  if(!selected.price){status.className="status error";status.textContent="Please select a pass first.";return}
  status.className="status";status.textContent="Creating secure payment...";
  const data=Object.fromEntries(new FormData(e.target).entries());
  try{
    const res=await fetch("/api/create-order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const out=await res.json();
    if(!res.ok) throw new Error(out.message||"Unable to create order");
    const options={
      key:out.keyId,amount:out.amount,currency:"INR",name:"Tiffin Mart",
      description:out.plan,order_id:out.orderId,
      prefill:{name:data.name,email:data.email,contact:data.phone},
      notes:{plan:data.plan,startDate:data.startDate,foodType:data.foodType},
      theme:{color:"#2e7d32"},
      handler:async function(response){
        status.className="status";status.textContent="Verifying payment...";
        const verify=await fetch("/api/verify-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...response,customer:data})});
        const result=await verify.json();
        if(!verify.ok) throw new Error(result.message||"Payment verification failed");
        status.className="status ok";
        status.innerHTML="Payment successful 🎉 Your Tiffin Pass is confirmed. Order ID: "+result.orderId;
        e.target.reset(); selected={name:"",price:0};
      },
      modal:{ondismiss:function(){status.className="status";status.textContent="Payment window closed. You can try again."}}
    };
    new Razorpay(options).open();
  }catch(err){status.className="status error";status.textContent=err.message}
});
