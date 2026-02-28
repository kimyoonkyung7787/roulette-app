import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, ScrollView, Share, Alert, Animated, Easing, Platform, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { CyberAlert } from '../components/CyberAlert';
import { feedbackService } from '../services/FeedbackService';
import { historyService } from '../services/HistoryService';
import { syncService } from '../services/SyncService';
import { useTranslation } from 'react-i18next';
import { Share2, History, LogOut, RefreshCw, CheckCircle2, CircleOff, Crown, Coffee, UtensilsCrossed, Cookie, Package } from 'lucide-react-native';
import { Confetti } from '../components/Confetti';

const CATEGORY_ICONS = {
    coffee: { Icon: Coffee, color: Colors.neonPink },
    meal: { Icon: UtensilsCrossed, color: Colors.success },
    snack: { Icon: Cookie, color: Colors.accent },
    etc: { Icon: Package, color: Colors.primary },
};

export default function MenuResultScreen({ route, navigation }) {
    const { t } = useTranslation();
    const {
        winner = 'Unknown',
        isTie = false,
        tally = {},
        totalParticipants = 0,
        roomId = 'default',
        mode = 'online',
        role = 'participant',
        isForced = false,
        finalVotes: rawFinalVotes = [],
        type = 'menu',
        category = 'coffee',
        originalItems = [],
        participants: rawParticipants = [],
        joinedNames: rawJoinedNames = [],
        hostName: hostNameFromParams
    } = route.params || {};

    // Firebase/Chrome: finalVotes가 객체로 올 수 있음 → 항상 배열로 정규화
    const finalVotes = Array.isArray(rawFinalVotes)
        ? rawFinalVotes
        : (rawFinalVotes && typeof rawFinalVotes === 'object')
            ? Object.values(rawFinalVotes)
            : [];
    const ensureArray = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const norm = (s) => String(s || '').trim().replace(/\s+/g, '');

    const [allVoted, setAllVoted] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showHostRestartedAlert, setShowHostRestartedAlert] = useState(false);
    const [showHostEndedAlert, setShowHostEndedAlert] = useState(false);
    const [fixedParticipantDetails, setFixedParticipantDetails] = useState(null);
    const onlineUsersRef = useRef([]);
    const lastFinalDataRef = useRef(route.params || null); // Track last known valid data
    const isInitialMountRef = useRef(true); // Flag to skip initial null during mount
    const hostRestartedShownRef = useRef(false);

    const pulseAnim = useRef(new Animated.Value(0)).current;
    const iconBounceAnim = useRef(new Animated.Value(0)).current;

    // Back key blocking
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
                e.preventDefault();
            }
        });
        const handlePopState = () => { window.history.pushState(null, '', window.location.href); };
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.history.pushState(null, '', window.location.href);
            window.addEventListener('popstate', handlePopState);
        }
        return () => {
            backHandler.remove();
            unsubscribe();
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.removeEventListener('popstate', handlePopState);
            }
        };
    }, [navigation]);

    // Waiting pulse animation
    useEffect(() => {
        if (!allVoted) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.delay(800)
                ])
            );
            animation.start();
            return () => animation.stop();
        }
    }, [allVoted]);

    // Icon bounce when result revealed
    useEffect(() => {
        if (allVoted) {
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(iconBounceAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
                    Animated.timing(iconBounceAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.delay(2000)
                ])
            );
            anim.start();
            return () => anim.stop();
        }
    }, [allVoted]);

    // Vote completion detection + history saving + fanfare
    useEffect(() => {
        let totalVotes = 0;
        const voteCounts = Object.values(tally || {});
        for (let i = 0; i < voteCounts.length; i++) {
            totalVotes += (voteCounts[i] || 0);
        }
        const votingComplete = isForced || (totalVotes >= totalParticipants && totalParticipants > 0);
        setAllVoted(votingComplete);

        if (votingComplete && !hasSavedRef.current) {
            if (finalVotes && finalVotes.length > 0) {
                const playFanfareWithLoading = async () => {
                    if (!feedbackService.isLoaded) await feedbackService.loadAssets();
                    await feedbackService.playFanfare();
                };
                playFanfareWithLoading()
                    .then(() => setTimeout(() => setAllVoted(true), 100))
                    .catch(err => console.error('MenuResultScreen: Fanfare failed:', err));

                // 피플모드처럼 전체 참여자(미접속 포함) 리스트 표시
                const participants = ensureArray(rawParticipants);
                const joinedNames = ensureArray(rawJoinedNames);
                const joinedSet = new Set(joinedNames.map(n => norm(String(n))));
                const getName = (p) => typeof p === 'object' ? (p.name || p.text || '') : String(p);
                const fromParams = participants.map(p => ({ name: getName(p) })).filter(u => u.name && u.name.trim());
                const fromJoined = joinedNames.map(n => ({ name: String(n).trim() })).filter(u => u.name);
                const fromVotes = (finalVotes || []).map(v => ({ name: (v.userName || v.votedFor || '').trim() })).filter(u => u.name);
                const detailNameToItem = new Map(fromParams.map(u => [norm(u.name), u]));
                [...fromJoined, ...fromVotes].forEach(u => { const k = norm(u.name); if (k && !detailNameToItem.has(k)) detailNameToItem.set(k, { name: u.name }); });
                const fullParticipantsForDetails = Array.from(detailNameToItem.values());

                let details = [];
                if (fullParticipantsForDetails.length > 0) {
                    details = fullParticipantsForDetails.map(p => {
                        const name = (p.name || '').trim();
                        if (!name) return null;
                        const joined = joinedSet.has(norm(name));
                        const vote = finalVotes.find(v => v.userName === name);
                        const isUserOwner = (hostNameFromParams && norm(name) === norm(hostNameFromParams)) || name === roomId;
                        return {
                            name,
                            votedFor: joined ? (vote ? vote.votedFor : t('common.no_vote').toUpperCase()) : t('common.not_connected').toUpperCase(),
                            isNotConnected: !joined,
                            isMe: syncService.myName === name,
                            isOwner: isUserOwner
                        };
                    }).filter(Boolean);
                } else {
                    details = finalVotes.map(v => ({
                        name: v.userName || 'Unknown',
                        votedFor: v.votedFor,
                        isMe: v.userId === syncService.myId,
                        isOwner: (hostNameFromParams && v.userName === hostNameFromParams) || (v.userName === roomId) || (v.userId === syncService.myId && role === 'owner')
                    }));
                }

                const originalList = route.params.menuItems;
                historyService.addWinner(winner, type, details, originalList, roomId, category);
                hasSavedRef.current = true;
                setFixedParticipantDetails(details.map((d, i) => ({
                    id: (d.name || '') + '-' + i,
                    name: d.name,
                    votedFor: d.votedFor,
                    isMe: d.isMe,
                    isOwner: d.isOwner
                })));
            }
        }
    }, [tally, totalParticipants, isForced, winner, type, onlineUsers, finalVotes, rawParticipants, rawJoinedNames]);

    // Participant reset sync: when host retries, show message then navigate
    // Use CyberAlert (Modal) instead of Alert.alert - Alert does NOT work on web (Firefox, IE, Chrome)
    useEffect(() => {
        let isMounted = true;
        let unsubFinal;
        let unsubRoomDeleted;
        let alertShown = false;

        // Give extra time for navigation/data sync to settle before listening for "restarts"
        const mountTimer = setTimeout(() => {
            if (isMounted) isInitialMountRef.current = false;
        }, 1500);

        if (role === 'participant') {
            unsubFinal = syncService.subscribeToFinalResults((finalData) => {
                // Ignore if still mounting or if data hasn't actually changed from present to null
                if (isInitialMountRef.current) {
                    if (finalData) lastFinalDataRef.current = finalData;
                    return;
                }

                if (!finalData && lastFinalDataRef.current && !hostRestartedShownRef.current && !alertShown) {
                    // Firebase optimistic update race condition prevention:
                    // If room is deleted, subscribeToRoomDeleted will fire almost simultaneously.
                    // We wait 400ms. If alertShown is still false, it means it's a retry, not an exit.
                    setTimeout(() => {
                        if (!isMounted || alertShown) return;

                        alertShown = true;
                        hostRestartedShownRef.current = true;
                        setShowHostRestartedAlert(true);
                    }, 400);
                }

                if (finalData) {
                    lastFinalDataRef.current = finalData;
                }
            });

            // Listen for room deletion (when host exits completely)
            unsubRoomDeleted = syncService.subscribeToRoomDeleted(() => {
                if (!isMounted) return;

                if (!alertShown) {
                    alertShown = true;
                    setShowHostRestartedAlert(false);
                    setShowHostEndedAlert(true);
                }
            });
        }
        return () => {
            isMounted = false;
            clearTimeout(mountTimer);
            if (unsubFinal) unsubFinal();
            if (unsubRoomDeleted) unsubRoomDeleted();
        };
    }, [role, roomId]);

    // Online users subscription
    useEffect(() => {
        const unsubUsers = syncService.subscribeToOnlineUsers(users => {
            setOnlineUsers(users);
        });
        return () => unsubUsers();
    }, []);

    const handleReset = async () => {
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

            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({ title: shareTitle, text: message });
                } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(message);
                    Alert.alert(t('common.success'), t('result.copied_to_clipboard'));
                } else {
                    Alert.alert(t('common.info'), message);
                }
            } else {
                await Share.share({ title: shareTitle, message });
            }
        } catch (error) {
            console.error('MenuResultScreen: Sharing failed', error);
        }
    };

    const catInfo = CATEGORY_ICONS[category] || CATEGORY_ICONS.etc;
    const CatIcon = catInfo.Icon;
    const catColor = catInfo.color;


    const participantDetails = (() => {
        if (fixedParticipantDetails && fixedParticipantDetails.length > 0) {
            return fixedParticipantDetails;
        }
        // 피플모드처럼 전체 참여자(미접속 포함) 표시
        const participants = ensureArray(rawParticipants);
        const joinedNames = ensureArray(rawJoinedNames);
        const joinedSet = new Set(joinedNames.map(n => norm(String(n))));
        const getName = (p) => typeof p === 'object' ? (p.name || p.text || '') : String(p);
        const fromParams = participants.map(p => ({ name: getName(p) })).filter(u => u.name && u.name.trim());
        const fromJoined = joinedNames.map(n => ({ name: String(n).trim() })).filter(u => u.name);
        const fromVotes = (finalVotes || []).map(v => ({ name: (v.userName || '').trim() })).filter(u => u.name);
        const detailNameToItem = new Map(fromParams.map(u => [norm(u.name), u]));
        [...fromJoined, ...fromVotes].forEach(u => { const k = norm(u.name); if (k && !detailNameToItem.has(k)) detailNameToItem.set(k, { name: u.name }); });
        const fullList = Array.from(detailNameToItem.values());
        if (fullList.length > 0) {
            return fullList.map((p, idx) => {
                const name = (p.name || '').trim();
                const joined = joinedSet.has(norm(name));
                const vote = finalVotes.find(v => v.userName === name);
                return {
                    id: name + '-' + idx,
                    name,
                    votedFor: joined ? (vote ? vote.votedFor : null) : t('common.not_connected'),
                    isMe: syncService.myName === name,
                    isOwner: (hostNameFromParams && norm(name) === norm(hostNameFromParams)) || name === roomId || (syncService.myId && syncService.myName === name && role === 'owner'),
                    isNotConnected: !joined
                };
            });
        }
        if (onlineUsers && onlineUsers.length > 0) {
            return onlineUsers.map((user, idx) => {
                const vote = finalVotes.find(v => v.userId === user.id);
                return {
                    id: user.id ?? `user-${idx}`,
                    name: user.name,
                    votedFor: vote ? vote.votedFor : null,
                    isMe: user.id === syncService.myId,
                    isOwner: user.role === 'owner' || (user.id === syncService.myId && role === 'owner'),
                    isNotConnected: false
                };
            });
        }
        return finalVotes.map((v, idx) => ({
            id: v.userId ?? `vote-${idx}`,
            name: v.userName || 'Unknown',
            votedFor: v.votedFor,
            isMe: v.userId === syncService.myId,
            isOwner: v.userId === syncService.myId && role === 'owner',
            isNotConnected: false
        }));
    })();

    const tallyEntries = Object.entries(tally);
    const sortedParticipants = [...participantDetails].sort((a, b) => {
        if (a.votedFor && !b.votedFor) return -1;
        if (!a.votedFor && b.votedFor) return 1;
        return 0;
    });

    const iconScale = iconBounceAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
    const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

    return (
        <CyberBackground>
            <Confetti active={allVoted} />
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={styles.container}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.roomBadge}>
                                <Text style={styles.roomBadgeText}>#{t('common.room_id')}: {(roomId || '').toUpperCase()}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                <TouchableOpacity onPress={handleShare} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Share2 color={Colors.accent} size={24} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => navigation.navigate('History', { role, roomId, mode, category, activeTab: 'menu' })} style={{ padding: 4 }}>
                                    <History color={Colors.primary} size={24} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowExitConfirm(true)} style={{ padding: 4 }}>
                                    <LogOut color="rgba(255,255,255,0.45)" size={24} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Winner Section */}
                        <View style={styles.winnerCard}>
                            <Animated.View style={{ transform: [{ scale: allVoted ? iconScale : pulseScale }] }}>
                                <View style={[styles.iconCircle, { borderColor: catColor, shadowColor: catColor }]}>
                                    <CatIcon color={catColor} size={32} />
                                </View>
                            </Animated.View>

                            <Text style={styles.statusLabel}>
                                {allVoted
                                    ? (isTie ? t('result.tie_detected') : t('result.congratulations'))
                                    : t('result.voting_in_progress')}
                            </Text>

                            <View style={styles.winnerNameBox}>
                                <NeonText
                                    style={{
                                        fontSize: winner.length > 40 ? 16 : winner.length > 25 ? 20 : winner.length > 15 ? 28 : 36,
                                        textAlign: 'center',
                                        lineHeight: winner.length > 40 ? 22 : winner.length > 25 ? 26 : winner.length > 15 ? 34 : 42,
                                        color: Colors.primary,
                                        ...(Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'break-word' } : {}),
                                    }}
                                    numberOfLines={3}
                                    adjustsFontSizeToFit={true}
                                    minimumFontScale={0.4}
                                >
                                    {winner}
                                </NeonText>
                            </View>
                        </View>

                        {/* Vote Statistics */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeader}>
                                <NeonText style={styles.sectionTitle}>{t('result.vote_result')}</NeonText>
                            </View>
                            {tallyEntries.map(([name, count]) => {
                                const menuCount = route.params?.menuItems?.length || originalItems?.length || 0;
                                const cellCount = Math.max(menuCount, 1);
                                return (
                                    <View key={name} style={styles.tallyItem}>
                                        <View style={styles.tallyNameRow}>
                                            <Text style={styles.tallyName} numberOfLines={1}>{name}</Text>
                                        </View>
                                        <View style={styles.tallyBarContainer}>
                                            {[...Array(cellCount)].map((_, i) => (
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
                                );
                            })}
                        </View>

                        {/* Participant Choices */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeader}>
                                <NeonText style={styles.sectionTitle}>{t('result.participant_detail')}</NeonText>
                            </View>
                            {sortedParticipants.map((p, idx) => {
                                const isNoVote = p.votedFor === t('common.no_vote') || p.votedFor === t('common.no_vote').toUpperCase();
                                const isNotConnected = p.isNotConnected || p.votedFor === t('common.not_connected') || p.votedFor === t('common.not_connected').toUpperCase();
                                const isInactive = isNotConnected || isNoVote;
                                const hasRealVote = p.votedFor && !isInactive;

                                return (
                                    <View key={p.id ?? `p-${idx}`} style={styles.participantRow}>
                                        <View style={styles.participantLeft}>
                                            <View style={[styles.statusDot, { backgroundColor: isInactive ? 'rgba(255,255,255,0.35)' : (hasRealVote ? Colors.success : Colors.primary) }]} />
                                            <Text style={styles.participantName} numberOfLines={1}>
                                                {p.name}
                                            </Text>
                                            {p.isMe && (
                                                <Text style={styles.meBadge}>{t('common.me')}</Text>
                                            )}
                                            {p.isOwner && (
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
                                                    <Crown color={Colors.accent} size={10} fill={`${Colors.accent}33`} style={{ marginRight: 2 }} />
                                                    <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>{t('common.host').toUpperCase()}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={[styles.voteBadge, {
                                            backgroundColor: isInactive ? 'rgba(255, 255, 255, 0.03)' : (hasRealVote ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 255, 255, 0.05)'),
                                            borderColor: isInactive ? 'rgba(255, 255, 255, 0.08)' : (hasRealVote ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 255, 255, 0.1)'),
                                        }]}>
                                            {hasRealVote && <CheckCircle2 size={11} color={Colors.success} style={{ marginRight: 4 }} />}
                                            {isInactive && <CircleOff size={11} color="rgba(255,255,255,0.35)" style={{ marginRight: 4 }} />}
                                            <Text style={[styles.voteBadgeText, { color: isInactive ? 'rgba(255,255,255,0.35)' : (hasRealVote ? Colors.success : 'rgba(255,255,255,0.3)') }]}>
                                                {p.votedFor ? p.votedFor.toUpperCase() : t('result.voting_in_progress').toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                )
                            })}
                            {sortedParticipants.length === 0 && (
                                <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: 16, fontSize: 12 }}>
                                    {t('result.waiting_for_others')}
                                </Text>
                            )}
                        </View>
                    </View>
                </ScrollView>

                {/* Footer - Retry */}
                {role === 'owner' ? (
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleReset} activeOpacity={0.7} style={styles.retryButton}>
                            <RefreshCw color={Colors.primary} size={24} style={{ marginRight: 10 }} />
                            <Text style={styles.retryText}>{t('result.retry').toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                <CyberAlert
                    visible={showExitConfirm}
                    title={t('common.alert')}
                    message={role === 'owner' ? t('common.host_exit_confirm') : t('common.exit_confirm')}
                    onConfirm={async () => {
                        setShowExitConfirm(false);
                        if (role === 'owner') {
                            await syncService.removeRoom(roomId);
                        }
                        await syncService.clearPresence();
                        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                    }}
                    onCancel={() => setShowExitConfirm(false)}
                    confirmText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    type="info"
                />

                <CyberAlert
                    visible={showHostRestartedAlert}
                    title={t('common.info')}
                    message={t('result.host_restarted')}
                    onConfirm={() => {
                        setShowHostRestartedAlert(false);
                        navigation.navigate('NameInput', { roomId, role, category, initialTab: type });
                    }}
                    confirmText={t('common.confirm')}
                    type="info"
                />

                <CyberAlert
                    visible={showHostEndedAlert}
                    title={t('common.info')}
                    message={t('result.host_ended_room')}
                    onConfirm={() => {
                        setShowHostEndedAlert(false);
                        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                    }}
                    confirmText={t('common.confirm')}
                    type="info"
                />

                <Confetti active={allVoted} />
            </SafeAreaView>
        </CyberBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 20,
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15,
        marginBottom: 8,
    },
    roomBadge: {
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 5,
        shadowOpacity: 0.3,
    },
    roomBadgeText: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 1,
    },

    // Winner card
    winnerCard: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 12,
        shadowOpacity: 0.4,
    },
    statusLabel: {
        color: Colors.primary,
        fontSize: 12,
        letterSpacing: 3,
        fontWeight: 'bold',
        marginBottom: 8,
        opacity: 0.8,
    },
    winnerNameBox: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
    },
    // Section card
    sectionCard: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 12,
    },
    sectionHeader: {
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    sectionTitle: {
        fontSize: 18,
        color: Colors.primary,
    },

    // Tally (cell-based bar from ResultScreen)
    tallyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    tallyNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 120,
        flexShrink: 0,
    },
    tallyName: {
        color: 'white',
        fontSize: 12,
        flexShrink: 1,
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

    // Participants
    participantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    },
    participantLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 10,
        shadowRadius: 4,
        shadowOpacity: 0.5,
    },
    participantName: {
        color: 'white',
        fontSize: 15,
        fontWeight: '500',
        flexShrink: 1,
    },
    meBadge: {
        fontSize: 10,
        color: Colors.primary,
        marginLeft: 4,
        fontWeight: 'bold',
    },
    voteBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        maxWidth: '45%',
    },
    voteBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        flexShrink: 1,
    },

    // Footer
    footer: {
        width: '100%',
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 10,
        backgroundColor: 'transparent',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: 'transparent',
    },
    retryText: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
});
