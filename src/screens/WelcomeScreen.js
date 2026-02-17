import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions, Image, TextInput, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { Coffee, Utensils, Pizza, Crown, User, ArrowRight } from 'lucide-react-native';
import { CyberAlert } from '../components/CyberAlert';
import { syncService } from '../services/SyncService';
import { LanguageSelector } from '../components/LanguageSelector';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { id: 'coffee', label: 'coffee', icon: Coffee, color: Colors.neonPink },
    { id: 'meal', label: 'meal', icon: Utensils, color: Colors.success },
    { id: 'snack', label: 'snack', icon: Pizza, color: Colors.accent },
];

const ROLES = [
    { id: 'owner', label: 'host', icon: Crown, description: 'Manage participants' },
    { id: 'participant', label: 'participant', icon: User, description: 'Join existing list' },
];

export default function WelcomeScreen({ navigation }) {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState('coffee');
    const [selectedRole, setSelectedRole] = useState('participant');
    const [inputRoomId, setInputRoomId] = useState('');
    const [alertConfig, setAlertConfig] = useState({ visible: false, message: '', title: '' });

    const generateRoomId = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const handleStart = async () => {
        let roomId = '';

        if (selectedRole === 'owner') {
            roomId = generateRoomId();
        } else {
            if (!inputRoomId || inputRoomId.trim().length === 0) {
                setAlertConfig({
                    visible: true,
                    title: t('common.alert'),
                    message: t('welcome.enter_room_id_to_proceed')
                });
                return;
            }
            if (inputRoomId.length !== 6) {
                setAlertConfig({
                    visible: true,
                    title: t('common.alert'),
                    message: t('welcome.room_id_length_error')
                });
                return;
            }
            roomId = inputRoomId.trim();

            const exists = await syncService.checkRoomExists(roomId);
            if (!exists) {
                setAlertConfig({
                    visible: true,
                    title: t('common.alert'),
                    message: t('welcome.room_not_found')
                });
                return;
            }
        }

        navigation.navigate('NameInput', {
            category: selectedCategory,
            role: selectedRole,
            roomId: roomId
        });
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.container, { width: '100%', maxWidth: 500, alignSelf: 'center' }]}>
                            {/* Top Header with Language Selector */}
                            <View style={styles.topHeader}>
                                <LanguageSelector />
                            </View>

                            {/* Header Image Placeholder / Roulette Aesthetic */}
                            <View style={styles.heroContainer}>
                                <View style={styles.rouletteCircle}>
                                    <View style={[styles.innerCircle, { borderColor: CATEGORIES.find(c => c.id === selectedCategory).color }]}>
                                        {React.createElement(CATEGORIES.find(c => c.id === selectedCategory).icon, {
                                            size: 60,
                                            color: CATEGORIES.find(c => c.id === selectedCategory).color
                                        })}
                                    </View>
                                    <NeonText className="mt-4 text-2xl tracking-[0.2em]" style={{ color: CATEGORIES.find(c => c.id === selectedCategory).color }}>
                                        {t('common.roulette_game')}
                                    </NeonText>
                                </View>
                            </View>

                            <View style={styles.content}>
                                <View style={styles.section}>
                                    <NeonText className="text-sm mb-4 opacity-70">{t('welcome.select_category')}</NeonText>
                                    <View style={styles.categoryGrid}>
                                        {CATEGORIES.map((cat) => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                onPress={() => setSelectedCategory(cat.id)}
                                                style={[
                                                    styles.categoryCard,
                                                    selectedCategory === cat.id && { borderColor: cat.color, backgroundColor: `${cat.color}15` }
                                                ]}
                                            >
                                                <cat.icon size={24} color={selectedCategory === cat.id ? cat.color : Colors.textSecondary} />
                                                <Text style={[
                                                    styles.cardLabel,
                                                    { color: selectedCategory === cat.id ? cat.color : Colors.textSecondary }
                                                ]}>{t(`categories.${cat.label}`)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.section}>
                                    <NeonText className="text-sm mb-4 opacity-70">{t('welcome.choose_role')}</NeonText>
                                    <View style={styles.roleContainer}>
                                        {ROLES.map((role) => (
                                            <TouchableOpacity
                                                key={role.id}
                                                onPress={() => setSelectedRole(role.id)}
                                                style={[
                                                    styles.roleCard,
                                                    selectedRole === role.id && { borderColor: Colors.primary, backgroundColor: 'rgba(0, 255, 255, 0.1)' }
                                                ]}
                                            >
                                                <View style={styles.roleIconBox}>
                                                    <role.icon size={18} color={selectedRole === role.id ? Colors.primary : Colors.textSecondary} />
                                                </View>
                                                <Text style={[styles.roleLabel, selectedRole === role.id && { color: Colors.primary }]}>{t(`common.${role.label}`)}</Text>
                                                {selectedRole === role.id && <View style={styles.checkMark} />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={styles.inputAreaWrapper}>
                                        {selectedRole === 'participant' ? (
                                            <View style={styles.roomIdInputContainer}>
                                                <TextInput
                                                    style={styles.roomIdInput}
                                                    placeholder={t('welcome.room_id_placeholder')}
                                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                                    keyboardType="number-pad"
                                                    maxLength={6}
                                                    value={inputRoomId}
                                                    onChangeText={setInputRoomId}
                                                />
                                            </View>
                                        ) : (
                                            <View style={styles.inputPlaceholder}>
                                                <Text style={styles.placeholderText}>{t('welcome.host_mode_active')}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.startButton, { shadowColor: Colors.primary }]}
                                    onPress={handleStart}
                                >
                                    <Text style={styles.startButtonText}>{t('welcome.start_game')}</Text>
                                    <ArrowRight color="black" size={20} style={{ marginLeft: 10 }} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                <CyberAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type="info"
                    onConfirm={() => setAlertConfig({ ...alertConfig, visible: false })}
                />
            </SafeAreaView>
        </CyberBackground>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
    },
    container: {
        paddingHorizontal: 25,
        paddingBottom: 20,
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingVertical: 10,
    },
    heroContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    rouletteCircle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    content: {
        justifyContent: 'center',
        paddingBottom: 30,
    },
    section: {
        marginBottom: 20,
    },
    categoryGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    categoryCard: {
        flex: 1,
        height: 80,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    cardLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    roleContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    roleCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        gap: 6,
    },
    roleIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleLabel: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    roleDesc: {
        color: Colors.textSecondary,
        fontSize: 11,
        marginTop: 2,
    },
    checkMark: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowRadius: 5,
        shadowOpacity: 1,
        elevation: 5,
    },
    inputAreaWrapper: {
        height: 70,
        marginTop: 15,
        justifyContent: 'center',
    },
    inputPlaceholder: {
        height: 50,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: 'rgba(255,255,255,0.1)',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    roomIdInputContainer: {
        paddingHorizontal: 0,
    },
    roomIdInput: {
        height: 50,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: 8,
        paddingHorizontal: 15,
        color: Colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 2,
        textAlign: 'center',
    },
    startButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
    },
    startButtonText: {
        color: 'black',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 2,
    }
});
