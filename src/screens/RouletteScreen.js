import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Dimensions, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { feedbackService } from '../services/FeedbackService';
import Svg, { Path, G, Text as SvgText, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { RotateCw, Users, X, Power, History, LogOut } from 'lucide-react-native';
import { Modal, ScrollView } from 'react-native';
import { syncService } from '../services/SyncService';

const { width } = Dimensions.get('window');
const ROULETTE_SIZE = width * 0.85;

export default function RouletteScreen({ route, navigation }) {
    const { participants = [], mySelectedName, roomId = 'default', role = 'participant' } = route.params || {};
    const rotation = useSharedValue(0);
    const [spinning, setSpinning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [remoteSpinState, setRemoteSpinState] = useState(null);
    const [votes, setVotes] = useState([]);
    const isNavigating = useRef(false);
    const lastTickIndex = useSharedValue(-1);

    useEffect(() => {
        let unsubUsers, unsubSpin, unsubVotes, unsubFinal;

        const initSync = async () => {
            await syncService.init(mySelectedName, roomId);
            feedbackService.loadAssets();
            console.log('RouletteScreen: Session joined in room:', roomId);

            // Subscribe to online users list
            unsubUsers = syncService.subscribeToOnlineUsers(users => {
                setOnlineUsers(users);
            });

            // Subscribe to spin state from others
            unsubSpin = syncService.subscribeToSpinState(state => {
                setRemoteSpinState(state);
                if (state?.isSpinning && state.starter !== mySelectedName && !spinning) {
                    console.log('RouletteScreen: Remote spin detected');
                } else if (state && !state.isSpinning) {
                    setSpinning(false);
                }
            });

            // Subscribe to votes
            unsubVotes = syncService.subscribeToVotes(vts => {
                setVotes(vts);
            });

            // Subscribe to final results to handle owner's force or collective completion
            unsubFinal = syncService.subscribeToFinalResults(finalData => {
                if (finalData) {
                    if (!isNavigating.current) {
                        console.log('RouletteScreen: Final results received, navigating...');
                        isNavigating.current = true;
                        navigation.navigate('Result', {
                            ...finalData,
                            roomId,
                            role
                        });
                    }
                } else {
                    // CRITICAL: If results were cleared (Retry), reset the navigation flag
                    console.log('RouletteScreen: Final results cleared, resetting flag');
                    isNavigating.current = false;
                }
            });
        };

        initSync();

        return () => {
            console.log('RouletteScreen: Cleaning up subscriptions');
            if (unsubUsers) unsubUsers();
            if (unsubSpin) unsubSpin();
            if (unsubVotes) unsubVotes();
            if (unsubFinal) unsubFinal();
        };
    }, []);

    // Check if everyone has voted
    useEffect(() => {
        if (spinning || isNavigating.current || votes.length === 0) return;

        const activeOnlineUsers = onlineUsers.filter(u => participants.includes(u.name));
        const activeCount = Math.max(activeOnlineUsers.length, 1);

        if (votes.length >= activeCount) {
            console.log(`RouletteScreen: Threshold met (${votes.length}/${activeCount}). Finalizing...`);
            processFinalResult(false);
        }
    }, [votes, onlineUsers, participants, spinning]);

    const processFinalResult = async (isManualForce = false) => {
        if (isNavigating.current) return;
        if (role !== 'owner' && !isManualForce) return;

        // CRITICAL: Ensure MY vote is in the list before finalizing
        const hasMyVote = votes.some(v => v.userId === syncService.myId);
        if (!hasMyVote && !isManualForce) {
            console.log('RouletteScreen: Owner vote not yet synced, waiting...');
            return;
        }

        isNavigating.current = true;

        try {
            console.log('RouletteScreen: Finalizing results with verified DB read...');
            let finalVotes = await syncService.getVotes();

            // Retry once if DB seems empty despite event trigger
            if (finalVotes.length === 0) {
                await new Promise(r => setTimeout(r, 500));
                finalVotes = await syncService.getVotes();
            }

            if (finalVotes.length === 0) {
                isNavigating.current = false;
                return;
            }

            const tally = {};
            finalVotes.forEach(v => {
                tally[v.votedFor] = (tally[v.votedFor] || 0) + 1;
            });

            const voteValues = Object.values(tally);
            const maxVotes = voteValues.length > 0 ? Math.max(...voteValues) : 0;
            const winners = Object.keys(tally).filter(name => tally[name] === maxVotes);

            const resultData = {
                winner: winners.length === 1 ? winners[0] : (winners.length > 0 ? winners.join(', ') : 'Unknown'),
                isTie: winners.length > 1,
                tally,
                totalParticipants: participants.length,
                isForced: isManualForce || (finalVotes.length < participants.length),
                finalVotes: finalVotes
            };

            if (role === 'owner') {
                try {
                    await syncService.finalizeGame(resultData);
                    console.log('RouletteScreen: Owner finalize SUCCESS');

                    // Navigate owner immediately
                    navigation.navigate('Result', {
                        ...resultData,
                        roomId,
                        role
                    });
                } catch (err) {
                    console.error('RouletteScreen: Owner finalize FAILED:', err);
                    isNavigating.current = false;
                }
            }
        } catch (err) {
            console.error('RouletteScreen: Finalization error:', err);
            isNavigating.current = false;
        }
    };

    const triggerTick = () => {
        feedbackService.playTick();
    };

    const onSpinFinished = async (finalRotation) => {
        const normalizedRotation = (finalRotation % 360 + 360) % 360;
        // The pointer is at the TOP.
        const winningAngle = (360 - normalizedRotation) % 360;

        // Find winner based on weighted sections
        let cumulativeAngle = 0;
        let winningIndex = 0;

        for (let i = 0; i < participants.length; i++) {
            const p = participants[i];
            const weight = typeof p === 'object' ? p.weight : (100 / participants.length);
            const sectorAngle = (weight / 100) * 360;

            if (winningAngle >= cumulativeAngle && winningAngle < cumulativeAngle + sectorAngle) {
                winningIndex = i;
                break;
            }
            cumulativeAngle += sectorAngle;
        }

        const winner = typeof participants[winningIndex] === 'object' ? participants[winningIndex].name : participants[winningIndex];

        console.log(`Spin Finished - Winner: ${winner}`);
        console.log(`My name: ${mySelectedName}, Voting for: ${winner}`);

        // Submit my result as a vote/result
        await syncService.submitVote(winner);
        await syncService.finishSpin(winner);

        // Crucial: Set local spinning to false so processFinalResult can trigger
        setSpinning(false);
    };

    useAnimatedReaction(
        () => rotation.value,
        (currentValue) => {
            const normalizedRotation = (currentValue % 360 + 360) % 360;
            const pointerAngle = (360 - normalizedRotation) % 360;

            let cumulativeAngle = 0;
            let currentIndex = 0;
            for (let i = 0; i < participants.length; i++) {
                const p = participants[i];
                const weight = typeof p === 'object' ? p.weight : (100 / participants.length);
                const sectorAngle = (weight / 100) * 360;
                if (pointerAngle >= cumulativeAngle && pointerAngle < cumulativeAngle + sectorAngle) {
                    currentIndex = i;
                    break;
                }
                cumulativeAngle += sectorAngle;
            }

            if (currentIndex !== lastTickIndex.value) {
                lastTickIndex.value = currentIndex;
                runOnJS(triggerTick)();
            }
        }
    );

    const startSpinAnimation = (shouldSyncStart = true) => {
        if (spinning) return;

        setSpinning(true);
        lastTickIndex.value = -1;

        if (shouldSyncStart) {
            syncService.startSpin(mySelectedName || 'Unknown User');
        }

        feedbackService.playStart();

        const extraSpins = 5 + Math.random() * 5;
        const finalRotation = rotation.value + extraSpins * 360 + Math.random() * 360;
        const animationDuration = 4000;

        rotation.value = withTiming(finalRotation, {
            duration: animationDuration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }, (finished) => {
            if (finished) {
                runOnJS(onSpinFinished)(finalRotation);
            }
        });

        // Fallback for web
        setTimeout(() => {
            onSpinFinished(finalRotation);
        }, animationDuration + 100);
    };

    const spinRoulette = async () => {
        // Check if someone else is spinning
        const isOtherSpinning = remoteSpinState?.isSpinning &&
            remoteSpinState.starter !== mySelectedName &&
            onlineUsers.some(u => u.name === remoteSpinState.starter);

        if (spinning || isOtherSpinning) return;

        startSpinAnimation(true);
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const renderSections = () => {
        if (participants.length === 0) return null;

        let cumulativeAngle = 0;
        return participants.map((p, i) => {
            const name = typeof p === 'object' ? p.name : p;
            const weight = typeof p === 'object' ? p.weight : (100 / participants.length);
            const angle = (weight / 100) * 360;

            const startAngle = cumulativeAngle;
            const endAngle = cumulativeAngle + angle;
            cumulativeAngle += angle;

            const radStart = (startAngle - 90) * (Math.PI / 180);
            const radEnd = (endAngle - 90) * (Math.PI / 180);

            const x1 = ROULETTE_SIZE / 2 + (ROULETTE_SIZE / 2) * Math.cos(radStart);
            const y1 = ROULETTE_SIZE / 2 + (ROULETTE_SIZE / 2) * Math.sin(radStart);
            const x2 = ROULETTE_SIZE / 2 + (ROULETTE_SIZE / 2) * Math.cos(radEnd);
            const y2 = ROULETTE_SIZE / 2 + (ROULETTE_SIZE / 2) * Math.sin(radEnd);

            const largeArcFlag = angle > 180 ? 1 : 0;
            const d = `M ${ROULETTE_SIZE / 2} ${ROULETTE_SIZE / 2} L ${x1} ${y1} A ${ROULETTE_SIZE / 2} ${ROULETTE_SIZE / 2} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

            const color = i % 2 === 0 ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255, 0, 255, 0.1)';
            const strokeColor = i % 2 === 0 ? Colors.primary : Colors.secondary;

            return (
                <G key={i}>
                    <Path d={d} fill={color} stroke={strokeColor} strokeWidth="1.5" />
                    <SvgText
                        x={ROULETTE_SIZE / 2 + (ROULETTE_SIZE * 0.35) * Math.cos((startAngle + angle / 2 - 90) * (Math.PI / 180))}
                        y={ROULETTE_SIZE / 2 + (ROULETTE_SIZE * 0.35) * Math.sin((startAngle + angle / 2 - 90) * (Math.PI / 180))}
                        fill="white"
                        fontSize={participants.length > 8 ? "10" : "14"}
                        fontWeight="bold"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        transform={`rotate(${startAngle + angle / 2}, ${ROULETTE_SIZE / 2 + (ROULETTE_SIZE * 0.35) * Math.cos((startAngle + angle / 2 - 90) * (Math.PI / 180))}, ${ROULETTE_SIZE / 2 + (ROULETTE_SIZE * 0.35) * Math.sin((startAngle + angle / 2 - 90) * (Math.PI / 180))})`}
                    >
                        {name}
                    </SvgText>
                </G>
            );
        });
    };

    const getButtonText = () => {
        const hasVoted = votes.some(v => v.userId === syncService.myId);

        // Only show remote spinner if they are actually online
        const isRemoteSpinning = remoteSpinState?.isSpinning &&
            remoteSpinState.starter !== mySelectedName &&
            onlineUsers.some(u => u.name === remoteSpinState.starter);

        if (isRemoteSpinning) {
            return `${remoteSpinState.starter}님이 돌리는 중...`;
        }

        if (hasVoted) return 'VOTED! WAITING...';
        return spinning ? 'SPINNING...' : 'EXECUTE';
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <View style={{ width: '100%', marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            <Text style={{ color: Colors.secondary, fontSize: 11, fontWeight: 'bold', marginTop: 2, letterSpacing: 0.5 }}>IDENT: {mySelectedName.toUpperCase()}</Text>
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
                                disabled={spinning}
                                style={{ padding: 8, opacity: spinning ? 0.3 : 1 }}
                            >
                                <LogOut color={Colors.error} size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.header}>
                        <NeonText className="text-3xl tracking-widest">DATA EXTRACTION</NeonText>
                        <View style={styles.headerLine} />
                    </View>

                    <View style={styles.wheelContainer}>
                        <View style={styles.wheelGlow} />
                        <Animated.View style={[animatedStyle, { width: ROULETTE_SIZE, height: ROULETTE_SIZE }]}>
                            <Svg width={ROULETTE_SIZE} height={ROULETTE_SIZE}>
                                <Defs>
                                    <RadialGradient id="grad" cx="50%" cy="50%" r="50%">
                                        <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.3" />
                                        <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                                    </RadialGradient>
                                </Defs>
                                <Circle cx={ROULETTE_SIZE / 2} cy={ROULETTE_SIZE / 2} r={ROULETTE_SIZE / 2} fill="rgba(255,255,255,0.02)" />
                                {renderSections()}
                                <Circle cx={ROULETTE_SIZE / 2} cy={ROULETTE_SIZE / 2} r={ROULETTE_SIZE / 2} fill="url(#grad)" pointerEvents="none" />
                                <Circle cx={ROULETTE_SIZE / 2} cy={ROULETTE_SIZE / 2} r={15} fill={Colors.background} stroke={Colors.primary} strokeWidth={2} />
                            </Svg>
                        </Animated.View>
                        <View style={styles.pointerContainer}>
                            <View style={styles.pointer} />
                            <View style={styles.pointerOuterGlow} />
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            onPress={spinRoulette}
                            disabled={!!(spinning || (remoteSpinState?.isSpinning && remoteSpinState.starter !== mySelectedName && onlineUsers.some(u => u.name === remoteSpinState.starter)) || votes.some(v => v.userId === syncService.myId))}
                            activeOpacity={0.8}
                            style={[
                                styles.spinButton,
                                (spinning || (remoteSpinState?.isSpinning && remoteSpinState.starter !== mySelectedName && onlineUsers.some(u => u.name === remoteSpinState.starter)) || votes.some(v => v.userId === syncService.myId)) && styles.disabledButton
                            ]}
                        >
                            <RotateCw color={spinning || votes.some(v => v.userId === syncService.myId) ? Colors.textSecondary : Colors.primary} size={24} style={{ marginRight: 12 }} />
                            <NeonText className="text-xl">
                                {getButtonText()}
                            </NeonText>
                        </TouchableOpacity>

                        {/* Force Result Button for Owner if some but not all have voted */}
                        {role === 'owner' && votes.length > 0 && votes.length < participants.length && (
                            <TouchableOpacity
                                onPress={() => processFinalResult(true)}
                                style={{
                                    marginTop: 15,
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                    borderWidth: 1,
                                    borderColor: Colors.secondary,
                                    borderRadius: 12,
                                    backgroundColor: 'rgba(255, 0, 255, 0.05)',
                                    alignItems: 'center',
                                    width: '100%'
                                }}
                            >
                                <Text style={{ color: Colors.secondary, fontSize: 13, fontWeight: 'bold', letterSpacing: 1 }}>⚡ Force result to date</Text>
                            </TouchableOpacity>
                        )}

                    </View>
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
                            <View style={styles.modalDivider} />

                            {/* Column Headers */}
                            <View style={styles.tableHeader}>
                                <Text style={styles.tableHeaderText}>VOTER</Text>
                                <Text style={styles.tableHeaderText}>WINNER</Text>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
                                {onlineUsers.map((user, idx) => {
                                    const userVote = votes.find(v => v.userId === user.id);
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
        justifyContent: 'space-between',
        paddingVertical: 30,
    },
    header: {
        alignItems: 'center',
    },
    headerLine: {
        height: 2,
        width: 100,
        backgroundColor: Colors.primary,
        marginTop: 10,
        shadowColor: Colors.primary,
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 5,
    },
    wheelContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    wheelGlow: {
        position: 'absolute',
        width: ROULETTE_SIZE + 60,
        height: ROULETTE_SIZE + 60,
        borderRadius: (ROULETTE_SIZE + 60) / 2,
        backgroundColor: Colors.primary,
        opacity: 0.03,
    },
    pointerContainer: {
        position: 'absolute',
        top: -15,
        alignItems: 'center',
        zIndex: 10,
    },
    pointer: {
        width: 0,
        height: 0,
        borderLeftWidth: 15,
        borderRightWidth: 15,
        borderTopWidth: 30,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: Colors.accent,
    },
    pointerOuterGlow: {
        position: 'absolute',
        top: -5,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: Colors.accent,
        opacity: 0.2,
        transform: [{ scale: 1.5 }],
    },
    footer: {
        width: '100%',
    },
    spinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.02)',
        shadowColor: Colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    disabledButton: {
        borderColor: Colors.textSecondary,
        opacity: 0.5,
    },
    backButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    backText: {
        color: Colors.error,
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 2,
        opacity: 0.6,
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
    userStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 15,
        shadowColor: Colors.primary,
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 5,
    },
    userName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 1,
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
    terminateButton: {
        borderWidth: 1,
        borderColor: Colors.error,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(255, 49, 49, 0.05)',
        marginTop: 10,
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
});
