const GAS_URL = 'https://script.google.com/macros/s/AKfycbxiEyY6MLExryXtp7DPr6SGVPqrpoouZXb3R3lqrFT2JIBYEWodMkpEGRxiw0fKF77L/exec';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 서버(Vercel)에서 GAS 호출 — CORS 제한 없음
    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(req.body),
      redirect: 'follow',
    });

    if (!gasRes.ok) {
      const text = await gasRes.text().catch(() => '');
      throw new Error(`GAS error ${gasRes.status}: ${text.substring(0, 100)}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('send-pdf error:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};
