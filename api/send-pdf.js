const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pdfBase64, filename, customerName, weddingHall, weddingDate, serviceType } = req.body;

  if (!pdfBase64 || !filename) {
    return res.status(400).json({ error: '필수 데이터가 누락되었습니다.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"메리세이프 서류 접수" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: `[사전 체크리스트] ${customerName} | ${weddingHall} | ${weddingDate} | ${serviceType}`,
      html: `
        <div style="font-family:'Apple SD Gothic Neo',sans-serif; max-width:600px; margin:0 auto; padding:2rem; background:#fff; border:1px solid #eee;">
          <h2 style="color:#1C1C1C; border-bottom:2px solid #1C1C1C; padding-bottom:.5rem;">
            📋 메리세이프 서비스 사전 체크리스트 접수
          </h2>
          <table style="width:100%; border-collapse:collapse; margin-top:1.5rem;">
            <tr style="background:#f5f5f5;">
              <td style="padding:.6rem 1rem; font-weight:600; width:35%; border:1px solid #ddd;">고객 성명</td>
              <td style="padding:.6rem 1rem; border:1px solid #ddd;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding:.6rem 1rem; font-weight:600; border:1px solid #ddd;">예식장</td>
              <td style="padding:.6rem 1rem; border:1px solid #ddd;">${weddingHall}</td>
            </tr>
            <tr style="background:#f5f5f5;">
              <td style="padding:.6rem 1rem; font-weight:600; border:1px solid #ddd;">예식 일자</td>
              <td style="padding:.6rem 1rem; border:1px solid #ddd;">${weddingDate}</td>
            </tr>
            <tr>
              <td style="padding:.6rem 1rem; font-weight:600; border:1px solid #ddd;">서비스 유형</td>
              <td style="padding:.6rem 1rem; border:1px solid #ddd;">${serviceType}</td>
            </tr>
          </table>
          <p style="margin-top:1.5rem; color:#555; font-size:.9rem;">
            ✅ 작성된 서류 PDF가 첨부파일로 포함되어 있습니다.<br>
            📎 파일명: <strong>${filename}</strong>
          </p>
          <p style="margin-top:1rem; color:#999; font-size:.8rem;">
            이 메일은 marrysafe.co.kr 서비스 서류 자동 접수 시스템에서 발송되었습니다.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    return res.status(200).json({ success: true, message: '제출 완료' });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: '메일 전송 실패: ' + error.message });
  }
};
