import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { NeonText } from '../components/NeonText';
import { UsersRound, Globe, ArrowRight, Target, Zap } from 'lucide-react-native';
import { LanguageSelector } from '../components/LanguageSelector';
import { AdBanner } from '../components/AdBanner';
import { feedbackService } from '../services/FeedbackService';

const { width } = Dimensions.get('window');

export default function EntryScreen({ navigation }) {
    const { t } = useTranslation();

    const handleOffline = () => {
        feedbackService.loadAssets();
        navigation.navigate('OfflineInput', { mode: 'offline' });
    };

    const handleOnline = () => {
        feedbackService.loadAssets();
        navigation.navigate('Welcome', { mode: 'online' });
    };

    return (
        <CyberBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <LanguageSelector />
                </View>

                <View style={styles.content}>
                    <View style={styles.heroSection}>
                        <View style={styles.imageContainer}>
                            <View style={styles.rouletteGraphic}>
                                <View style={styles.outerCircle}>
                                    <View style={styles.dashedCircle} />
                                    <View style={styles.glowCircle} />
                                    <View style={styles.innerCircle}>
                                        <Target color={Colors.primary} size={60} strokeWidth={1.5} />
                                        <View style={styles.absoluteIcon}>
                                            <Zap color={Colors.primary} size={20} fill={Colors.primary} />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View style={styles.titleWrapper}>
                            <NeonText className="text-4xl mt-6 tracking-[0.4em]">ROULETTE</NeonText>
                            <Text style={styles.subTitle}>GAME CENTER</Text>
                        </View>
                        <View style={styles.underline} />
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.modeButton}
                            onPress={handleOffline}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { borderColor: Colors.primary, backgroundColor: 'rgba(0, 255, 255, 0.05)' }]}>
                                <UsersRound color={Colors.primary} size={28} />
                            </View>
                            <View style={styles.buttonTextContent}>
                                <Text style={styles.modeTitle}>{t('entry.offline_title')}</Text>
                                <Text style={styles.modeDesc}>{t('entry.offline_desc')}</Text>
                            </View>
                            <View style={styles.arrowBox}>
                                <ArrowRight color={Colors.primary} size={18} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modeButton, styles.onlineButton]}
                            onPress={handleOnline}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { borderColor: Colors.accent, backgroundColor: 'rgba(255, 170, 0, 0.05)' }]}>
                                <Globe color={Colors.accent} size={28} />
                            </View>
                            <View style={styles.buttonTextContent}>
                                <Text style={[styles.modeTitle, { color: Colors.accent }]}>{t('entry.online_title')}</Text>
                                <Text style={styles.modeDesc}>{t('entry.online_desc')}</Text>
                            </View>
                            <View style={[styles.arrowBox, { borderColor: 'rgba(255, 170, 0, 0.2)' }]}>
                                <ArrowRight color={Colors.accent} size={18} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
                <AdBanner />
            </SafeAreaView>
        </CyberBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
        alignItems: 'flex-end',
        maxWidth: 450,
        alignSelf: 'center',
        width: '100%',
    },
    content: {
        flex: 1,
        paddingHorizontal: 25,
        justifyContent: 'center',
        alignItems: 'center',
        maxWidth: 450,
        alignSelf: 'center',
        width: '100%',
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 60,
    },
    imageContainer: {
        width: 220,
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rouletteGraphic: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    outerCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 255, 255, 0.02)',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
    },
    dashedCircle: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 2,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
        opacity: 0.4,
    },
    glowCircle: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 25,
        shadowOpacity: 0.6,
        elevation: 10,
    },
    innerCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#0a1a1f',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 8,
    },
    absoluteIcon: {
        position: 'absolute',
        top: 20,
        right: 20,
        shadowColor: Colors.primary,
        shadowRadius: 5,
        shadowOpacity: 1,
    },
    titleWrapper: {
        alignItems: 'center',
    },
    subTitle: {
        color: Colors.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 8,
        marginTop: 5,
        opacity: 0.6,
    },
    underline: {
        height: 2,
        width: 40,
        backgroundColor: Colors.primary,
        marginTop: 20,
        borderRadius: 1,
        shadowColor: Colors.primary,
        shadowOpacity: 0.8,
        shadowRadius: 5,
    },
    buttonContainer: {
        width: '100%',
        gap: 15,
    },
    modeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 24,
        padding: 16,
        width: '100%',
    },
    onlineButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonTextContent: {
        flex: 1,
        marginLeft: 15,
    },
    modeTitle: {
        color: Colors.primary,
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    modeDesc: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '400',
    },
    arrowBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    }
});
