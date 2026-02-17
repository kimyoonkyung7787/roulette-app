import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Modal, StyleSheet, ScrollView, Animated as RNAnimated } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Languages, ChevronDown, Check, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export const LanguageSelector = () => {
    const { t, i18n } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);

    // Find current language object
    const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

    const changeLanguage = async (code) => {
        await i18n.changeLanguage(code);
        await AsyncStorage.setItem('user-language', code);
        setIsVisible(false);
    };

    return (
        <View>
            <TouchableOpacity
                onPress={() => setIsVisible(true)}
                style={styles.selectorButton}
                activeOpacity={0.7}
            >
                <Languages color={Colors.primary} size={18} />
                <Text style={styles.selectorText}>{currentLang.code.toUpperCase()}</Text>
                <ChevronDown color={Colors.primary} size={14} />
            </TouchableOpacity>

            <Modal
                visible={isVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('common.select_language')}</Text>
                            <TouchableOpacity onPress={() => setIsVisible(false)} style={styles.closeButton}>
                                <X color={Colors.primary} size={24} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        <ScrollView contentContainerStyle={styles.langList}>
                            {LANGUAGES.map((lang) => (
                                <TouchableOpacity
                                    key={lang.code}
                                    style={[
                                        styles.langItem,
                                        i18n.language === lang.code && styles.activeLangItem
                                    ]}
                                    onPress={() => changeLanguage(lang.code)}
                                >
                                    <View style={styles.langInfo}>
                                        <Text style={styles.flag}>{lang.flag}</Text>
                                        <Text style={[
                                            styles.langLabel,
                                            i18n.language === lang.code && styles.activeLangLabel
                                        ]}>
                                            {lang.label}
                                        </Text>
                                    </View>
                                    {i18n.language === lang.code && (
                                        <Check color={Colors.success} size={20} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.primary,
        gap: 6,
    },
    selectorText: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: Colors.background,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    closeButton: {
        padding: 4,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0, 255, 255, 0.2)',
        marginBottom: 16,
    },
    langList: {
        gap: 8,
    },
    langItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    activeLangItem: {
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
        borderColor: Colors.primary,
    },
    langInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    flag: {
        fontSize: 20,
    },
    langLabel: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    activeLangLabel: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
});
