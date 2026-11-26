export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, message, type } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message required' });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || '';
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID || '';

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ error: 'Telegram credentials not configured' });
    }

    // Create keyboard with callback data
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Valider', callback_data: `approve_${type}_${sessionId}` },
          { text: '❌ Rejeter', callback_data: `reject_${type}_${sessionId}` }
        ]
      ]
    };

    // Send to Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        reply_markup: keyboard
      }),
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(500).json({ error: 'Failed to send to Telegram', details: tgData });
    }

    // Store session in cloud store with pending status
    const cloudRes = await fetch('https://api.restful-api.dev/objects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: sessionId,
        data: {
          sessionId,
          type,
          status: 'pending',
          message,
          timestamp: Date.now()
        }
      }),
    });

    const cloudData = await cloudRes.json();

    return res.status(200).json({
      success: true,
      messageId: tgData.result.message_id,
      cloudId: cloudData.id
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: error.message });
  }
}
