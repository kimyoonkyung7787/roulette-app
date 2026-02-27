/**
 * PayPal 주문 생성 API
 * POST /api/create-paypal-order
 * Body: { amount?: string, currency?: string, returnUrl?: string, cancelUrl?: string }
 * 
 * 환경변수: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
 * 프로덕션: PAYPAL_MODE=live (기본 sandbox)
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

    const amount = (body.amount || '4.99').toString().replace(',', '.');
    const currency = (body.currency || 'USD').toUpperCase();
    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (body.baseUrl || 'https://roulette-app-two.vercel.app');
    const returnUrl = body.returnUrl || `${baseUrl}/paypal-return.html`;
    const cancelUrl = body.cancelUrl || `${baseUrl}/`;

    const isLive = process.env.PAYPAL_MODE === 'live';
    const apiBase = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    try {
        // 1. Get access token
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
            const errText = await tokenRes.text();
            console.error('PayPal token error:', errText);
            return res.status(502).json({ error: 'PayPal auth failed' });
        }
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 2. Create order
        const orderPayload = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    amount: {
                        currency_code: currency,
                        value: amount,
                    },
                    description: 'Roulette Premium - Up to 10 participants',
                },
            ],
            application_context: {
                brand_name: 'Roulette Premium',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: returnUrl,
                cancel_url: cancelUrl,
            },
        };

        const orderRes = await fetch(`${apiBase}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(orderPayload),
        });

        if (!orderRes.ok) {
            const errData = await orderRes.json().catch(() => ({}));
            console.error('PayPal create order error:', errData);
            return res.status(502).json({ error: 'PayPal order creation failed', details: errData });
        }

        const orderData = await orderRes.json();
        const approveLink = orderData.links?.find((l) => l.rel === 'approve')?.href;
        if (!approveLink) {
            return res.status(502).json({ error: 'No approval link in PayPal response' });
        }

        return res.status(200).json({
            orderId: orderData.id,
            approveUrl: approveLink,
            status: orderData.status,
        });
    } catch (e) {
        console.error('create-paypal-order error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
