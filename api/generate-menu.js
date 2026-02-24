export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { restaurantName, category, address } = req.body || {};
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
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
            console.error('Gemini API error:', response.status, text);
            return res.status(response.status).json({ error: 'Gemini API request failed' });
        }

        const data = await response.json();

        const rawText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) {
            console.error('Failed to parse Gemini response:', rawText);
            return res.status(500).json({ error: 'Failed to parse menu data' });
        }

        const menus = JSON.parse(jsonMatch[0]);

        if (!Array.isArray(menus) || menus.length === 0) {
            return res.status(500).json({ error: 'Empty menu result' });
        }

        return res.status(200).json({
            menus: menus.filter((m) => typeof m === 'string' && m.trim().length > 0),
            restaurantName: name,
        });
    } catch (err) {
        console.error('generate-menu error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
