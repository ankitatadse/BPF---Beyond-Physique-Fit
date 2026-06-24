// /api/create-order.js
// Vercel serverless function — creates a Razorpay order server-side.
// Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to be set as
// Environment Variables in your Vercel project settings.

const Razorpay = require('razorpay');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency, receipt } = req.body || {};

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'A valid amount (in paise) is required' });
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await instance.orders.create({
      amount: parseInt(amount, 10), // amount in paise (e.g. ₹999 = 99900)
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
    });

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
};
