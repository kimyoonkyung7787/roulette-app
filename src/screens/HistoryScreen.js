import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { historyService } from '../services/HistoryService';
import { History as HistoryIcon, ArrowLeft, Trash2, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function HistoryScreen({ route, navigation }) {
    const { t } = useTranslation();
    const [history, setHistory] = useState([]);
    const { role, roomId, mode = 'online', category, activeTab: currentTab } = route.params || {};

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const data = await historyService.getHistory();
        if (mode === 'offline') {
            setHistory(data.filter(item => item.roomId === 'offline'));
        } else if (mode === 'online') {
            setHistory(data.filter(item => item.roomId !== 'offline'));
        } else {
            setHistory(data);
        }
    };

    const clearHistory = async () => {
        await historyService.clearHistory();
        setHistory([]);
    };

    const handleRestore = (item) => {
        if (!item.originalList || item.originalList.length === 0) return;

        if (mode === 'offline') {
            // Check if we need to convert from participants format to input format
            // Old history might have saved 'name' instead of 'text'
            let itemsToRestore = item.originalList;
            if (itemsToRestore.length > 0 && !itemsToRestore[0].text && itemsToRestore[0].name) {
                itemsToRestore = itemsToRestore.map((p, i) => ({
                    id: i + 1,
                    text: p.name,
                    color: p.color
                }));
            }

            navigation.navigate('OfflineInput', {
                items: itemsToRestore,
                mode: 'offline'
            });
            return;
        }

        // For menu type, also extract participants from voting details
        let participantsList = null;
        if (item.type === 'menu' && item.details && item.details.length > 0) {
            participantsList = item.details.map(d => ({
                name: d.name,
                weight: 1
            }));
        }

        // Navigate back to NameInput with the restored data AND original session info
        navigation.navigate('NameInput', {
            roomId,
            role,
            mode,
            category: category || item.category || 'coffee',
            initialTab: currentTab || (item.type === 'people' ? 'people' : 'menu'),
            restoredData: {
                type: item.type,
                list: item.originalList,
                participants: participantsList,
                category: item.category || category || 'coffee',
                timestamp: Date.now()
            }
        });
    };

    const renderItem = ({ item }) => {
        const date = new Date(item.timestamp);
        const dateString = date.toLocaleDateString();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const canRestore = (role === 'owner' || mode === 'offline') && item.originalList && item.originalList.length > 0;

        return (
            <View style={[styles.historyItem, { borderLeftColor: item.type === 'menu' ? Colors.secondary : Colors.primary, flexDirection: 'column', alignItems: 'stretch' }]}>
                {/* Top Row: Tag, Name and Winner Badge */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                            backgroundColor: `${item.roomId === 'offline' ? '#666666' : (item.type === 'menu' ? Colors.secondary : Colors.primary)}20`,
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 3,
                            borderWidth: 0.5,
                            borderColor: item.roomId === 'offline' ? '#666666' : (item.type === 'menu' ? Colors.secondary : Colors.primary)
                        }}>
                            <Text style={{ color: item.roomId === 'offline' ? '#AAAAAA' : (item.type === 'menu' ? Colors.secondary : Colors.primary), fontSize: 8, fontWeight: 'bold' }}>
                                {item.roomId === 'offline' ? t('entry.offline_title').toUpperCase() : (item.type === 'menu' ? t('common.menu').toUpperCase() : t('common.people').toUpperCase())}
                            </Text>
                        </View>
                        <NeonText className="text-xl" color={Colors.accent}>{item.name}</NeonText>
                    </View>

                    <View style={[styles.statusBadge, {
                        borderColor: Colors.primary,
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                    }]}>
                        <Text style={[styles.statusText, { color: Colors.primary }]}>{t('result.winner_label').toUpperCase()}</Text>
                    </View>
                </View>

                {/* Middle Row: Date and Room ID */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.timeText}>{dateString} {timeString}</Text>
                    {item.roomId && mode === 'online' && (
                        <Text style={{
                            color: 'rgba(255,255,255,0.8)', // Further increased visibility
                            fontSize: 12,
                            fontWeight: 'bold',
                            letterSpacing: 0.5
                        }}>#{item.roomId.toUpperCase()}</Text>
                    )}
                </View>

                {/* Button and Details column */}
                <View>
                    {canRestore && (
                        <TouchableOpacity
                            onPress={() => handleRestore(item)}
                            style={{
                                marginTop: 15,
                                backgroundColor: 'rgba(57, 255, 20, 0.1)',
                                padding: 10,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: Colors.success,
                                alignSelf: 'flex-start'
                            }}
                        >
                            <Text style={{ color: Colors.success, fontSize: 11, fontWeight: 'bold' }}>
                                {t('history.restore').toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Check if details exist and render them - SKIP for offline items */}
                    {item.roomId !== 'offline' && item.details && item.details.length > 0 && (
                        <View style={{ marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 5 }}>{t('result.votes').toUpperCase()}:</Text>
                            {item.details.map((detail, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Text style={{ color: detail.isMe ? Colors.success : 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                                            {detail.name} {detail.isMe ? <Text style={{ fontSize: 8 }}> {t('common.me')}</Text> : ''}
                                        </Text>
                                        {detail.isOwner && (
                                            <View style={{
                                                backgroundColor: `${Colors.accent}20`,
                                                borderColor: Colors.accent,
                                                borderWidth: 1,
                                                borderRadius: 4,
                                                paddingHorizontal: 4,
                                                paddingVertical: 0,
                                                marginLeft: 6,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                            }}>
                                                <Crown color={Colors.accent} size={8} fill={`${Colors.accent}33`} style={{ marginRight: 2 }} />
                                                <Text style={{ color: Colors.accent, fontSize: 8, fontWeight: 'bold' }}>{t('common.host').toUpperCase()}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={{ color: Colors.secondary, fontSize: 11, fontWeight: 'bold' }}>
                                        {detail.votedFor}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <ArrowLeft color={Colors.primary} size={24} />
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <HistoryIcon color={Colors.primary} size={24} style={{ marginRight: 10 }} />
                            <NeonText className="text-2xl tracking-widest">{t('history.title').toUpperCase()}</NeonText>
                        </View>
                        <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
                            <Trash2 color={Colors.textSecondary} size={18} opacity={0.6} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={history}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>{t('history.no_data').toUpperCase()}</Text>
                            </View>
                        }
                    />
                </View>
            </SafeAreaView>
        </CyberBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 255, 255, 0.2)',
        marginBottom: 10,
    },
    backButton: {
        padding: 5,
    },
    clearButton: {
        padding: 5,
    },
    listContent: {
        paddingVertical: 10,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        marginBottom: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 255, 0.1)',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
    },
    timeText: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginTop: 4,
        opacity: 0.6,
    },
    statusBadge: {
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    statusText: {
        color: Colors.primary,
        fontSize: 10,
        fontWeight: 'bold',
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 14,
        letterSpacing: 2,
        opacity: 0.5,
    },
});
