import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { NeonText } from '../components/NeonText';
import { Plus, Minus, ArrowRight, Home, Trash2, RotateCw } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const ITEM_COLORS = [
    '#ff6b6b', '#ffb74d', '#ffd54f', '#aed581', '#4db6ac',
    '#4fc3f7', '#7986cb', '#9575cd', '#f06292', '#a1887f'
];

export default function OfflineInputScreen({ route, navigation }) {
    const { t } = useTranslation();
    const initialParamsItems = route.params?.items || [];

    const [items, setItems] = useState(route.params?.items && route.params.items.length >= 2 ? route.params.items : [
        { id: 1, text: '', color: ITEM_COLORS[0] },
        { id: 2, text: '', color: ITEM_COLORS[1] },
    ]);

    // Sync items when returning from ResultScreen with originalItems
    React.useEffect(() => {
        if (route.params?.items && route.params.items.length >= 2) {
            setItems(route.params.items);
        }
    }, [route.params?.items]);

    const handleAddItem = () => {
        if (items.length < 10) {
            const nextId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
            setItems([...items, { id: nextId, text: '', color: ITEM_COLORS[items.length % ITEM_COLORS.length] }]);
        }
    };

    const handleRemoveItem = (id) => {
        if (items.length > 2) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItemText = (id, text) => {
        setItems(items.map(item => item.id === id ? { ...item, text } : item));
    };

    const handleStart = () => {
        // Prepare items for RouletteScreen
        const finalItems = items.map((item, index) => ({
            name: item.text.trim() || `${t('common.item')} ${index + 1}`,
            weight: 1,
            color: item.color
        }));

        navigation.navigate('Roulette', {
            participants: finalItems,
            mode: 'offline',
            role: 'owner',
            spinTarget: 'people',
            autoSpin: false, // Disable auto spin in offline mode
            originalItems: items // Keep original items to return later
        });
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Entry' }] })}
                            style={styles.headerButton}
                        >
                            <Home color={Colors.primary} size={22} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.container}>
                            {/* Counter Section */}
                            <View style={styles.counterSection}>
                                <TouchableOpacity
                                    onPress={() => handleRemoveItem(items[items.length - 1].id)}
                                    style={[styles.counterBtn, items.length <= 2 && styles.disabledBtn]}
                                    disabled={items.length <= 2}
                                >
                                    <Minus color={items.length <= 2 ? Colors.textSecondary : Colors.primary} size={24} />
                                </TouchableOpacity>

                                <View style={styles.countWheel}>
                                    <View style={styles.countWheelOuter}>
                                        <Text style={styles.countText}>{items.length}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={handleAddItem}
                                    style={[styles.counterBtn, items.length >= 10 && styles.disabledBtn]}
                                    disabled={items.length >= 10}
                                >
                                    <Plus color={items.length >= 10 ? Colors.textSecondary : Colors.primary} size={24} />
                                </TouchableOpacity>
                            </View>

                            {/* Item List */}
                            <View style={styles.listContainer}>
                                {items.map((item, index) => (
                                    <View key={item.id} style={styles.inputRow}>
                                        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder={t('offline.item_placeholder', { num: index + 1 })}
                                            placeholderTextColor="rgba(255,255,255,0.2)"
                                            value={item.text}
                                            onChangeText={(text) => updateItemText(item.id, text)}
                                        />
                                        {items.length > 2 && (
                                            <TouchableOpacity
                                                onPress={() => handleRemoveItem(item.id)}
                                                style={styles.deleteBtn}
                                            >
                                                <Minus color="rgba(255,255,255,0.4)" size={20} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={styles.startButton}
                                onPress={handleStart}
                            >
                                <RotateCw color={Colors.primary} size={20} style={{ marginRight: 10 }} />
                                <Text style={styles.startButtonText}>{t('roulette.ready_shout')}</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </CyberBackground>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 255, 0.2)',
    },
    scrollContent: {
        flexGrow: 1,
    },
    container: {
        paddingHorizontal: 25,
        paddingBottom: 40,
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    counterSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 30,
        gap: 20,
    },
    counterBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledBtn: {
        opacity: 0.3,
    },
    countWheel: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: 'rgba(0, 255, 255, 0.1)',
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countWheelOuter: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 255, 0.3)',
    },
    countText: {
        color: Colors.primary,
        fontSize: 40,
        fontWeight: '900',
    },
    listContainer: {
        gap: 12,
        marginBottom: 30,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        paddingHorizontal: 15,
        height: 60,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    colorDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 15,
    },
    textInput: {
        flex: 1,
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    deleteBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    startButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    startButtonText: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    }
});
