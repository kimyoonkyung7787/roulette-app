const fs = require('fs');
const path = require('path');
const localesPath = 'c:/MyProject/roulette-app/src/i18n/locales';

const files = fs.readdirSync(localesPath);

const updates = {
    'ko': {
        'entry.offline_desc': '한자리에 모인 친구들과\n함께 돌리고 즐겨요!',
        'entry.online_desc': '친구들과 멀리 있어도\n실시간으로 함께 즐겨요!',
        'entry.who_pays_desc': '참여자 중 한 명을 룰렛으로 뽑아요',
        'entry.what_to_eat_desc': '메뉴를 등록하고 다 같이 정해요',
        'welcome.host_desc': '방을 만들고 친구들을 초대하세요',
        'welcome.participant_desc': '방 번호를 입력해서 참여하세요',
        'welcome.who_pays_desc': '참여자 중 한 명을 룰렛으로 뽑아요',
        'welcome.what_to_eat_desc': '메뉴를 등록하고 다 같이 정해요',
        'menu.coffee.0': '아메리카노'
    },
    'en': {
        'entry.offline_desc': 'Gathered together.\nOne person spins to win!',
        'entry.online_desc': 'Remote gathering.\nEveryone spins to win!',
        'entry.who_pays_desc': 'Spin to pick one from the group',
        'entry.what_to_eat_desc': 'Add menus and decide together',
        'welcome.host_desc': 'Create a room and invite your friends',
        'welcome.participant_desc': 'Enter the room code to join',
        'welcome.who_pays_desc': 'Spin to pick one from the group',
        'welcome.what_to_eat_desc': 'Add menus and decide together',
        'menu.coffee.0': 'Americano'
    },
    'ja': {
        'entry.offline_desc': '同じ場所に集まった友達と\n一緒に回して楽しもう！',
        'entry.online_desc': '離れた場所にいる友達とも\nリアルタイムで一緒に楽しもう！',
        'entry.who_pays_desc': '参加者から1人をルーレットで選ぶ',
        'entry.what_to_eat_desc': 'メニューを登録して皆で決める',
        'welcome.host_desc': '部屋を作成して友達を招待する',
        'welcome.participant_desc': 'ルームコードを入力して参加する',
        'welcome.who_pays_desc': '参加者から1人をルーレットで選ぶ',
        'welcome.what_to_eat_desc': 'メニューを登録して皆で決める',
        'menu.coffee.0': 'アメリカーノ'
    },
    'zh': {
        'entry.offline_desc': '和聚在一起的朋友们\n一起转动并享受吧！',
        'entry.online_desc': '即使和朋友相隔很远\n也能实时一起享受！',
        'entry.who_pays_desc': '通过轮盘从参与者中选出一人',
        'entry.what_to_eat_desc': '添加菜单并一起决定',
        'welcome.host_desc': '创建房间并邀请朋友',
        'welcome.participant_desc': '输入房间号参与',
        'welcome.who_pays_desc': '通过轮盘从参与者中选出一人',
        'welcome.what_to_eat_desc': '添加菜单并一起决定',
        'menu.coffee.0': '美式咖啡'
    },
    'es': {
        'entry.offline_desc': 'Reunidos juntos.\n¡Una persona gira para ganar!',
        'entry.online_desc': 'Reunión remota.\n¡Todos giran para ganar!',
        'entry.who_pays_desc': 'Gira para elegir a uno del grupo',
        'entry.what_to_eat_desc': 'Agreguen menús y decidan juntos',
        'welcome.host_desc': 'Crea una sala e invita a tus amigos',
        'welcome.participant_desc': 'Ingresa el código de la sala para unirte',
        'welcome.who_pays_desc': 'Gira para elegir a uno del grupo',
        'welcome.what_to_eat_desc': 'Agreguen menús y decidan juntos',
        'menu.coffee.0': 'Americano'
    },
    'fr': {
        'entry.offline_desc': 'Rassemblés ensemble.\nUne personne tourne pour gagner !',
        'entry.online_desc': 'Rassemblement à distance.\nTout le monde tourne pour gagner !',
        'entry.who_pays_desc': 'Tournez pour choisir quelqu\'un du groupe',
        'entry.what_to_eat_desc': 'Ajoutez des menus et décidez ensemble',
        'welcome.host_desc': 'Créez un salon et invitez vos amis',
        'welcome.participant_desc': 'Entrez le code du salon pour rejoindre',
        'welcome.who_pays_desc': 'Tournez pour choisir quelqu\'un du groupe',
        'welcome.what_to_eat_desc': 'Ajoutez des menus et décidez ensemble',
        'menu.coffee.0': 'Americano'
    },
    'de': {
        'entry.offline_desc': 'Zusammen versammelt.\nEine Person dreht, um zu gewinnen!',
        'entry.online_desc': 'Aus der Ferne versammelt.\nAlle drehen, um zu gewinnen!',
        'entry.who_pays_desc': 'Drehen, um jemanden aus der Gruppe auszuwählen',
        'entry.what_to_eat_desc': 'Menüs hinzufügen und gemeinsam entscheiden',
        'welcome.host_desc': 'Raum erstellen und Freunde einladen',
        'welcome.participant_desc': 'Raumcode eingeben, um beizutreten',
        'welcome.who_pays_desc': 'Drehen, um jemanden aus der Gruppe auszuwählen',
        'welcome.what_to_eat_desc': 'Menüs hinzufügen und gemeinsam entscheiden',
        'menu.coffee.0': 'Americano'
    },
    'ar': {
        'entry.offline_desc': 'نجتمع معًا.\nشخص واحد يدور ليفوز!',
        'entry.online_desc': 'تجمع عن بعد.\nالجميع يدور ليفوز!',
        'entry.who_pays_desc': 'قم بالتدوير لاختيار شخص من المجموعة',
        'entry.what_to_eat_desc': 'أضف القوائم وقرر معًا',
        'welcome.host_desc': 'قم بإنشاء غرفة وادع أصدقائك',
        'welcome.participant_desc': 'أدخل رمز الغرفة للانضمام',
        'welcome.who_pays_desc': 'قم بالتدوير لاختيار شخص من المجموعة',
        'welcome.what_to_eat_desc': 'أضف القوائم وقرر معًا',
        'menu.coffee.0': 'أمريكانو'
    },
    'hi': {
        'entry.offline_desc': 'एक साथ इकट्ठा हुए।\nजीतने के लिए एक व्यक्ति घुमाता है!',
        'entry.online_desc': 'दूरस्थ सभा।\nहर कोई जीतने के लिए घुमाता है!',
        'entry.who_pays_desc': 'समूह में से एक को चुनने के लिए घुमाएं',
        'entry.what_to_eat_desc': 'मेनू जोड़ें और एक साथ निर्णय लें',
        'welcome.host_desc': 'एक रूम बनाएं और अपने दोस्तों को आमंत्रित करें',
        'welcome.participant_desc': 'शामिल होने के लिए रूम कोड दर्ज करें',
        'welcome.who_pays_desc': 'समूह में से एक को चुनने के लिए घुमाएं',
        'welcome.what_to_eat_desc': 'मेनू जोड़ें और एक साथ निर्णय लें',
        'menu.coffee.0': 'अमेरिकानो'
    }
}

