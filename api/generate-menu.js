export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { restaurantName, category, address } = body || {};
    const name = (restaurantName || '').toString().trim();
    if (!name) {
        return res.status(400).json({ error: 'Missing restaurantName', code: 'MISSING_NAME' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const categoryLabel = {
        coffee: '카페/음료',
        meal: '식사/레스토랑',
        snack: '간식/디저트',
        etc: '기타',
    }[category] || '음식점';

    const prompt = `당신은 한국 음식점 메뉴 전문가입니다.
다음 가게의 대표 메뉴 7~10개를 JSON 배열로 반환하세요.
메뉴 이름만 간결하게 작성하세요 (가격 제외).
실제로 해당 가게에서 팔 법한 메뉴를 추측하세요.

가게명: ${name}
업종: ${categoryLabel}
${address ? `주소: ${address}` : ''}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
["메뉴1", "메뉴2", "메뉴3", ...]`;

    try {
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];
    let lastError = null;
    let lastStatus = 500;

    for (const model of modelsToTry) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 512,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const text = await response.text();
                lastError = text;
                lastStatus = response.status;
                let parsed = null;
                try {
                    parsed = JSON.parse(text);
                } catch {}
                const msg = parsed?.error?.message || parsed?.error?.status || text?.slice(0, 200);
                console.warn(`Gemini API (${model}) ${response.status}:`, msg);
                continue;
            }

            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) {
                console.warn(`Gemini (${model}) parse failed:`, rawText?.slice(0, 200));
                lastError = 'Failed to parse menu data';
                lastStatus = 500;
                continue;
            }

            const menus = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(menus) || menus.length === 0) {
                lastError = 'Empty menu result';
                continue;
            }

            return res.status(200).json({
                menus: menus.filter((m) => typeof m === 'string' && m.trim().length > 0),
                restaurantName: name,
            });
        } catch (err) {
            console.warn(`Gemini (${model}) exception:`, err?.message);
            lastError = err?.message || 'Internal error';
            continue;
        }
    }

    const userMsg = lastStatus === 429
        ? '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
        : lastStatus === 400
            ? 'Gemini API 요청 실패. API 키 제한(HTTP referrer 등)을 확인해 주세요.'
            : 'Gemini API request failed';
    return res.status(lastStatus >= 400 ? lastStatus : 500).json({
        error: userMsg,
        code: lastStatus === 429 ? 'RATE_LIMIT' : 'API_ERROR',
    });
    } catch (err) {
        console.error('generate-menu error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
