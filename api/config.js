// /api/config.js
// Exposes the PUBLIC Razorpay Key ID to the frontend at runtime, so the
// site always uses whatever is currently set in Vercel's environment
// variables (test or live) without ever needing a code change/redeploy
// to switch modes. Only the Key ID is exposed here — never the secret.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RAZORPAY_KEY_ID) {
    return res.status(500).json({ error: 'RAZORPAY_KEY_ID is not set in environment variables' });
  }

  return res.status(200).json({
    key_id: process.env.RAZORPAY_KEY_ID,
  });
};