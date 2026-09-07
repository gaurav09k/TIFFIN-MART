TIFFIN MART – ACCOUNT UI + ADMIN DASHBOARD

Customer UI
- After login, the home page header shows only My Account on the right.
- Clicking My Account opens a drawer containing Passes, Menu, Benefits, My Order, Terms & Conditions, Privacy Policy and Refund/Cancellation.
- Customer name, mobile and email are shown only inside My Account.
- Customer can edit name and email from My Account. Mobile is kept fixed for account identity.
- My Orders and invoice links are shown inside My Account.

Admin dashboard
1. In Railway > Variables add:
   ADMIN_PASSWORD = a strong private admin password
2. Deploy the latest code.
3. Open: https://YOUR-RAILWAY-DOMAIN/admin.html
4. Enter ADMIN_PASSWORD.
5. Dashboard shows total customers, total logins, paid orders, unique pass buyers, revenue, and customer rows with registration time, login count, last login, order count, last pass and last amount.

Do not put ADMIN_PASSWORD in GitHub. Keep it only in Railway Variables.

Important storage note
The current app stores customers/orders/sessions in JSON files under /data. On Railway, local filesystem data may not survive a redeploy/restart unless persistent storage is configured. For permanent production customer history and reporting, use a database (PostgreSQL is recommended) or a properly configured persistent volume.
