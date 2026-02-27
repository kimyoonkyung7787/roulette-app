/**
 * PayPal 주문 캡처 API (결제 완료 확인)
 * POST /api/capture-paypal-order
 * Body: { orderId: string }
 * 
 * 사용자가 PayPal에서 결제 승인 후 호출. 성공 시 프리미엄 활성화 가능.
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'PayPal credentials not configured' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const orderId = (body.orderId || body.token || '').toString().trim();
    if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
    }

    const isLive = process.env.PAYPAL_MODE === 'live';
    const apiBase = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    try {
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenRes = await fetch(`${apiBase}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${auth}`,
            },
            body: 'grant_type=client_credentials',
        });
        if (!tokenRes.ok) {
            return res.status(502).json({ error: 'PayPal auth failed' });
        }
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const captureRes = await fetch(`${apiBase}/v2/checkout/orders/${orderId}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!captureRes.ok) {
            const errData = await captureRes.json().catch(() => ({}));
            return res.status(400).json({
                error: 'Capture failed',
                details: errData,
                code: errData?.details?.[0]?.issue || 'CAPTURE_FAILED',
            });
        }

        const captureData = await captureRes.json();
        return res.status(200).json({
            success: true,
            orderId: captureData.id,
            status: captureData.status,
            payer: captureData.payer,
        });
    } catch (e) {
        console.error('capture-paypal-order error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
