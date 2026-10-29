const GAS_URL = 'https://script.google.com/macros/s/AKfycbxiEyY6MLExryXtp7DPr6SGVPqrpoouZXb3R3lqrFT2JIBYEWodMkpEGRxiw0fKF77L/exec';

// 한글 웹폰트 — Lambda 크로미움에는 한글 글꼴이 없어 직접 올려야 한다
const FONT_URLS = [
  'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf',
];

async function renderPdf(docHtml) {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = await import('puppeteer-core');

  for (const url of FONT_URLS) {
    try { await chromium.font(url); } catch (e) { console.error('font load failed:', url, e.message); }
  }

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(docHtml, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });
  } finally {
    await browser.close();
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { docHtml, ...rest } = req.body || {};
    let payload = rest;

    // docHtml 이 오면 서버에서 PDF 를 만든다.
    // 구버전 화면이 열려 있는 고객도 있으므로 pdfBase64 방식도 그대로 받는다.
    if (docHtml) {
      const pdf = await renderPdf(docHtml);
      payload = { ...rest, pdfBase64: Buffer.from(pdf).toString('base64') };
    } else if (!rest.pdfBase64) {
      return res.status(400).json({ error: 'docHtml 또는 pdfBase64 가 필요합니다.' });
    }

    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
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
