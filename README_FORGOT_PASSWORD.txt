TIFFIN MART – LOGIN + FORGOT PASSWORD

Flow:
1. Website opens on Login/Create Account screen.
2. New customer creates account once with mobile, email and password.
3. Existing customer logs in with mobile + password.
4. Forgot Password asks for registered mobile + email and sends a secure 30-minute reset link to the registered email.
5. Customer sets a new password and is logged in automatically.

IMPORTANT:
- Forgot Password email requires Gmail SMTP variables in Railway:
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=465
  SMTP_SECURE=true
  SMTP_USER=tiffinmartgks@gmail.com
  SMTP_PASS=<Gmail App Password>
- Never share SMTP_PASS in chat.
- Replace ROOT server.js and public/index.html, public/app.js, public/styles.css.
- Existing customers created by this version remain compatible; the login counter save bug is also fixed.
