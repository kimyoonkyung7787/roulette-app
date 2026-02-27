export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { query, locale = 'en' } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Missing or empty query parameter' });
    }

    const useNaver = (locale || '').toLowerCase() === 'ko';

    if (useNaver) {
        return handleNaverSearch(req, res, query.trim());
    }
    return handleGoogleSearch(req, res, query.trim(), locale);
}

async function handleNaverSearch(req, res, query) {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Naver API credentials not configured' });
    }

    try {
        const params = new URLSearchParams({
            query,
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
        const rawItems = Array.isArray(data?.items) ? data.items : [];

        const items = rawItems
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
                title: (item.title || '').toString().replace(/<[^>]*>/g, ''),
                address: item.address ?? '',
                roadAddress: item.roadAddress ?? '',
                category: item.category ?? '',
                mapx: item.mapx ?? '',
                mapy: item.mapy ?? '',
            }));

        return res.status(200).json({ items });
    } catch (err) {
        console.error('search-restaurant Naver error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleGoogleSearch(req, res, query, locale) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Google Places API key not configured' });
    }

    const languageCode = (locale || 'en').substring(0, 2);

    try {
        const response = await fetch(
            'https://places.googleapis.com/v1/places:searchText',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.addressComponents,places.location',
                },
                body: JSON.stringify({
                    textQuery: query,
                    languageCode,
                }),
            }
        );

        if (!response.ok) {
            const text = await response.text();
            console.error('Google Places API error:', response.status, text);
            return res.status(response.status).json({ error: 'Google Places API request failed' });
        }

        const data = await response.json();
        const rawPlaces = Array.isArray(data?.places) ? data.places : [];

        const items = rawPlaces
            .filter((place) => place && typeof place === 'object')
            .slice(0, 5)
            .map((place) => {
                const displayName = place.displayName?.text ?? '';
                const formattedAddress = place.formattedAddress ?? '';
                const loc = place.location;
                const mapx = loc?.longitude != null ? String(loc.longitude) : '';
                const mapy = loc?.latitude != null ? String(loc.latitude) : '';

                return {
                    title: displayName,
                    address: formattedAddress,
                    roadAddress: formattedAddress,
                    category: '',
                    mapx,
                    mapy,
                };
            });

        return res.status(200).json({ items });
    } catch (err) {
        console.error('search-restaurant Google error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
