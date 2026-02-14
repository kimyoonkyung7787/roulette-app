import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { feedbackService } from '../services/FeedbackService';
import { historyService } from '../services/HistoryService';
import { Trophy, RefreshCw, Home, Users, Loader, Power, History, LogOut, X } from 'lucide-react-native';
import { syncService } from '../services/SyncService';

export default function ResultScreen({ route, navigation }) {
    const { winner = 'Unknown', isTie = false, tally = {}, totalParticipants = 0, roomId = 'default', role = 'participant', isForced = false, finalVotes = [] } = route.params || {};
    const [allVoted, setAllVoted] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);

    useEffect(() => {
        // Check if all participants have voted OR it was forced by owner
        const totalVotes = Object.values(tally).reduce((sum, count) => sum + count, 0);
        const votingComplete = isForced || (totalVotes >= totalParticipants && totalParticipants > 0);
        setAllVoted(votingComplete);

        // Trigger success feedback only if all voted or forced
        if (votingComplete) {
            feedbackService.playSuccess();
            // Save to history only when voting is finalized
            historyService.addWinner(winner);
        }
    }, [tally, totalParticipants, isForced]);

    useEffect(() => {
        let unsubSpin, unsubFinal;

        // Sync navigation for participants
        if (role === 'participant') {
            unsubSpin = syncService.subscribeToSpinState(state => {
                // If spin state is cleared (meaning game reset) and navigation is needed
                if (!state?.isSpinning && !state?.lastResult) {
                    console.log('ResultScreen: Room state reset, returning to lobby');
                    navigation.navigate('NameInput', { roomId, role });
                }
            });

            unsubFinal = syncService.subscribeToFinalResults(finalData => {
                // If final results are cleared, return to lobby (unified reset)
                if (!finalData) {
                    console.log('ResultScreen: Final results cleared, returning to lobby');
                    navigation.navigate('NameInput', { roomId, role });
                }
            });
        }

        return () => {
            console.log('ResultScreen: Cleaning up subscriptions');
            if (unsubSpin) unsubSpin();
            if (unsubFinal) unsubFinal();
        };
    }, [role, roomId]);

    useEffect(() => {
        const unsubUsers = syncService.subscribeToOnlineUsers(users => {
            setOnlineUsers(users);
        });
        return () => unsubUsers();
    }, []);

    const handleReset = async () => {
        console.log('ResultScreen: Owner resetting game...');
        await syncService.clearVotes();
        await syncService.clearSpinState();
        await syncService.clearFinalResults();
        // Navigate to NameInput instead of goBack to ensure fresh state
        navigation.navigate('NameInput', { roomId, role });
    };

    const handleReturnToBase = async () => {
        await syncService.clearVotes();
        await syncService.clearSpinState();
        await syncService.clearFinalResults();
        navigation.navigate('NameInput', { roomId, role });
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <View style={{ width: '100%', marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{
                            backgroundColor: 'rgba(0, 255, 255, 0.1)',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: Colors.primary,
                            shadowColor: Colors.primary,
                            shadowOpacity: 0.3,
                            shadowRadius: 5
                        }}>
                            <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>#ROOM: {roomId.toUpperCase()}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 8 }}>
                                <Users color={Colors.success} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('History')} style={{ padding: 8 }}>
                                <History color={Colors.primary} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Welcome')}
                                style={{ padding: 8 }}
                            >
                                <LogOut color={Colors.error} size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* Trophy or In-Progress Icon */}
                    <View style={styles.trophyContainer}>
                        {allVoted ? (
                            <>
                                <Trophy color={Colors.accent} size={80} strokeWidth={1} />
                                <View style={styles.trophyGlow} />
                            </>
                        ) : (
                            <>
                                <Loader color={Colors.primary} size={80} strokeWidth={1.5} />
                                <View style={styles.loaderGlow} />
                            </>
                        )}
                    </View>

                    <View style={styles.resultBox}>
                        <Text style={styles.label}>
                            {allVoted
                                ? (isTie ? 'TIE DETECTED' : 'CONGRATULATIONS!')
                                : '투표 진행 중...'}
                        </Text>
                        <View style={styles.winnerNameContainer}>
                            <NeonText
                                className={winner.length > 10 ? "text-4xl text-center" : "text-6xl text-center"}
                                color={isTie ? Colors.primary : Colors.secondary}
                            >
                                {winner}
                            </NeonText>
                        </View>
                        {allVoted && isTie && <Text style={styles.tieSubText}>득표수가 동일하여 공동 우승 처리되었습니다!</Text>}

                        {/* Tally Chart */}
                        <View style={styles.tallyContainer}>
                            {Object.entries(tally).map(([name, count]) => (
                                <View key={name} style={styles.tallyItem}>
                                    <Text style={styles.tallyName}>{name}</Text>
                                    <View style={styles.tallyBarContainer}>
                                        <View style={[styles.tallyBar, { width: `${(count / Math.max(...Object.values(tally))) * 100}%` }]} />
                                    </View>
                                    <Text style={styles.tallyCount}>{count}표</Text>
                                </View>
                            ))}
                        </View>

                        <Text style={styles.subText}>
                            {!allVoted && '다른 참가자의 투표를 기다리는 중...'}
                        </Text>
                    </View>

                    {role === 'owner' ? (
                        <View style={styles.footer}>
                            <TouchableOpacity
                                onPress={handleReset}
                                activeOpacity={0.7}
                                style={styles.retryButton}
                            >
                                <RefreshCw color={Colors.primary} size={18} style={{ marginRight: 8 }} />
                                <Text style={styles.retryText}>RETRY</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                </View>

                {/* Online Users Modal */}
                <Modal
                    visible={showUsersModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowUsersModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>ACTIVE NODES</Text>
                                <TouchableOpacity onPress={() => setShowUsersModal(false)}>
                                    <X color={Colors.primary} size={24} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.tableHeader}>
                                <Text style={styles.tableHeaderText}>VOTER</Text>
                                <Text style={styles.tableHeaderText}>WINNER</Text>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
                                {onlineUsers.map((user) => {
                                    const userVote = finalVotes.find(v => v.userId === user.id);
                                    return (
                                        <View key={user.id} style={styles.userItem}>
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={[styles.userStatusDot, { backgroundColor: userVote ? Colors.success : Colors.primary }]} />
                                                <Text style={styles.userName}>
                                                    {user.name} {user.id === syncService.myId ? '(ME)' : ''}
                                                </Text>
                                            </View>
                                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: userVote ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255,255,255,0.1)' }}>
                                                <Text style={{ color: userVote ? Colors.success : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 'bold' }}>
                                                    {userVote ? userVote.votedFor : 'SPINNING...'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                                {onlineUsers.length === 0 && (
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginVertical: 20 }}>NO ACTIVE NODES DETECTED</Text>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </CyberBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        paddingVertical: 50,
    },
    trophyContainer: {
        marginTop: 40,
        marginBottom: 50,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trophyGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.accent,
        opacity: 0.15,
        zIndex: -1,
    },
    loaderGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.primary,
        opacity: 0.2,
        zIndex: -1,
    },
    resultBox: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 40,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        shadowColor: Colors.secondary,
        shadowOpacity: 0.2,
        shadowRadius: 30,
        elevation: 10,
    },
    label: {
        color: Colors.primary,
        fontSize: 13,
        letterSpacing: 4,
        fontWeight: 'bold',
        marginBottom: 20,
        opacity: 0.8,
    },
    winnerNameContainer: {
        marginVertical: 10,
    },
    subText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
        letterSpacing: 2,
        marginTop: 25,
    },
    tieSubText: {
        color: Colors.primary,
        fontSize: 14,
        marginTop: 5,
        fontWeight: '500',
    },
    tallyContainer: {
        width: '100%',
        marginTop: 30,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    tallyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    tallyName: {
        color: 'white',
        width: 80,
        fontSize: 12,
    },
    tallyBarContainer: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 3,
        marginHorizontal: 10,
        overflow: 'hidden',
    },
    tallyBar: {
        height: '100%',
        backgroundColor: Colors.secondary,
        borderRadius: 3,
    },
    tallyCount: {
        color: Colors.textSecondary,
        width: 30,
        fontSize: 12,
        textAlign: 'right',
    },
    footer: {
        width: '100%',
        marginTop: 'auto',
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    retryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    retryText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    homeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    homeText: {
        color: Colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    terminateButton: {
        borderWidth: 1,
        borderColor: Colors.error,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(255, 49, 49, 0.05)',
        marginTop: 20,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
    },
    terminateText: {
        color: Colors.error,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: Colors.background,
        borderRadius: 20,
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
        marginBottom: 15,
    },
    modalTitle: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    modalDivider: {
        height: 1,
        backgroundColor: 'rgba(0,255,255,0.2)',
        marginBottom: 20,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    userName: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    userStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 12,
    },
    tableHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 255, 255, 0.2)',
        marginBottom: 5,
    },
    tableHeaderText: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
});
