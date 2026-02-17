import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';

const resources = {
    en: { translation: en },
    ko: { translation: ko },
    ja: { translation: ja },
    zh: { translation: zh },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    hi: { translation: hi },
    ar: { translation: ar },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        }
    });

// Load saved language
const loadLanguage = async () => {
    try {
        const savedLanguage = await AsyncStorage.getItem('user-language');
        if (savedLanguage) {
            i18n.changeLanguage(savedLanguage);
        }
    } catch (error) {
        console.error('Failed to load language', error);
    }
};

loadLanguage();

export default i18n;
