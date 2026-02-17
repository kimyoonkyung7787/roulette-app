import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, ScrollView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { CyberAlert } from '../components/CyberAlert';
import { feedbackService } from '../services/FeedbackService';
import { historyService } from '../services/HistoryService';
import { syncService } from '../services/SyncService';
import { useTranslation } from 'react-i18next';
import { Share2, ListChecks, History, LogOut, Trophy, Loader, RefreshCw, X } from 'lucide-react-native';

export default function ResultScreen({ route, navigation }) {
    const { t } = useTranslation();
    const { winner = 'Unknown', isTie = false, tally = {}, totalParticipants = 0, roomId = 'default', role = 'participant', isForced = false, finalVotes = [], type = 'people', category = 'coffee' } = route.params || {};
    const [allVoted, setAllVoted] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const hasSavedRef = useRef(false);

    useEffect(() => {
        // Check if all participants have voted OR it was forced by owner
        const totalVotes = Object.values(tally).reduce((sum, count) => sum + count, 0);
        const votingComplete = isForced || (totalVotes >= totalParticipants && totalParticipants > 0);
        setAllVoted(votingComplete);

        // Trigger success feedback only if all voted or forced
        // We wait for either onlineUsers or finalVotes to have data to ensure details are saved
        if (votingComplete && !hasSavedRef.current) {
            // Need at least some vote info to save meaningful details
            if (finalVotes && finalVotes.length > 0) {
                // Always play fanfare when results are ready
                console.log('🎺 ResultScreen: Attempting to play fanfare...');

                // Ensure audio is loaded before playing
                const playFanfareWithLoading = async () => {
                    console.log('🎺 playFanfareWithLoading: Starting...');
                    console.log('🎺 playFanfareWithLoading: isLoaded =', feedbackService.isLoaded);

                    if (!feedbackService.isLoaded) {
                        console.log('🎺 playFanfareWithLoading: Audio not loaded yet, loading now...');
                        await feedbackService.loadAssets();
                        console.log('🎺 playFanfareWithLoading: loadAssets completed');
                        console.log('🎺 playFanfareWithLoading: isLoaded after loading =', feedbackService.isLoaded);
                    }

                    console.log('🎺 playFanfareWithLoading: About to call playFanfare...');
                    await feedbackService.playFanfare();
                    console.log('🎺 playFanfareWithLoading: playFanfare completed');
                };

                playFanfareWithLoading()
                    .then(() => console.log('🎺 ResultScreen: Fanfare played successfully!'))
                    .catch(err => console.error('🎺 ResultScreen: Fanfare failed:', err));

                // Construct details: prefer onlineUsers for complete list, fallback to finalVotes
                let details = [];
                if (onlineUsers && onlineUsers.length > 0) {
                    details = onlineUsers.map(user => {
                        const vote = finalVotes.find(v => v.userId === user.id);
                        return {
                            name: user.name,
                            votedFor: vote ? vote.votedFor : 'NO VOTE',
                            isMe: user.id === syncService.myId
                        };
                    });
                } else {
                    // Fallback to purely finalVotes if onlineUsers hasn't synced yet
                    details = finalVotes.map(v => ({
                        name: v.userName || 'Unknown',
                        votedFor: v.votedFor,
                        isMe: v.userId === syncService.myId
                    }));
                }

                console.log(`ResultScreen: Saving history with ${details.length} details`);
                const originalList = type === 'people' ? route.params.participants : route.params.menuItems;
                historyService.addWinner(winner, type, details, originalList, roomId, category);
                hasSavedRef.current = true;
            }
        }
    }, [tally, totalParticipants, isForced, winner, type, onlineUsers, finalVotes]);

    useEffect(() => {
        let unsubFinal;

        // Sync navigation for participants
        if (role === 'participant') {

            unsubFinal = syncService.subscribeToFinalResults(finalData => {
                // If final results are cleared, return to lobby (unified reset)
                if (!finalData) {
                    console.log('ResultScreen: Final results cleared, returning to lobby');
                    navigation.navigate('NameInput', { roomId, role, category, initialTab: type });
                }
            });
        }

        return () => {
            console.log('ResultScreen: Cleaning up subscriptions');
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
        console.log(`ResultScreen: Owner resetting game (preserving type: ${type})...`);
        await syncService.setRoomPhase('waiting');
        await syncService.clearSpinState();
        await syncService.clearFinalResults();

        // Navigation to NameInput with type to restore correct tab
        navigation.navigate('NameInput', { roomId, role, category, initialTab: type });
    };

    const handleReturnToBase = async () => {
        console.log('ResultScreen: Returning to lobby...');
        await syncService.setRoomPhase('waiting');
        await syncService.clearSpinState();
        await syncService.clearFinalResults();
        navigation.navigate('NameInput', { roomId, role, category, initialTab: type });
    };

    const handleShare = async () => {
        try {
            const safeWinner = winner || t('common.unknown');
            const safeRoomId = roomId ? roomId.toUpperCase() : 'UNKNOWN';

            const shareTitle = `🎰 ${t('result.share_title')}: ${safeWinner}`;
            const message = `🏆 ${t('result.winner_label')}: ${safeWinner}\n📍 ${t('common.room')}: ${safeRoomId}\n\n${t('result.share_message')} ✨`;

            await Share.share({
                title: shareTitle,
                message: message,
            });
        } catch (error) {
            console.error('ResultScreen: Sharing failed', error);
        }
    };

    const handleExit = () => {
        setShowExitConfirm(true);
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
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
                                <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>#{t('common.room_id')}: {(roomId || '').toUpperCase()}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                                <TouchableOpacity onPress={handleShare} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Share2 color={Colors.accent} size={24} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 4 }}>
                                    <ListChecks color={Colors.success} size={24} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => navigation.navigate('History', { role, roomId, category })} style={{ padding: 4 }}>
                                    <History color={Colors.primary} size={24} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleExit}
                                    style={{ padding: 4 }}
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
                                    ? (isTie ? t('result.tie_detected') : t('result.congratulations'))
                                    : t('result.voting_in_progress')}
                            </Text>
                            <View style={styles.winnerNameContainer}>
                                <NeonText
                                    style={{
                                        fontSize: winner.length > 20 ? 28 : (winner.length > 10 ? 36 : 56),
                                        textAlign: 'center',
                                        lineHeight: winner.length > 20 ? 34 : (winner.length > 10 ? 42 : 64),
                                        color: Colors.primary
                                    }}
                                >
                                    {winner}
                                </NeonText>
                            </View>
                            {allVoted && isTie && <Text style={styles.tieSubText}>{t('result.tie_subtext')}</Text>}

                            {/* Tally Chart */}
                            <View style={styles.tallyContainer}>
                                {Object.entries(tally).map(([name, count]) => (
                                    <View key={name} style={styles.tallyItem}>
                                        <Text style={styles.tallyName}>{name}</Text>
                                        <View style={styles.tallyBarContainer}>
                                            {[...Array(Math.max(totalParticipants, 5))].map((_, i) => (
                                                <View
                                                    key={i}
                                                    style={[
                                                        styles.tallyCell,
                                                        { backgroundColor: i < count ? Colors.secondary : 'rgba(255,255,255,0.05)' }
                                                    ]}
                                                />
                                            ))}
                                        </View>
                                        <View style={styles.tallyCountContainer}>
                                            <Text style={styles.tallyCountValue}>{count}</Text>
                                            <Text style={styles.tallyCountLabel}>{count === 1 ? t('result.vote') : t('result.votes')}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.subText}>
                                {!allVoted && t('result.waiting_for_others')}
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
                                    <Text style={styles.retryText}>{t('result.retry').toUpperCase()}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                    </View>
                </ScrollView>

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
                                <Text style={styles.modalTitle}>{t('name_input.participant_status').toUpperCase()}</Text>
                                <TouchableOpacity onPress={() => setShowUsersModal(false)}>
                                    <X color={Colors.primary} size={24} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.tableHeader}>
                                <Text style={styles.tableHeaderText}>{t('name_input.voter').toUpperCase()}</Text>
                                <Text style={styles.tableHeaderText}>{t('name_input.winner').toUpperCase()}</Text>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
                                {onlineUsers.map((user) => {
                                    const userVote = finalVotes.find(v => v.userId === user.id);
                                    return (
                                        <View key={user.id} style={styles.userItem}>
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={[styles.userStatusDot, { backgroundColor: userVote ? Colors.success : Colors.primary }]} />
                                                <Text style={styles.userName}>
                                                    {user.name} {user.id === syncService.myId ? <Text style={{ fontSize: 10 }}> {t('common.me')}</Text> : ''}
                                                </Text>
                                            </View>
                                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: userVote ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255,255,255,0.1)' }}>
                                                <Text style={{ color: userVote ? Colors.success : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 'bold' }}>
                                                    {userVote ? userVote.votedFor : t('roulette.spinning')}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                                {onlineUsers.length === 0 && (
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginVertical: 20 }}>{t('roulette.no_participants').toUpperCase()}</Text>
                                )}
                            </ScrollView>
                        </View>
                    </View>

                </Modal>
                <CyberAlert
                    visible={showExitConfirm}
                    title={t('common.alert')}
                    message={t('common.exit_confirm')}
                    onConfirm={() => {
                        setShowExitConfirm(false);
                        navigation.navigate('Welcome');
                    }}
                    onCancel={() => setShowExitConfirm(false)}
                    confirmText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    type="info"
                />
            </SafeAreaView>
        </CyberBackground >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        paddingVertical: 50,
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
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
        flexDirection: 'row',
        gap: 2,
        height: 12,
        marginHorizontal: 10,
    },
    tallyCell: {
        flex: 1,
        height: '100%',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tallyCountContainer: {
        width: 60,
        alignItems: 'flex-end',
    },
    tallyCountValue: {
        color: Colors.secondary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    tallyCountLabel: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 8,
        letterSpacing: 1,
        marginTop: -3,
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
        paddingVertical: 12,
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
        paddingVertical: 12,
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
        paddingVertical: 12,
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
