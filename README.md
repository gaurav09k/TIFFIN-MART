# Tiffin Mart — Online Pass + Razorpay

Production-ready Node/Express website for Tiffin Mart, Giridih.

## Included
- Correct Tiffin Mart pass prices
- Monthly ₹150 advance discount
- ₹30 delivery charge
- Customer + delivery form
- Razorpay Standard Checkout
- Server-side Razorpay order creation
- Server-side payment signature verification
- Local order backup
- WhatsApp confirmation link after payment
- Optional Google Sheets webhook integration
- Optional email notification via SMTP
- Terms, Privacy, Refund/Cancellation, Contact pages

## IMPORTANT
Never put `RAZORPAY_KEY_SECRET` in browser code and never share it in chat. Add it only as a private server environment variable on your hosting provider.

## Local test
1. Install Node.js 18+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put Razorpay TEST Key ID and TEST Key Secret in `.env`.
5. Run `npm start`.
6. Open http://localhost:3000.

## Live deployment
Recommended: Render / Railway / another Node.js host.
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: see `.env.example`
- Set `SITE_URL` to your live HTTPS URL.
- Add your live website URL in Razorpay Dashboard → Account & Settings → Business website detail.
- Generate Live API Keys only after Razorpay activates the website/payment gateway.

## Optional Google Sheets
Create a Google Apps Script web app that accepts POST JSON and appends rows to a Google Sheet. Put the deployed Apps Script URL in `GOOGLE_SHEET_WEBHOOK_URL`.

## Optional email
Set SMTP variables in `.env`. The server sends an order email after successful payment when SMTP is configured.


## Temporary ₹1 Live Payment Test
This build includes a clearly marked `TEST PAYMENT (Temporary)` option priced at ₹1 with ₹0 delivery, intended only to verify the live Razorpay checkout and payment verification flow. After the test succeeds, remove the `test` plan from `server.js` and `public/index.html`, then redeploy.


### Customer My Order
Customers can now use the **My Order** section with their Order ID and payment mobile number to view paid status, pass, duration, start date, validity/end date, amount paid, remaining days and delivery address.


## Customer Invoice
After successful Razorpay payment, the server creates a PDF invoice. If SMTP is configured, the invoice PDF is emailed to the customer email entered at checkout and the business notification email. The WhatsApp confirmation also includes a secure invoice link. Set `SITE_URL` to the live Railway URL and configure SMTP variables for email delivery.