for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const lang = file.replace('.json', '');
    if (!updates[lang]) continue;

    const filePath = path.join(localesPath, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const updateKeys = updates[lang];

    if (data.entry) {
        data.entry.offline_desc = updateKeys['entry.offline_desc'] || data.entry.offline_desc;
        data.entry.online_desc = updateKeys['entry.online_desc'] || data.entry.online_desc;
        data.entry.who_pays_desc = updateKeys['entry.who_pays_desc'] || data.entry.who_pays_desc;
        data.entry.what_to_eat_desc = updateKeys['entry.what_to_eat_desc'] || data.entry.what_to_eat_desc;
    }

    if (data.welcome) {
        data.welcome.host_desc = updateKeys['welcome.host_desc'] || data.welcome.host_desc;
        data.welcome.participant_desc = updateKeys['welcome.participant_desc'] || data.welcome.participant_desc;
        data.welcome.who_pays_desc = updateKeys['welcome.who_pays_desc'] || data.welcome.who_pays_desc;
        data.welcome.what_to_eat_desc = updateKeys['welcome.what_to_eat_desc'] || data.welcome.what_to_eat_desc;
    }

    // Replace coffee item 0 (Americano)
    if (data.menu && data.menu.coffee && Array.isArray(data.menu.coffee) && data.menu.coffee.length > 0) {
        data.menu.coffee[0] = updateKeys['menu.coffee.0'] || data.menu.coffee[0];
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    console.log(`Updated ${file}`);
}
