export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Missing or empty query parameter' });
    }

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Naver API credentials not configured' });
    }

    try {
        const params = new URLSearchParams({
            query: query.trim(),
            display: '5',
            sort: 'random',
        });

        const response = await fetch(
            `https://openapi.naver.com/v1/search/local.json?${params}`,
            {
                headers: {
                    'X-Naver-Client-Id': clientId,
                    'X-Naver-Client-Secret': clientSecret,
                },
            }
        );

        if (!response.ok) {
            const text = await response.text();
            console.error('Naver API error:', response.status, text);
            return res.status(response.status).json({ error: 'Naver API request failed' });
        }

        const data = await response.json();

        const items = (data.items || []).map((item) => ({
            title: item.title.replace(/<[^>]*>/g, ''),
            address: item.address,
            roadAddress: item.roadAddress,
            category: item.category,
            mapx: item.mapx,
            mapy: item.mapy,
        }));

        return res.status(200).json({ items });
    } catch (err) {
        console.error('search-restaurant error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
