import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions, Image, TextInput, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { Crown, ArrowRight, Home, Users, Utensils } from 'lucide-react-native';
import { CyberAlert } from '../components/CyberAlert';
import { syncService } from '../services/SyncService';

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ route, navigation }) {
    const { t } = useTranslation();
    const { mode = 'online' } = route.params || {};
    const [selectedRole, setSelectedRole] = useState(null);
    const [inputRoomId, setInputRoomId] = useState('');
    const [alertConfig, setAlertConfig] = useState({ visible: false, message: '', title: '' });
    const [resumeConfig, setResumeConfig] = useState({ visible: false, roomId: '', category: '' });

    // Check for previous host session on mount
    React.useEffect(() => {
        const checkSession = async () => {
            try {
                const savedRole = await AsyncStorage.getItem('last_role');
                const savedRoomId = await AsyncStorage.getItem('last_room_id');
                const savedCategory = await AsyncStorage.getItem('last_category');

                if (savedRole === 'owner' && savedRoomId) {
                    // Quick check if room still exists
                    const exists = await syncService.checkRoomExists(savedRoomId);
                    if (exists) {
                        setResumeConfig({
                            visible: true,
                            roomId: savedRoomId,
                            category: savedCategory || 'meal'
                        });
                    } else {
                        // Room gone, clear storage
                        await AsyncStorage.multiRemove(['last_role', 'last_room_id', 'last_category']);
                    }
                }
            } catch (e) {
                console.log('WelcomeScreen: Failed to check session', e);
            }
        };
        checkSession();
    }, []);

    const handleResume = async () => {
        setResumeConfig({ ...resumeConfig, visible: false });
        navigation.navigate('NameInput', {
            category: resumeConfig.category,
            role: 'owner',
            roomId: resumeConfig.roomId
        });
    };

    const handleDiscard = async () => {
        setResumeConfig({ ...resumeConfig, visible: false });
        await AsyncStorage.multiRemove(['last_role', 'last_room_id', 'last_category']);
    };

    const generateRoomId = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const handleHostStart = async (setupType) => {
        const roomId = generateRoomId();
        const defaultCategory = 'meal'; // Default category for simplified flow
        try {
            await AsyncStorage.setItem('last_role', 'owner');
            await AsyncStorage.setItem('last_room_id', roomId);
            await AsyncStorage.setItem('last_category', defaultCategory);
        } catch (e) {
            console.error('WelcomeScreen: Failed to save session', e);
        }

        navigation.navigate('NameInput', {
            category: defaultCategory,
            initialTab: setupType, // 'people' or 'menu'
            role: 'owner',
            roomId: roomId,
            mode: mode
        });
    };

    const handleParticipantStart = async (setupType) => {
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

        const roomId = inputRoomId.trim();
        const exists = await syncService.checkRoomExists(roomId);
        if (!exists) {
            setAlertConfig({
                visible: true,
                title: t('common.alert'),
                message: t('welcome.room_not_found')
            });
            return;
        }

        navigation.navigate('NameInput', {
            category: 'meal', // Default
            initialTab: setupType, // 'people' or 'menu'
            role: 'participant',
            roomId: roomId,
            mode: mode
        });
    };

    const renderRoleCard = (role, IconComponent, label, desc, color) => {
        const isSelected = selectedRole === role;

        return (
            <TouchableOpacity
                onPress={() => setSelectedRole(role)}
                style={[
                    styles.roleCard,
                    { borderColor: isSelected ? color : 'rgba(255,255,255,0.1)' }
                ]}
                activeOpacity={0.8}
            >
                <View style={[styles.roleIconBox, { backgroundColor: isSelected ? `${color}20` : 'rgba(255,255,255,0.05)' }]}>
                    <IconComponent size={32} color={color} />
                </View>
                <View style={styles.roleContent}>
                    <Text style={[styles.roleTitle, { color: isSelected ? color : Colors.text }]}>
                        {label}
                    </Text>
                    <Text style={styles.roleDesc}>
                        {desc}
                    </Text>
                </View>
                {isSelected && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
            </TouchableOpacity>
        );
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
                            {/* Top Header */}
                            <View style={styles.topHeader}>
                                <TouchableOpacity
                                    onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Entry' }] })}
                                    style={styles.homeButton}
                                >
                                    <View style={styles.homeIconBox}>
                                        <Home color={Colors.primary} size={20} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.headerContainer}>
                                <NeonText className="text-3xl mb-2" style={{ textAlign: 'center' }}>
                                    {t('welcome.choose_role')}
                                </NeonText>
                            </View>

                            <View style={styles.content}>
                                <View style={styles.roleList}>
                                    {renderRoleCard(
                                        'owner',
                                        Crown,
                                        t('common.host'),
                                        t('welcome.host_desc'),
                                        Colors.primary
                                    )}

                                    {/* Inline Host Options */}
                                    {selectedRole === 'owner' && (
                                        <View style={styles.hostOptionsContainer}>
                                            <NeonText className="text-sm mb-3 pl-2" style={{ color: 'white', fontWeight: 'bold' }}>
                                                {t('entry.select_mode')}
                                            </NeonText>
                                            <View style={styles.hostButtonsRow}>
                                                <TouchableOpacity
                                                    style={[styles.hostOptionBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                                                    onPress={() => handleHostStart('people')}
                                                >
                                                    <Users size={24} color="black" />
                                                    <Text style={[styles.hostOptionText, { color: 'black' }]}>
                                                        PEOPLE
                                                    </Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.hostOptionBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                                                    onPress={() => handleHostStart('menu')}
                                                >
                                                    <Utensils size={24} color="black" />
                                                    <Text style={[styles.hostOptionText, { color: 'black' }]}>
                                                        MENU
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {renderRoleCard(
                                        'participant',
                                        Users,
                                        t('common.participant'),
                                        t('welcome.participant_desc'),
                                        Colors.primary
                                    )}

                                    {/* Inline Participant Options */}
                                    {selectedRole === 'participant' && (
                                        <View style={styles.participantOptionsContainer}>
                                            <View style={styles.roomIdInputContainer}>
                                                <TextInput
                                                    style={styles.roomIdInput}
                                                    placeholder={t('welcome.room_id_placeholder')}
                                                    placeholderTextColor="rgba(255,255,255,0.5)"
                                                    keyboardType="number-pad"
                                                    maxLength={6}
                                                    value={inputRoomId}
                                                    onChangeText={setInputRoomId}
                                                />
                                            </View>

                                            <View style={{ marginTop: 10 }}>
                                                <NeonText className="text-sm mb-3 pl-2" style={{ color: 'white', fontWeight: 'bold' }}>
                                                    {t('entry.select_mode')}
                                                </NeonText>
                                                <View style={styles.hostButtonsRow}>
                                                    <TouchableOpacity
                                                        style={[styles.hostOptionBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                                                        onPress={() => handleParticipantStart('people')}
                                                    >
                                                        <Users size={24} color="black" />
                                                        <Text style={[styles.hostOptionText, { color: 'black' }]}>
                                                            PEOPLE
                                                        </Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={[styles.hostOptionBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                                                        onPress={() => handleParticipantStart('menu')}
                                                    >
                                                        <Utensils size={24} color="black" />
                                                        <Text style={[styles.hostOptionText, { color: 'black' }]}>
                                                            MENU
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
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

                <CyberAlert
                    visible={resumeConfig.visible}
                    title={t('welcome.resume_session')}
                    message={t('welcome.resume_message', { roomId: resumeConfig.roomId })}
                    type="info"
                    confirmText={t('welcome.resume_confirm')}
                    cancelText={t('welcome.resume_cancel')}
                    onConfirm={handleResume}
                    onCancel={handleDiscard}
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
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 20,
    },
    homeButton: {
        padding: 5,
    },
    homeIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    content: {
        width: '100%',
    },
    roleList: {
        gap: 15,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'rgba(20, 20, 20, 0.8)',
        gap: 15,
        minHeight: 100,
    },
    roleIconBox: {
        width: 60,
        height: 60,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    roleContent: {
        flex: 1,
        gap: 4,
    },
    roleTitle: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    },
    roleDesc: {
        color: Colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
    },
    activeIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(255,255,255,0.2)', // Subdued indicator
    },
    hostOptionsContainer: {
        marginTop: 5,
        marginBottom: 10,
        marginLeft: 20,
        paddingLeft: 20,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255,255,255,0.1)',
    },
    hostButtonsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    hostOptionBtn: {
        flex: 1,
        padding: 15,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    hostOptionText: {
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1,
    },
    participantOptionsContainer: {
        marginTop: 5,
        marginBottom: 10,
        marginLeft: 20,
        paddingLeft: 20,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255,255,255,0.1)',
        gap: 10,
    },
    roomIdInputContainer: {
        width: '60%',
        alignSelf: 'flex-end',
    },
    roomIdInput: {
        height: 44,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        borderColor: 'white',
        borderRadius: 12,
        paddingHorizontal: 10,
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
        textAlign: 'center',
    },
    startButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    startButtonText: {
        color: 'black',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 2,
    }
});
