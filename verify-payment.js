// /api/verify-payment.js
// Vercel serverless function — verifies the Razorpay payment signature
// server-side using your secret key. NEVER do this check in the browser
// only, since a tampered frontend response can't be trusted on its own.

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = generatedSignature === razorpay_signature;

    return res.status(200).json({ valid: isValid });
  } catch (err) {
    console.error('Signature verification failed:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
};
