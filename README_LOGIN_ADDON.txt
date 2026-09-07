TIFFIN MART CUSTOMER LOGIN/PASSWORD UPDATE

Features added:
- Customer login with mobile number + password.
- Passwords are securely hashed with Node.js crypto.scrypt; plain passwords are not stored.
- New customer account is created automatically after successful payment using the password entered on the order form.
- Existing customer must use the same mobile number and account password for future orders.
- Secure HTTP-only session cookie.
- My Account section shows customer's paid orders and invoice links.
- Logout button.

IMPORTANT DEPLOYMENT:
1. Replace ROOT server.js in GitHub.
2. Replace public/index.html, public/app.js, and public/styles.css inside the public folder.
3. Commit changes and let Railway redeploy.
4. Test with a small payment.

NOTE: This version continues using local JSON files like the existing app. On Railway, local filesystem data can be lost on redeploy/restart unless persistent storage/database is configured. For production-scale customer accounts and orders, use a database (e.g. PostgreSQL) or persistent volume.
