import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions, Image, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { Coffee, Utensils, Pizza, Crown, User, ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { id: 'coffee', label: 'COFFEE', icon: Coffee, color: Colors.neonPink },
    { id: 'meal', label: 'MEAL', icon: Utensils, color: Colors.success },
    { id: 'snack', label: 'SNACK', icon: Pizza, color: Colors.accent },
];

const ROLES = [
    { id: 'owner', label: 'OWNER', icon: Crown, description: 'Manage participants' },
    { id: 'participant', label: 'PARTICIPANT', icon: User, description: 'Join existing list' },
];

export default function WelcomeScreen({ navigation }) {
    const [selectedCategory, setSelectedCategory] = useState('coffee');
    const [selectedRole, setSelectedRole] = useState('owner');
    const [inputRoomId, setInputRoomId] = useState('');

    const generateRoomId = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const handleStart = () => {
        let roomId = '';

        if (selectedRole === 'owner') {
            roomId = generateRoomId();
        } else {
            if (inputRoomId.length !== 6) {
                Alert.alert('알림', '6자리 방 번호를 입력해주세요!');
                return;
            }
            roomId = inputRoomId;
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
                <View style={styles.container}>
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
                                ROULETTE GAME
                            </NeonText>
                        </View>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.section}>
                            <NeonText className="text-sm mb-4 opacity-70">SELECT_CATEGORY</NeonText>
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
                                        ]}>{cat.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <NeonText className="text-sm mb-4 opacity-70">CHOOSE_YOUR_ROLE</NeonText>
                            <View style={styles.roleContainer}>
                                {ROLES.map((role) => (
                                    <View key={role.id}>
                                        <TouchableOpacity
                                            onPress={() => setSelectedRole(role.id)}
                                            style={[
                                                styles.roleCard,
                                                selectedRole === role.id && { borderColor: Colors.primary, backgroundColor: 'rgba(0, 255, 255, 0.1)' }
                                            ]}
                                        >
                                            <View style={styles.roleIconBox}>
                                                <role.icon size={24} color={selectedRole === role.id ? Colors.primary : Colors.textSecondary} />
                                            </View>
                                            <View>
                                                <Text style={[styles.roleLabel, selectedRole === role.id && { color: Colors.primary }]}>{role.label}</Text>
                                                <Text style={styles.roleDesc}>{role.description}</Text>
                                            </View>
                                            {selectedRole === role.id && <View style={styles.checkMark} />}
                                        </TouchableOpacity>

                                        {role.id === 'participant' && selectedRole === 'participant' && (
                                            <View style={styles.roomIdInputContainer}>
                                                <TextInput
                                                    style={styles.roomIdInput}
                                                    placeholder="ENTER 6-DIGIT ROOM_ID"
                                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                                    keyboardType="number-pad"
                                                    maxLength={6}
                                                    value={inputRoomId}
                                                    onChangeText={setInputRoomId}
                                                />
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.startButton, { shadowColor: Colors.primary }]}
                            onPress={handleStart}
                        >
                            <Text style={styles.startButtonText}>INITIATE_SESSION</Text>
                            <ArrowRight color="black" size={20} style={{ marginLeft: 10 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </CyberBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 25,
    },
    heroContainer: {
        alignItems: 'center',
        paddingVertical: 40,
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
        flex: 1,
        justifyContent: 'center',
    },
    section: {
        marginBottom: 35,
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
        gap: 12,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        gap: 15,
    },
    roleIconBox: {
        width: 45,
        height: 45,
        borderRadius: 10,
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
        right: 15,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowRadius: 5,
        shadowOpacity: 1,
        elevation: 5,
    },
    roomIdInputContainer: {
        marginTop: 10,
        paddingHorizontal: 5,
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
        height: 56,
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
