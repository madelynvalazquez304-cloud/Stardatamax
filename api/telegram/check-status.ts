export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId } = req.query || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    // Check cloud store for status
    const cloudRes = await fetch(`https://api.restful-api.dev/objects/${sessionId}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (cloudRes.ok) {
      const record = await cloudRes.json();
      const data = record?.data || {};

      return res.status(200).json({
        exists: true,
        status: data.status || 'pending',
        timestamp: data.timestamp
      });
    }

    // If not found in cloud store, return pending
    return res.status(200).json({
      exists: false,
      status: 'pending'
    });
  } catch (error) {
    console.error('Check status error:', error);
    return res.status(200).json({
      status: 'pending'
    });
  }
}
