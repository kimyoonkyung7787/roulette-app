const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'i18n', 'locales');
const langs = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'ko', 'zh'];

const translations = {
    'en': {
        'entry.offline_desc': 'Play face-to-face.\nOne device, everyone spins!',
        'entry.online_desc': 'Play remotely.\nInvite friends via link!',
        'welcome.who_pays_desc': 'Spin to pick one from the group',
        'welcome.what_to_eat_desc': "Can't decide? Let the roulette choose",
        'coffee': ["Hot/Iced Americano", "Cafe Latte", "Vanilla Latte", "Cappuccino", "Fruit Ade", "Green Tea Latte", "Smoothie"],
        'meal': ["Pizza", "Burger & Fries", "Sushi", "Pasta", "Fried Chicken", "Tacos", "Steak"],
        'snack': ["Popcorn", "Nachos", "Ice Cream", "Donuts", "Cookies", "Potato Chips", "Pretzels"]
    },
    'ko': {
        'entry.offline_desc': '기기 하나로 다같이 플레이!\n돌려서 내기를 정하세요.',
        'entry.online_desc': '멀리 있어도 함께!\n링크로 친구들을 초대하세요.',
        'welcome.who_pays_desc': '참여자 중 한 명을 뽑습니다',
        'welcome.what_to_eat_desc': '뭐 먹을지 고민될 때 룰렛이 골라줍니다',
        'coffee': ["아메리카노(Hot/Ice)", "카페라떼", "바닐라라떼", "카푸치노", "과일에이드", "녹차라떼", "스무디"],
        'meal': ["김치찌개/된장찌개", "돈까스", "햄버거", "중식(짜장/짬뽕)", "피자", "초밥", "치킨"],
        'snack': ["떡볶이", "핫도그", "아이스크림", "크로플", "과자", "붕어빵/호떡", "샌드위치"]
    },
    'ar': {
        'entry.offline_desc': 'العب وجهاً لوجه.\nجهاز واحد، الجميع يدور!',
        'entry.online_desc': 'العب عن بُعد.\nقم بدعوة الأصدقاء عبر الرابط!',
        'welcome.who_pays_desc': 'أدر العجلة لاختيار واحد من المجموعة',
        'welcome.what_to_eat_desc': 'لا تستطيع أن تقرر؟ دع الروليت يختار',
        'coffee': ["أمريكانو حار/بارد", "كافيه لاتيه", "فانيلا لاتيه", "كابتشينو", "عصير فواكه", "ماتشا لاتيه", "سموثي"],
        'meal': ["بيتزا", "برجر وبطاطس", "سوشي", "باستا", "دجاج مقلي", "شاورما", "كباب"],
        'snack': ["فشار", "ناتشوز", "آيس كريم", "دونات", "بسكويت", "شيبس", "فطائر"]
    },
    'de': {
        'entry.offline_desc': 'Spiele von Angesicht zu Angesicht.\nEin Gerät für alle!',
        'entry.online_desc': 'Spiele aus der Ferne.\nLade Freunde per Link ein!',
        'welcome.who_pays_desc': 'Drehen, um eine Person auszuwählen',
        'welcome.what_to_eat_desc': 'Unentschlossen? Lass das Roulette wählen',
        'coffee': ["Heißer/Eis Americano", "Caffè Latte", "Vanilla Latte", "Cappuccino", "Fruchtlimonade", "Matcha Latte", "Smoothie"],
        'meal': ["Pizza", "Burger & Pommes", "Sushi", "Pasta", "Gebratenes Hähnchen", "Schnitzel", "Döner"],
        'snack': ["Popcorn", "Nachos", "Eiscreme", "Donuts", "Kekse", "Kartoffelchips", "Brezeln"]
    },
    'es': {
        'entry.offline_desc': 'Juega cara a cara.\n¡Un dispositivo, todos giran!',
        'entry.online_desc': 'Juega de forma remota.\n¡Invita amigos a través del enlace!',
        'welcome.who_pays_desc': 'Gira para elegir a uno del grupo',
        'welcome.what_to_eat_desc': '¿No puedes decidir? Deja que la ruleta elija',
        'coffee': ["Americano (Caliente/Frío)", "Café Latte", "Latte de Vainilla", "Capuchino", "Limonada", "Matcha Latte", "Batido"],
        'meal': ["Pizza", "Hamburguesa con Patatas", "Sushi", "Pasta", "Pollo Frito", "Tacos", "Parrillada"],
        'snack': ["Palomitas", "Nachos", "Helado", "Donas", "Galletas", "Papas Fritas", "Churros"]
    },
    'fr': {
        'entry.offline_desc': 'Jouez en face à face.\nUn seul appareil pour tous !',
        'entry.online_desc': 'Jouez à distance.\nInvitez vos amis via un lien !',
        'welcome.who_pays_desc': 'Tournez pour choisir une personne',
        'welcome.what_to_eat_desc': 'Indécis ? Laissez la roulette choisir',
        'coffee': ["Americano Chaud / Frappé", "Café Latte", "Latte Vanille", "Cappuccino", "Limonade", "Matcha Latte", "Smoothie"],
        'meal': ["Pizza", "Burger Frites", "Sushi", "Pâtes", "Poulet Frit", "Tacos", "Steak Frites"],
        'snack': ["Pop-corn", "Nachos", "Glace", "Beignets", "Biscuits", "Chips", "Crêpes"]
    },
    'hi': {
        'entry.offline_desc': 'आमने-सामने खेलें।\nएक फोन, सब एक साथ!',
        'entry.online_desc': 'दूर से खेलें।\nलिंक के जरिए दोस्तों को बुलाएं!',
        'welcome.who_pays_desc': 'ग्रुप से किसी एक को चुनने के लिए घुमाएं',
        'welcome.what_to_eat_desc': 'तय नहीं कर पा रहे? रूले को चुनने दें',
        'coffee': ["गर्म/कोल्ड अमेरिकनो", "कैफे लाटे", "वैनिला लाटे", "कैपुचीनो", "फ्रूट ऐड़े", "माचा लाटे", "स्मूथी"],
        'meal': ["पिज़्ज़ा", "बर्गर और फ्राइज़", "सुशी", "पास्ता", "फ्राइड चिकन", "समोसा/छोले ભटूरे", "बिरयानी"],
        'snack': ["पॉपकॉर्न", "नाचोस", "आइसक्रीम", "डोनट्स", "कुकीज़", "चिप्स", "पकौड़े"]
    },
    'ja': {
        'entry.offline_desc': '顔を合わせてプレイ。\n1つの端末でみんなで回そう！',
        'entry.online_desc': 'リモートでプレイ。\nリンクから友達を招待しよう！',
        'welcome.who_pays_desc': 'ルーレットを回して一人を選ぶ',
        'welcome.what_to_eat_desc': '迷っているならルーレットにお任せ',
        'coffee': ["ホット/アイス アメリカーノ", "カフェラテ", "バニララテ", "カプチーノ", "フルーツエード", "抹茶ラテ", "スムージー"],
        'meal': ["ラーメン", "寿司", "とんかつ", "焼肉", "パスタ", "ピザ", "ハンバーガー"],
        'snack': ["たこ焼き", "唐揚げ", "アイスクリーム", "ドーナツ", "スナック菓子", "ケーキ", "ポテトチップス"]
    },
    'zh': {
        'entry.offline_desc': '面对面游玩。\n一台设备，大家轮流转！',
        'entry.online_desc': '远程游玩。\n通过链接邀请朋友！',
        'welcome.who_pays_desc': '转动轮盘从人群中选出一人',
        'welcome.what_to_eat_desc': '无法决定吃什么？让轮盘来选',
        'coffee': ["热/冰 美式咖啡", "拿铁咖啡", "香草拿铁", "卡布奇诺", "水果气泡水", "抹茶拿铁", "冰沙"],
        'meal': ["火锅", "汉堡薯条", "寿司", "意大利面", "炸鸡", "烤肉", "披萨"],
        'snack': ["爆米花", "奶茶", "冰淇淋", "甜甜圈", "饼干", "薯片", "小蛋糕"]
    }
};

langs.forEach(lang => {
    const filePath = path.join(localesDir, `${lang}.json`);
    if (fs.existsSync(filePath)) {
        let rawData = fs.readFileSync(filePath, 'utf8');
        let data = JSON.parse(rawData);

        const updates = translations[lang];
        if (updates) {
            // update entry
            if (!data.entry) data.entry = {};
            data.entry.offline_desc = updates['entry.offline_desc'];
            data.entry.online_desc = updates['entry.online_desc'];

            // update welcome
            if (!data.welcome) data.welcome = {};
            data.welcome.who_pays_desc = updates['welcome.who_pays_desc'];
            data.welcome.what_to_eat_desc = updates['welcome.what_to_eat_desc'];

            // update popular_items
            if (!data.popular_items) data.popular_items = {};
            data.popular_items.coffee = updates['coffee'];
            data.popular_items.meal = updates['meal'];
            data.popular_items.snack = updates['snack'];
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`Updated ${lang}.json`);
    } else {
        console.warn(`File not found: ${filePath}`);
    }
});
