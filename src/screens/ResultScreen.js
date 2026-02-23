import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, ScrollView, Share, Alert, Image, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { CyberAlert } from '../components/CyberAlert';
import { feedbackService } from '../services/FeedbackService';
import { historyService } from '../services/HistoryService';
import { syncService } from '../services/SyncService';
import { useTranslation } from 'react-i18next';
import { Share2, ListChecks, History, LogOut, Trophy, Loader, RefreshCw, X, Home, Zap, Cpu, Radio, Activity, Drum, Sparkle, HandMetal, Gavel, User, CheckCircle2, Crown } from 'lucide-react-native';
import { Confetti } from '../components/Confetti';

export default function ResultScreen({ route, navigation }) {
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
        finalVotes = [],
        type = 'people',
        category = 'coffee',
        originalItems = []
    } = route.params || {};

    const MovingConfetti = ({ color, size, top, left, right, bottom, rangeX = 15, rangeY = -25, delay = 0 }) => {
        const rotateAnim = useRef(new Animated.Value(0)).current;
        const floatAnim = useRef(new Animated.Value(0)).current;
        const driftAnim = useRef(new Animated.Value(0)).current;

        useEffect(() => {
            Animated.loop(
                Animated.parallel([
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 1500 + Math.random() * 1500,
                        easing: Easing.linear,
                        useNativeDriver: true,
                        delay: delay
                    }),
                    Animated.sequence([
                        Animated.timing(floatAnim, {
                            toValue: 1,
                            duration: 1200 + Math.random() * 800,
                            easing: Easing.out(Easing.sin),
                            useNativeDriver: true
                        }),
                        Animated.timing(floatAnim, {
                            toValue: 0,
                            duration: 1200 + Math.random() * 800,
                            easing: Easing.in(Easing.sin),
                            useNativeDriver: true
                        })
                    ]),
                    Animated.sequence([
                        Animated.timing(driftAnim, {
                            toValue: 1,
                            duration: 1500 + Math.random() * 1000,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true
                        }),
                        Animated.timing(driftAnim, {
                            toValue: 0,
                            duration: 1500 + Math.random() * 1000,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true
                        })
                    ])
                ])
            ).start();
        }, []);

        const rotation = rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg']
        });

        const translateY = floatAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, rangeY]
        });

        const translateX = driftAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-rangeX, rangeX]
        });

        return (
            <Animated.View
                style={{
                    position: 'absolute',
                    top, left, right, bottom,
                    width: size,
                    height: size,
                    backgroundColor: color,
                    borderRadius: size / 2,
                    transform: [{ rotate: rotation }, { translateY }, { translateX }]
                }}
            />
        );
    };

    const ConfettiExplosion = () => {
        const particles = [...Array(40)].map((_, i) => ({
            id: i,
            color: [Colors.primary, Colors.accent, Colors.success, '#FF00FF', '#FFA500', '#00FF00', '#FFFF00'][i % 7],
            size: Math.random() * 8 + 4,
            delay: Math.random() * 2000,
            rangeX: Math.random() * 150 + 50, // wider spread
            rangeY: -(Math.random() * 150 + 100)  // higher burst
        }));

        return (
            <View style={{ position: 'absolute', width: '100%', alignItems: 'center', top: 20, overflow: 'hidden' }}>
                {particles.map(p => (
                    <MovingConfetti
                        key={p.id}
                        color={p.color}
                        size={p.size}
                        rangeX={p.rangeX * (Math.random() > 0.5 ? 1 : -1)}
                        rangeY={p.rangeY}
                        delay={p.delay}
                    />
                ))}
            </View>
        );
    };

    const [allVoted, setAllVoted] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const hasSavedRef = useRef(false);
    // Animations for Results
    const drumBeatAnim = useRef(new Animated.Value(0)).current;
    const trumpetBeatAnim = useRef(new Animated.Value(0)).current;
    const drumPulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!allVoted) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(drumPulseAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
                    Animated.timing(drumPulseAnim, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.delay(100)
                ])
            );
            animation.start();
            return () => animation.stop();
        }
    }, [allVoted]);

    useEffect(() => {
        if (allVoted) {
            const drumAnim = Animated.loop(
                Animated.sequence([
                    Animated.timing(drumBeatAnim, { toValue: 1, duration: 150, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
                    Animated.timing(drumBeatAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.delay(300)
                ])
            );
            const trumpetAnim = Animated.loop(
                Animated.sequence([
                    Animated.timing(trumpetBeatAnim, { toValue: 1, duration: 150, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
                    Animated.timing(trumpetBeatAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.delay(300)
                ])
            );

            if (mode === 'online') drumAnim.start();
            else trumpetAnim.start();

            return () => {
                drumAnim.stop();
                trumpetAnim.stop();
            };
        }
    }, [allVoted, mode]);

    const drumScale = drumBeatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
    const drumOpacity = drumBeatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
    const trumpetScale = trumpetBeatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
    const trumpetOpacity = trumpetBeatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

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
                    }

                    console.log('🎺 playFanfareWithLoading: About to call playFanfare...');
                    await feedbackService.playFanfare();
                    console.log('🎺 playFanfareWithLoading: playFanfare completed');
                };

                playFanfareWithLoading()
                    .then(() => {
                        console.log('🎺 ResultScreen: Fanfare played successfully!');
                        // Small extra delay for visual impact if needed
                        setTimeout(() => setAllVoted(true), 100);
                    })
                    .catch(err => console.error('🎺 ResultScreen: Fanfare failed:', err));

                // Construct details: prefer onlineUsers for complete list, fallback to finalVotes
                let details = [];
                const hostNameFromParams = route.params?.hostName;

                if (onlineUsers && onlineUsers.length > 0) {
                    details = onlineUsers.map(user => {
                        const vote = finalVotes.find(v => v.userId === user.id);
                        // Case 1: Use hostName passed from previous screen (most reliable)
                        let isUserOwner = hostNameFromParams ? (user.name === hostNameFromParams) : false;

                        // Case 2: Use explicit role from Firebase presence
                        if (!isUserOwner) isUserOwner = user.role === 'owner';

                        // Case 3: If presence doesn't have role yet, check if it's "Me" and I am the owner
                        if (!isUserOwner && user.id === syncService.myId && role === 'owner') {
                            isUserOwner = true;
                        }

                        // Case 4: Fallback check by name (Host name matches Room ID in this app's logic)
                        if (!isUserOwner && user.name === roomId) {
                            isUserOwner = true;
                        }

                        return {
                            name: user.name,
                            votedFor: vote ? vote.votedFor : t('common.no_vote').toUpperCase(),
                            isMe: user.id === syncService.myId,
                            isOwner: isUserOwner
                        };
                    });
                } else {
                    // Fallback to purely finalVotes if onlineUsers hasn't synced yet
                    details = finalVotes.map(v => ({
                        name: v.userName || 'Unknown',
                        votedFor: v.votedFor,
                        isMe: v.userId === syncService.myId,
                        isOwner: (hostNameFromParams && v.userName === hostNameFromParams) || (v.userName === roomId) || (v.userId === syncService.myId && role === 'owner')
                    }));
                }

                console.log(`ResultScreen: Saving history with ${details.length} details`);
                let originalList = type === 'people' ? route.params.participants : route.params.menuItems;
                if (mode === 'offline' && route.params?.originalItems) {
                    originalList = route.params.originalItems;
                }
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
        if (mode === 'offline') return;
        const unsubUsers = syncService.subscribeToOnlineUsers(users => {
            setOnlineUsers(users);
        });
        return () => unsubUsers();
    }, [mode]);

    const handleReset = async () => {
        if (mode === 'offline') {
            console.log('ResultScreen: Retrying in offline mode, preserving items:', originalItems.length);
            navigation.navigate('OfflineInput', {
                mode: 'offline',
                items: originalItems
            });
            return;
        }
        console.log(`ResultScreen: Owner resetting game (preserving type: ${type})...`);
        await syncService.setRoomPhase('waiting');
        await syncService.clearSpinState();
        await syncService.clearFinalResults();

        // Navigation to NameInput with type to restore correct tab
        navigation.navigate('NameInput', { roomId, role, category, initialTab: type });
    };

    const handleReturnToBase = async () => {
        if (mode === 'offline') {
            navigation.navigate('OfflineInput', {
                mode: 'offline',
                items: originalItems
            });
            return;
        }
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

            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({
                        title: shareTitle,
                        text: message,
                    });
                } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(message);
                    Alert.alert(t('common.success'), t('result.copied_to_clipboard'));
                } else {
                    Alert.alert(t('common.info'), message);
                }
            } else {
                await Share.share({
                    title: shareTitle,
                    message: message,
                });
            }
        } catch (error) {
            console.error('ResultScreen: Sharing failed', error);
        }
    };

    const handleExit = () => {
        setShowExitConfirm(true);
    };

    return (
        <CyberBackground>
            <Confetti active={allVoted} />
            <SafeAreaView style={{ flex: 1, overflow: 'hidden' }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal={false}>
                    <View style={styles.container}>
                        <View style={styles.header}>
                            {mode === 'online' ? (
                                <View style={{
                                    backgroundColor: 'rgba(0, 255, 255, 0.1)',
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: Colors.primary,
                                    shadowColor: Colors.primary,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowRadius: 5,
                                    shadowOpacity: 0.3
                                }}>
                                    <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>#{t('common.room_id')}: {(roomId || '').toUpperCase()}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Entry' }] })}
                                    style={styles.headerHomeButton}
                                >
                                    <Home color={Colors.primary} size={22} />
                                </TouchableOpacity>
                            )}

                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                <TouchableOpacity onPress={handleShare} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Share2 color={Colors.accent} size={24} />
                                </TouchableOpacity>
                                {mode !== 'offline' && (
                                    <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 4 }}>
                                        <ListChecks color={Colors.success} size={24} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => navigation.navigate('History', { role, roomId, mode, category })} style={{ padding: 4 }}>
                                    <History color={Colors.primary} size={24} />
                                </TouchableOpacity>
                                {mode !== 'offline' && (
                                    <TouchableOpacity
                                        onPress={handleExit}
                                        style={{ padding: 4 }}
                                    >
                                        <LogOut color={Colors.error} size={24} />
                                    </TouchableOpacity>
                                )}
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
                                <Animated.View style={{ transform: [{ scale: drumPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }}>
                                    <Image
                                        source={{ uri: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f941.png' }}
                                        style={{ width: 80, height: 80 }}
                                        resizeMode="contain"
                                    />
                                    <View style={styles.loaderGlow} />
                                </Animated.View>
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
                                {winner === route.params?.hostName && (
                                    <View style={{
                                        backgroundColor: `${Colors.accent}25`,
                                        borderColor: Colors.accent,
                                        borderWidth: 1.5,
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        marginLeft: 10,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                    }}>
                                        <Crown color={Colors.accent} size={12} fill={`${Colors.accent}33`} style={{ marginRight: 3 }} />
                                        <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: 'bold' }}>{t('common.host').toUpperCase()}</Text>
                                    </View>
                                )}
                            </View>
                            {allVoted && isTie && <Text style={styles.tieSubText}>{t('result.tie_subtext')}</Text>}

                            {/* Celebration Element for All Modes */}
                            {allVoted && (
                                <View style={styles.offlineCelebration}>
                                    <View style={styles.badgeLine} />
                                    <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                                        <ConfettiExplosion />
                                        <Animated.Image
                                            source={{
                                                uri: mode === 'online'
                                                    ? 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f941.png' // Drum for online
                                                    : 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f3ba.png' // Trumpet for offline
                                            }}
                                            style={[
                                                styles.celebrationImage,
                                                {
                                                    width: 60,
                                                    height: 60,
                                                    transform: [{ scale: mode === 'online' ? drumScale : trumpetScale }],
                                                    opacity: mode === 'online' ? drumOpacity : trumpetOpacity
                                                }
                                            ]}
                                            resizeMode="contain"
                                        />
                                    </View>

                                    <View style={styles.badgeLine} />
                                </View>
                            )}

                            {/* Tally Chart - Hide in offline mode */}
                            {mode !== 'offline' && (
                                <View style={styles.tallyContainer}>
                                    {Object.entries(tally).map(([name, count]) => {
                                        const isHost = name === (route.params?.hostName);
                                        const menuCount = route.params?.menuItems?.length || originalItems?.length || 0;
                                        const cellCount = Math.max(type === 'menu' ? menuCount : totalParticipants, 1);
                                        return (
                                        <View key={name} style={styles.tallyItem}>
                                            <View style={styles.tallyNameRow}>
                                                <Text style={styles.tallyName} numberOfLines={1}>{name}</Text>
                                                {isHost && (
                                                    <View style={styles.tallyHostBadge}>
                                                        <Crown color={Colors.accent} size={8} fill={`${Colors.accent}33`} style={{ marginRight: 2 }} />
                                                        <Text style={styles.tallyHostBadgeText}>{t('common.host').toUpperCase()}</Text>
                                                    </View>
                                                )}
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
                            )}

                            <Text style={styles.subText}>
                                {!allVoted && t('result.waiting_for_others')}
                            </Text>
                        </View>




                    </View>
                </ScrollView>

                {role === 'owner' || mode === 'offline' ? (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            onPress={handleReset}
                            activeOpacity={0.7}
                            style={styles.retryButton}
                        >
                            <RefreshCw color={Colors.primary} size={24} style={{ marginRight: 10 }} />
                            <Text style={styles.retryText}>{t('result.retry').toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* Online Users Modal */}
                <Modal
                    visible={showUsersModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowUsersModal(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{
                            width: '100%',
                            maxWidth: 400,
                            backgroundColor: '#111',
                            borderRadius: 20,
                            padding: 24,
                            borderWidth: 2,
                            borderColor: Colors.primary,
                            shadowColor: Colors.primary,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.5,
                            shadowRadius: 15,
                            elevation: 8
                        }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <NeonText style={{ fontSize: 20 }}>{t('name_input.participant_status')}</NeonText>
                                <TouchableOpacity onPress={() => setShowUsersModal(false)}>
                                    <X color={Colors.text} size={24} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
                                {onlineUsers.map((user) => {
                                    const userVote = finalVotes.find(v => v.userId === user.id);
                                    const isMe = user.id === syncService.myId;

                                    return (
                                        <View key={user.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                <View style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: userVote ? Colors.success : Colors.primary,
                                                    marginRight: 10,
                                                    shadowColor: userVote ? Colors.success : Colors.primary,
                                                    shadowRadius: 4,
                                                    shadowOpacity: 0.5
                                                }} />
                                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                                                    {user.name} {isMe ? <Text style={{ fontSize: 11, color: Colors.primary }}> {t('common.me')}</Text> : ''}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <View style={{
                                                    backgroundColor: userVote ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 4,
                                                    borderRadius: 4,
                                                    borderWidth: 1,
                                                    borderColor: userVote ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                    flexDirection: 'row',
                                                    alignItems: 'center'
                                                }}>
                                                    {userVote && <CheckCircle2 size={12} color={Colors.success} style={{ marginRight: 4 }} />}
                                                    <Text style={{ color: userVote ? Colors.success : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 'bold' }}>
                                                        {userVote ? userVote.votedFor.toUpperCase() : t('roulette.spinning').toUpperCase()}
                                                    </Text>
                                                </View>
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
                    onConfirm={async () => {
                        setShowExitConfirm(false);
                        if (mode === 'offline') {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'OfflineInput', params: { items: originalItems } }]
                            });
                        } else {
                            await syncService.clearPresence();
                            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                        }
                    }}
                    onCancel={() => setShowExitConfirm(false)}
                    confirmText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    type="info"
                />

                {/* Festive Confetti Overlay */}
                <Confetti active={allVoted} />
            </SafeAreaView>
        </CyberBackground >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
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
        paddingHorizontal: 0,
        paddingTop: 15,
        paddingBottom: 15,
        marginBottom: 15,
    },
    headerHomeButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 255, 0.2)',
    },
    trophyContainer: {
        marginTop: 70,
        marginBottom: 40,
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
        padding: 25, // Compact padding
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
        marginBottom: 10,
        opacity: 0.8,
    },
    winnerNameContainer: {
        marginVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
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
    tallyHostBadge: {
        backgroundColor: `${Colors.accent}25`,
        borderColor: Colors.accent,
        borderWidth: 1.5,
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 1,
        marginLeft: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tallyHostBadgeText: {
        color: Colors.accent,
        fontSize: 8,
        fontWeight: 'bold',
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
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 10,
        backgroundColor: 'transparent',
    },
    retryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: 'transparent',
    },
    retryText: {
        color: Colors.primary,
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 2,
    },
    forceResultButton: {
        backgroundColor: '#8B1A1A',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    forceResultText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
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
        borderWidth: 2,
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
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
    offlineCelebration: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        marginVertical: 5,
    },
    celebrationImage: {
        width: 130, // Balanced size
        height: 130,
        marginBottom: 10,
    },
    badgeLine: {
        width: '60%',
        height: 2,
        backgroundColor: Colors.secondary,
        marginVertical: 12,
        shadowColor: Colors.secondary,
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 10,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 3,
        textShadowColor: Colors.secondary,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
    },
});
