import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { historyService } from '../services/HistoryService';
import { History as HistoryIcon, ArrowLeft, Trash2 } from 'lucide-react-native';

export default function HistoryScreen({ navigation }) {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const data = await historyService.getHistory();
        setHistory(data);
    };

    const clearHistory = async () => {
        await historyService.clearHistory();
        setHistory([]);
    };

    const renderItem = ({ item }) => {
        const date = new Date(item.timestamp);
        const dateString = date.toLocaleDateString();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return (
            <View style={[styles.historyItem, { borderLeftColor: item.type === 'menu' ? Colors.secondary : Colors.primary }]}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <View style={{
                            backgroundColor: `${Colors.accent}20`,
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 3,
                            borderWidth: 0.5,
                            borderColor: Colors.accent
                        }}>
                            <Text style={{ color: Colors.accent, fontSize: 8, fontWeight: 'bold' }}>
                                {item.type === 'menu' ? 'MENU' : 'PEOPLE'}
                            </Text>
                        </View>
                        <NeonText className="text-xl" color={Colors.accent}>{item.name}</NeonText>
                    </View>
                    <Text style={styles.timeText}>{dateString} {timeString}</Text>

                    {/* Check if details exist and render them */}
                    {item.details && item.details.length > 0 && (
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 5 }}>VOTES:</Text>
                            {item.details.map((detail, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <Text style={{ color: detail.isMe ? Colors.success : 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                                        {detail.name} {detail.isMe ? <Text style={{ fontSize: 8 }}> (ME)</Text> : ''}
                                    </Text>
                                    <Text style={{ color: Colors.secondary, fontSize: 11, fontWeight: 'bold' }}>
                                        {detail.votedFor}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
                <View style={[styles.statusBadge, { borderColor: Colors.primary, backgroundColor: 'rgba(0, 255, 255, 0.1)', alignSelf: 'flex-start' }]}>
                    <Text style={[styles.statusText, { color: Colors.primary }]}>WINNER</Text>
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
                            <NeonText className="text-2xl tracking-widest">LOG_HISTORY</NeonText>
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
                                <Text style={styles.emptyText}>NO DATA LOGS FOUND</Text>
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
