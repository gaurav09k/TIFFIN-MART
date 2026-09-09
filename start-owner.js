const fs = require('fs');
const path = require('path');
const main = path.join(__dirname, 'server.js');
const patched = path.join(__dirname, '.server-password-patched.js');
let s = fs.readFileSync(main, 'utf8');
if (!s.includes("app.post('/api/admin/login'")) {
  const marker = "app.get('/api/admin/status'";
  const i = s.indexOf(marker);
  if (i < 0) throw new Error('Admin status route not found');
  const route = `app.post('/api/admin/login',(req,res)=>{\n  const mobile=normalizePhone(req.body?.mobile||'');\n  const password=String(req.body?.password||'');\n  const adminPassword=getAdminPassword();\n  if(!adminPassword) return res.status(503).json({error:'Admin password is not available to the running server. Check the production service variable ADMIN_PASSWORD and redeploy.'});\n  if(mobile !== ADMIN_MOBILE) return res.status(401).json({error:'Invalid admin mobile number.'});\n  const a=Buffer.from(password), b=Buffer.from(adminPassword);\n  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'Invalid admin password.'});\n  setAdminCookie(res,newAdminSession());\n  res.json({ok:true});\n});\n`;
  s = s.slice(0, i) + route + s.slice(i);
}
fs.writeFileSync(patched, s);
require(patched);
