import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Dimensions, StyleSheet, Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { feedbackService } from '../services/FeedbackService';
import Svg, { Path, G, Text as SvgText, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { RotateCw, Users, X, Power, History, LogOut, UserPlus, ListChecks } from 'lucide-react-native';
import { Modal, ScrollView } from 'react-native';
import { syncService } from '../services/SyncService';

const { width } = Dimensions.get('window');
const ROULETTE_SIZE = Math.min(width * 0.85, 420);

export default function RouletteScreen({ route, navigation }) {
    const { participants = [], menuItems = [], mySelectedName, roomId = 'default', role = 'participant', category = 'coffee', votedItem = null } = route.params || {};
    const [participantsState, setParticipantsState] = useState(participants);
    const [menuItemsState, setMenuItemsState] = useState(menuItems);
    const [spinTarget, setSpinTarget] = useState(route.params?.spinTarget || 'people'); // Initialize from params
    const currentList = spinTarget === 'people' ? participantsState : menuItemsState;

    const rotation = useSharedValue(0);
    const [spinning, setSpinning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [remoteSpinState, setRemoteSpinState] = useState(null);
    const [votes, setVotes] = useState([]);
    const isNavigating = useRef(false);
    const isFocused = useIsFocused();
    const lastTickIndex = useSharedValue(-1);

    // Initial Rotation Effect for Voted Item
    useEffect(() => {
        if (votedItem && currentList.length > 0 && !spinning) {
            console.log(`RouletteScreen: Initializing rotation for voted item: ${votedItem}`);
            // Find index of voted item
            const index = currentList.findIndex(item => (typeof item === 'object' ? item.name : item) === votedItem);

            if (index !== -1) {
                // Calculate target angle (Reuse logic from spin)
                let winnerStartAngle = 0;
                for (let i = 0; i < index; i++) {
                    const p = currentList[i];
                    const weight = typeof p === 'object' ? p.weight : (100 / currentList.length);
                    winnerStartAngle += (weight / 100) * 360;
                }

                const winnerItem = currentList[index];
                const winnerWeight = typeof winnerItem === 'object' ? winnerItem.weight : (100 / currentList.length);
                const winnerSegmentAngle = (winnerWeight / 100) * 360;

                // Center of the segment
                const targetAngleOnWheel = winnerStartAngle + (winnerSegmentAngle / 2);

                // Target Rotation (bring to Top/0 deg)
                const targetRotation = (360 - targetAngleOnWheel) % 360;

                // Set rotation immediately
                rotation.value = targetRotation;
            }
        }
    }, [votedItem, currentList, spinning]);

    useEffect(() => {
        let unsubUsers, unsubSpin, unsubVotes, unsubFinal, unsubParticipants, unsubMenuItems;

        const initSync = async () => {
            await syncService.init(mySelectedName, roomId, role);
            feedbackService.loadAssets();
            console.log('RouletteScreen: Session joined in room:', roomId);

            // Subscribe to online users list
            unsubUsers = syncService.subscribeToOnlineUsers(users => {
                setOnlineUsers(users);
            });

            // Subscribe to actual lists to ensure sync
            unsubParticipants = syncService.subscribeToParticipants(list => {
                if (list && list.length > 0) setParticipantsState(list);
            });

            unsubMenuItems = syncService.subscribeToMenuItems(list => {
                if (list && list.length > 0) setMenuItemsState(list);
            });

            // Subscribe to spin target (people or menu)
            syncService.subscribeToSpinTarget(target => {
                setSpinTarget(target);
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
                    if (!isNavigating.current && isFocused) {
                        console.log('RouletteScreen: Final results received, navigating...');
                        isNavigating.current = true;
                        navigation.navigate('Result', {
                            ...finalData,
                            roomId,
                            role,
                            category
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
            if (unsubParticipants) unsubParticipants();
            if (unsubMenuItems) unsubMenuItems();
        };
    }, []);

    // Check if everyone has voted
    useEffect(() => {
        if (!isFocused || spinning || isNavigating.current || votes.length === 0) return;

        // AUTO-FINALIZE: When all registered participants have voted
        if (votes.length >= participantsState.length && participantsState.length > 0) {
            console.log(`RouletteScreen: All participants voted (${votes.length}/${participantsState.length}). Finalizing...`);
            processFinalResult(false);
        }
    }, [votes, currentList, spinning]);

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
                totalParticipants: participantsState.length,
                isForced: isManualForce || (finalVotes.length < participantsState.length),
                finalVotes: finalVotes,
                type: spinTarget // 'people' or 'menu'
            };

            if (role === 'owner') {
                try {
                    await syncService.finalizeGame(resultData);
                    console.log('RouletteScreen: Owner finalize SUCCESS');

                    // Navigate owner immediately
                    navigation.navigate('Result', {
                        ...resultData,
                        roomId,
                        role,
                        category
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

        for (let i = 0; i < currentList.length; i++) {
            const p = currentList[i];
            const weight = typeof p === 'object' ? p.weight : (100 / currentList.length);
            const sectorAngle = (weight / 100) * 360;

            if (winningAngle >= cumulativeAngle && winningAngle < cumulativeAngle + sectorAngle) {
                winningIndex = i;
                break;
            }
            cumulativeAngle += sectorAngle;
        }

        const winner = typeof currentList[winningIndex] === 'object' ? currentList[winningIndex].name : currentList[winningIndex];

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
            for (let i = 0; i < currentList.length; i++) {
                const p = currentList[i];
                const weight = typeof p === 'object' ? p.weight : (100 / currentList.length);
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

        // 1. Select a winner based on weights
        let random = Math.random() * 100;
        let winnerIndex = -1;
        let accumulatedWeight = 0;

        for (let i = 0; i < currentList.length; i++) {
            const p = currentList[i];
            const weight = typeof p === 'object' ? p.weight : (100 / currentList.length);
            accumulatedWeight += weight;
            if (random <= accumulatedWeight) {
                winnerIndex = i;
                break;
            }
        }

        if (winnerIndex === -1) winnerIndex = currentList.length - 1;

        // 2. Calculate the center angle of the winner's segment
        // Calculate start angle of the winner
        let winnerStartAngle = 0;
        for (let i = 0; i < winnerIndex; i++) {
            const p = currentList[i];
            const weight = typeof p === 'object' ? p.weight : (100 / currentList.length);
            winnerStartAngle += (weight / 100) * 360;
        }

        const winnerItem = currentList[winnerIndex];
        const winnerWeight = typeof winnerItem === 'object' ? winnerItem.weight : (100 / currentList.length);
        const winnerSegmentAngle = (winnerWeight / 100) * 360;

        // Target angle is the center of the segment
        // We want the pointer (at 0 deg / top) to point to this angle on the wheel
        // The wheel rotates clockwise. At 0 rotation, 0 deg is at top.
        // To bring angle X to top, we need to rotate by -X (or 360-X).
        const targetAngleOnWheel = winnerStartAngle + (winnerSegmentAngle / 2);

        // Calculate required rotation value
        // We want (rotation % 360) to be equivalent to (360 - targetAngleOnWheel) % 360
        const currentRotation = rotation.value;
        const currentAngle = currentRotation % 360;
        const targetRotation = (360 - targetAngleOnWheel) % 360;

        // Calculate difference to get to target
        let diff = targetRotation - currentAngle;
        if (diff < 0) diff += 360;

        // Add minimum spins (5) + diff
        const extraSpins = 5;
        // Add a small random jitter (+/- 10% of segment width) to avoid looking too mechanical, but keep near center
        const jitter = (Math.random() - 0.5) * (winnerSegmentAngle * 0.2);

        const finalRotation = currentRotation + (extraSpins * 360) + diff + jitter;

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
        if (currentList.length === 0) return null;

        let cumulativeAngle = 0;
        return currentList.map((p, i) => {
            const name = typeof p === 'object' ? p.name : p;
            const weight = typeof p === 'object' ? p.weight : (100 / currentList.length);
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

            const color = i % 2 === 0 ? (spinTarget === 'people' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255, 0, 255, 0.1)') : (spinTarget === 'people' ? 'rgba(255, 0, 255, 0.1)' : 'rgba(0, 255, 255, 0.1)');
            const strokeColor = i % 2 === 0 ? (spinTarget === 'people' ? Colors.primary : Colors.secondary) : (spinTarget === 'people' ? Colors.secondary : Colors.primary);

            return (
                <G key={i}>
                    <Path d={d} fill={color} stroke={strokeColor} strokeWidth="1.5" />
                    <SvgText
                        x={ROULETTE_SIZE / 2 + (ROULETTE_SIZE * 0.35) * Math.cos((startAngle + angle / 2 - 90) * (Math.PI / 180))}
                        y={ROULETTE_SIZE / 2 + (ROULETTE_SIZE * 0.35) * Math.sin((startAngle + angle / 2 - 90) * (Math.PI / 180))}
                        fill="white"
                        fontSize={currentList.length > 8 ? "10" : "14"}
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

        if (hasVoted || votedItem) return 'VOTED! WAITING...';
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
                            <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>#ROOM: {(roomId || '').toUpperCase()}</Text>
                            <Text style={{ color: Colors.secondary, fontSize: 11, fontWeight: 'bold', marginTop: 2, letterSpacing: 0.5 }}>IDENT: {(mySelectedName || role || 'UNKNOWN').toUpperCase()}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 6 }}>
                                <ListChecks color={Colors.success} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('History')} style={{ padding: 6 }}>
                                <History color={Colors.primary} size={24} />
                            </TouchableOpacity>
                            {['meal', 'coffee', 'snack'].includes(category) && (
                                <TouchableOpacity
                                    onPress={async () => {
                                        await syncService.removeMyVote();
                                        navigation.navigate('NameInput', {
                                            roomId,
                                            role,
                                            category,
                                            resetSelection: true
                                        });
                                    }}
                                    style={{ padding: 6 }}
                                >
                                    <UserPlus color={Colors.accent} size={24} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Welcome')}
                                disabled={spinning}
                                style={{ padding: 6, opacity: spinning ? 0.3 : 1 }}
                            >
                                <LogOut color={Colors.error} size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.header}>
                        <NeonText className="text-3xl tracking-widest">{spinTarget === 'people' ? 'SPINNING ROULETTE' : 'GOURMET SELECTION'}</NeonText>
                        <View style={[styles.headerLine, { backgroundColor: spinTarget === 'people' ? Colors.primary : Colors.secondary, shadowColor: spinTarget === 'people' ? Colors.primary : Colors.secondary }]} />
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
                            disabled={!!(spinning || (remoteSpinState?.isSpinning && remoteSpinState.starter !== mySelectedName && onlineUsers.some(u => u.name === remoteSpinState.starter)) || votes.some(v => v.userId === syncService.myId) || votedItem)}
                            activeOpacity={0.8}
                            style={[
                                styles.spinButton,
                                (spinning || (remoteSpinState?.isSpinning && remoteSpinState.starter !== mySelectedName && onlineUsers.some(u => u.name === remoteSpinState.starter)) || votes.some(v => v.userId === syncService.myId) || votedItem) && styles.disabledButton
                            ]}
                        >
                            <RotateCw color={spinning || votes.some(v => v.userId === syncService.myId) ? Colors.textSecondary : Colors.primary} size={24} style={{ marginRight: 12 }} />
                            <NeonText className="text-xl">
                                {getButtonText()}
                            </NeonText>
                        </TouchableOpacity>

                        {/* Force Result Button for Owner if some but not all have voted */}
                        {role === 'owner' && votes.length > 0 && votes.length < currentList.length && (
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
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
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
