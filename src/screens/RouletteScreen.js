import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Dimensions, StyleSheet, Text, Alert, BackHandler, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeonText } from '../components/NeonText';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { CyberAlert } from '../components/CyberAlert';
import { feedbackService } from '../services/FeedbackService';
import Svg, { Path, G, Text as SvgText, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { RotateCw, Users, X, Power, LogOut, UserPlus, ListChecks, HandMetal, Gavel, Zap, User, CheckCircle2, Crown } from 'lucide-react-native';
import { Modal, ScrollView } from 'react-native';
import { syncService } from '../services/SyncService';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const ROULETTE_SIZE = Math.min(width * 0.85, 420);

// Helper for offline mode colors
const hexToRgba = (hex, opacity) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export default function RouletteScreen({ route, navigation }) {
    const { t } = useTranslation();
    const normalizeData = (data) => {
        if (!data) return [];
        // Use Array.from to guarantee a true Array with all prototype methods (fixes Chrome-specific issues)
        if (Array.isArray(data)) return Array.from(data);
        if (typeof data === 'object') {
            return Object.keys(data)
                .sort((a, b) => {
                    const na = parseInt(a);
                    const nb = parseInt(b);
                    if (isNaN(na) || isNaN(nb)) return a.localeCompare(b);
                    return na - nb;
                })
                .map(key => data[key]);
        }
        return [];
    };

    const { mySelectedName, roomId = 'default', mode = 'online', role = 'participant', category = 'coffee', votedItem = null, originalItems = [] } = route.params || {};
    const participants = normalizeData(route.params?.participants);
    const menuItems = normalizeData(route.params?.menuItems);
    
    const [participantsState, setParticipantsState] = useState(participants);
    const [menuItemsState, setMenuItemsState] = useState(menuItems);
    const [spinTarget, setSpinTarget] = useState(route.params?.spinTarget || 'people'); // Initialize from params
    const rawData = spinTarget === 'people' ? participantsState : menuItemsState;
    const currentList = normalizeData(rawData);

    // Simplified wheel display: 1x repeat for both online and offline
    const REPEAT_COUNT = 1;
    const PATTERN_ANGLE = 360 / REPEAT_COUNT;

    const rotation = useSharedValue(0);
    const [spinning, setSpinning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [remoteSpinState, setRemoteSpinState] = useState(null);
    const [votes, setVotes] = useState([]);
    const isNavigating = useRef(false);
    const prevVotesRef = useRef([]);
    const isInitialVoteLoad = useRef(true);
    const autoCloseTimer = useRef(null);
    const spinningRef = useRef(false);
    const [roomHostName, setRoomHostName] = useState(route.params?.hostName);
    const isFocused = useIsFocused();
    const lastTickIndex = useSharedValue(-1);
    const lastTickAngle = useSharedValue(0);
    const spinStartTime = useSharedValue(0);
    const isInitiator = useRef(false);
    const lastTriggerTime = useRef(0);
    const hasAutoSpun = useRef(false);
    const spinTargetRef = useRef(spinTarget);
    const participantsRef = useRef(participantsState);
    const menuItemsRef = useRef(menuItemsState);
    const onlineUsersRef = useRef([]);
    const isFocusedRef = useRef(isFocused);

    // Keep refs in sync with state (onlineUsersRef = 최신 접속자, finalize 시 stale closure 방지)
    useEffect(() => { spinTargetRef.current = spinTarget; }, [spinTarget]);
    useEffect(() => { participantsRef.current = participantsState; }, [participantsState]);
    useEffect(() => { menuItemsRef.current = menuItemsState; }, [menuItemsState]);
    useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
    useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
                e.preventDefault();
            }
        });
        const handlePopState = (e) => { window.history.pushState(null, '', window.location.href); };
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

    const calculateTotalWeight = (list, target) => {
        if (!Array.isArray(list)) return 0;
        let total = 0;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const weight = target === 'people' ? (typeof item === 'object' ? (item.weight || 0) : 1) : 1;
            total += weight;
        }
        return total;
    };

    // Initial Rotation Effect for Voted Item
    useEffect(() => {
        if (votedItem && currentList.length > 0 && !spinning) {
            console.log(`RouletteScreen: Initializing rotation for voted item: ${votedItem}`);
            // Find index of voted item
            const index = currentList.findIndex(item => (typeof item === 'object' ? item.name : item) === votedItem);

            if (index !== -1) {
                const totalWeight = calculateTotalWeight(currentList, spinTarget);
                if (totalWeight <= 0) return;

                // Calculate target angle using PATTERN_ANGLE
                let winnerStartAngleInPattern = 0;
                for (let i = 0; i < index; i++) {
                    const p = currentList[i];
                    const weight = spinTarget === 'people' ? (typeof p === 'object' ? (p.weight || 0) : 1) : 1;
                    winnerStartAngleInPattern += (weight / totalWeight) * PATTERN_ANGLE;
                }

                const winnerItem = currentList[index];
                const winnerWeight = spinTarget === 'people' ? (winnerItem.weight || 0) : 1;
                const winnerSegmentAngleInPattern = (winnerWeight / totalWeight) * PATTERN_ANGLE;

                // Center of the segment in the pattern
                const targetAngleOnWheel = winnerStartAngleInPattern + (winnerSegmentAngleInPattern / 2);

                // Target Rotation (bring to Top/0 deg) - this works for any repeat
                const targetRotation = (360 - targetAngleOnWheel) % 360;

                // Set rotation immediately
                rotation.value = targetRotation;
            }
        }
    }, [votedItem, currentList, spinning]);

    useEffect(() => {
        let unsubUsers, unsubSpin, unsubVotes, unsubFinal, unsubParticipants, unsubMenuItems, unsubHostName;

        const initSync = async () => {
            if (mode === 'offline') {
                console.log('RouletteScreen: Offline mode detected. Skipping sync.');
                return;
            }

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
            const initialTarget = await syncService.getSpinTarget();
            if (initialTarget) setSpinTarget(initialTarget);

            syncService.subscribeToSpinTarget(target => {
                if (target) setSpinTarget(target);
            });

            // Subscribe to host name
            unsubHostName = syncService.subscribeToHostName(name => {
                if (name) setRoomHostName(name);
            });

            // Subscribe to spin state from others
            unsubSpin = syncService.subscribeToSpinState(state => {
                setRemoteSpinState(state);

                // FIXED: Each person spins their own wheel. No forced global sync.
                if (state && !state.isSpinning) {
                    setSpinning(false);
                }
            });

            // Subscribe to votes
            unsubVotes = syncService.subscribeToVotes(vts => {
                // Skip the very first callback (initial load)
                if (isInitialVoteLoad.current) {
                    isInitialVoteLoad.current = false;
                    prevVotesRef.current = vts;
                    setVotes(vts);
                    return;
                }

                const prevVotes = prevVotesRef.current;
                const newCount = vts.length;
                const prevCount = prevVotes.length;

                // Auto-show participant status modal when vote count increases (중간 과정만, 마지막 투표 시에는 모달 없이 결과화면으로)
                if (newCount > prevCount) {
                    const expectedCount = Math.max(participantsRef.current?.length || 0, onlineUsersRef.current?.length || 0);
                    const isLastVote = expectedCount > 0 && newCount >= expectedCount;

                    if (!isLastVote) {
                        const hadMyVote = prevVotes.some(v => v.userId === syncService.myId);
                        const hasMyVoteNow = vts.some(v => v.userId === syncService.myId);
                        const isMyNewVote = !hadMyVote && hasMyVoteNow;

                        if (!isMyNewVote && !spinningRef.current) {
                            if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
                            setShowUsersModal(true);
                            autoCloseTimer.current = setTimeout(() => {
                                setShowUsersModal(false);
                                autoCloseTimer.current = null;
                            }, 3000);
                        }
                    } else {
                        setShowUsersModal(false);
                        if (autoCloseTimer.current) {
                            clearTimeout(autoCloseTimer.current);
                            autoCloseTimer.current = null;
                        }
                    }
                }

                prevVotesRef.current = vts;
                setVotes(vts);
            });

            // Subscribe to final results to handle owner's force or collective completion
            unsubFinal = syncService.subscribeToFinalResults(finalData => {
                if (finalData) {
                    if (!isNavigating.current && isFocusedRef.current) {
                        console.log('RouletteScreen: Final results received, navigating...');
                        isNavigating.current = true;
                        const latestOnline = onlineUsersRef.current || [];
                        const hostName = roomHostName || latestOnline.find(u => u.role === 'owner')?.name || (role === 'owner' ? mySelectedName : (roomId.length <= 8 ? roomId : null));

                        const screenName = (mode === 'online' && finalData.type === 'menu') ? 'MenuResult' : 'Result';
                        navigation.navigate(screenName, {
                            ...finalData,
                            roomId,
                            role,
                            category,
                            hostName
                        });
                    }
                } else {
                    // CRITICAL: If results were cleared (Retry), reset the navigation flag
                    console.log('RouletteScreen: Final results cleared, resetting flag');
                    isNavigating.current = false;
                }
            });
        };

        if (isFocused) {
            initSync();

            if (mode === 'offline' && route.params?.autoSpin && !hasAutoSpun.current) {
                console.log('RouletteScreen: Auto-spinning for offline mode...');
                hasAutoSpun.current = true;
                const timer = setTimeout(() => {
                    startSpinAnimation(false);
                }, 800);
                return () => clearTimeout(timer);
            }
        }
        return () => {
            console.log('RouletteScreen: Cleaning up subscriptions');
            if (unsubUsers) unsubUsers();
            if (unsubSpin) unsubSpin();
            if (unsubVotes) unsubVotes();
            if (unsubFinal) unsubFinal();
            if (unsubParticipants) unsubParticipants();
            if (unsubHostName) unsubHostName();
            if (unsubMenuItems) unsubMenuItems();
            if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
        };
    }, [isFocused]);

    // Handle auto-spin if requested from NameInputScreen (e.g., "Who to pick" clicked)
    useEffect(() => {
        const shouldAutoSpin = route.params?.autoStartSpin;
        if (isFocused && shouldAutoSpin && !spinning && !hasAutoSpun.current) {
            console.log('RouletteScreen: Auto-executing spin in 200ms...');
            hasAutoSpun.current = true; // Lock execution

            const timer = setTimeout(() => {
                navigation.setParams({ autoStartSpin: undefined });
                spinRoulette();
            }, 200); // Stable delay

            return () => clearTimeout(timer);
        }
    }, [isFocused, route.params?.autoStartSpin, spinning]);

    useEffect(() => {
        if (!isFocused || spinning) return;

        // If I already voted, don't follow remote spin animation (Stay on my result)
        const hasIVoted = votes.some(v => v.userId === syncService.myId);
        if (hasIVoted) return;

        const isRemoteSpinning = remoteSpinState?.isSpinning &&
            remoteSpinState.starter !== mySelectedName &&
            onlineUsers.some(u => u.name === remoteSpinState.starter);

        if (isRemoteSpinning && remoteSpinState?.winnerIndex !== undefined) {
            console.log('RouletteScreen: Remote spin detected, syncing local animation...');
            startSpinAnimation(false, remoteSpinState.winnerIndex);
        }
    }, [remoteSpinState, isFocused, spinning, onlineUsers, votes]);

    // Check if everyone has voted (menu 모드만 - people 모드는 옵션 A로 vote 없음)
    useEffect(() => {
        if (spinTarget !== 'menu') return;
        if (!isFocused || spinning || isNavigating.current || votes.length === 0) return;

        const expectedVoterCount = Math.max(participantsState.length, onlineUsers.length);

        if (votes.length >= expectedVoterCount && expectedVoterCount > 0) {
            console.log(`RouletteScreen: All ${expectedVoterCount} participants voted. Finalizing...`);
            processFinalResult(false);
        }
    }, [votes, participantsState, spinning, isNavigating.current, spinTarget, onlineUsers]);

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
                if (v.votedFor != null && v.votedFor !== '') {
                    tally[v.votedFor] = (tally[v.votedFor] || 0) + 1;
                }
            });

            const voteValues = Object.values(tally);
            const maxVotes = voteValues.length > 0 ? Math.max(...voteValues) : 0;
            const winners = Object.keys(tally).filter(name => tally[name] === maxVotes);

            // Prefer winners that exist in current menu/participants (handles menu change after vote)
            const validNames = spinTarget === 'menu'
                ? menuItemsState.map(m => typeof m === 'object' ? m.name : m)
                : participantsState.map(p => typeof p === 'object' ? p.name : p);
            const validWinners = winners.filter(w => validNames.includes(w));
            const winnerStr = validWinners.length > 0
                ? (validWinners.length === 1 ? validWinners[0] : validWinners.join(', '))
                : (winners.length === 1 ? winners[0] : (winners.length > 0 ? winners.join(', ') : 'Unknown'));

            const latestOnline = onlineUsersRef.current || onlineUsers;
            const hostUser = latestOnline.find(u => u.role === 'owner');
            const finalHostName = hostUser ? hostUser.name : (role === 'owner' ? mySelectedName : (roomId.length <= 8 ? roomId : null));
            const fullParticipants = participants.length > 0 ? participants : participantsState;
            const getName = (p) => typeof p === 'object' ? (p.name || p.text || '') : String(p);
            const norm = (s) => String(s || '').trim().replace(/\s+/g, '');
            const joinedNames = fullParticipants
                .filter(p => latestOnline.some(u => norm(u.name || '') === norm(getName(p))))
                .map(p => getName(p))
                .filter(Boolean);
            const resultData = {
                winner: winnerStr,
                isTie: winners.length > 1,
                tally,
                totalParticipants: fullParticipants.length,
                isForced: isManualForce || (finalVotes.length < fullParticipants.length),
                finalVotes: finalVotes,
                type: spinTarget,
                participants: fullParticipants,
                menuItems: menuItems,
                hostName: finalHostName,
                joinedNames
            };

            if (role === 'owner') {
                try {
                    await syncService.finalizeGame(resultData);
                    console.log('RouletteScreen: Owner finalize SUCCESS');

                    // Navigate owner immediately
                    const ownerScreenName = (mode === 'online' && spinTarget === 'menu') ? 'MenuResult' : 'Result';
                    navigation.navigate(ownerScreenName, {
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
        const winningAngle = (360 - normalizedRotation) % 360;
        const winningAngleInPattern = winningAngle % PATTERN_ANGLE;

        // Use refs for the final calculation to avoid closure staleness
        const currentTarget = spinTargetRef.current;
        const currentDataList = normalizeData(currentTarget === 'people' ? participantsRef.current : menuItemsRef.current);

        const totalWeight = calculateTotalWeight(currentDataList, currentTarget);
        if (totalWeight <= 0) {
            setSpinning(false);
            return;
        }
        let cumulativeAngle = 0;
        let winningIndex = 0;

        for (let i = 0; i < currentDataList.length; i++) {
            const p = currentDataList[i];
            const weight = currentTarget === 'people' ? (typeof p === 'object' ? (p.weight || 0) : 1) : 1;
            const sectorAngle = (weight / totalWeight) * PATTERN_ANGLE;

            if (winningAngleInPattern >= cumulativeAngle && winningAngleInPattern < cumulativeAngle + sectorAngle) {
                winningIndex = i;
                break;
            }
            cumulativeAngle += sectorAngle;
        }

        const winner = typeof currentDataList[winningIndex] === 'object' ? currentDataList[winningIndex].name : currentDataList[winningIndex];

        console.log(`Spin Finished - Winner: ${winner}`);

        if (mode === 'offline') {
            setSpinning(false);
            const getName = (p) => typeof p === 'object' ? (p.name || p.text || '') : String(p);
            const offlineJoined = currentDataList.map(p => getName(p)).filter(Boolean);
            navigation.navigate('Result', {
                winner,
                isTie: false,
                tally: { [winner]: 1 },
                totalParticipants: 1,
                roomId: 'offline',
                mode: 'offline',
                role: 'owner',
                category: category,
                type: currentTarget,
                finalVotes: [{ userId: 'local', userName: t('common.local'), votedFor: winner }],
                participants: currentDataList,
                menuItems: currentDataList,
                originalItems: route.params?.originalItems,
                joinedNames: offlineJoined
            });
            return;
        }

        // 옵션 A: people 모드는 vote 없이 호스트 스핀 결과로 즉시 확정
        if (isInitiator.current) {
            if (currentTarget === 'people') {
                // 호스트 스핀 완료 → 바로 finalize (참여자 vote 불필요)
                const latestOnline = onlineUsersRef.current || onlineUsers;
                const hostUser = latestOnline.find(u => u.role === 'owner');
                const finalHostName = hostUser ? hostUser.name : (role === 'owner' ? mySelectedName : (roomId.length <= 8 ? roomId : null));
                const fullParticipants = participants.length > 0 ? participants : currentDataList;
                const getName = (p) => typeof p === 'object' ? (p.name || p.text || '') : String(p);
                const norm = (s) => String(s || '').trim().replace(/\s+/g, '');
                const joinedNames = fullParticipants
                    .filter(p => latestOnline.some(u => norm(u.name || '') === norm(getName(p))))
                    .map(p => getName(p))
                    .filter(Boolean);
                const resultData = {
                    winner,
                    isTie: false,
                    tally: { [winner]: 1 },
                    totalParticipants: fullParticipants.length,
                    isForced: false,
                    finalVotes: [{ userId: syncService.myId, userName: syncService.myName || 'Host', votedFor: winner }],
                    type: 'people',
                    participants: fullParticipants,
                    menuItems: menuItemsRef.current || [],
                    hostName: finalHostName,
                    joinedNames
                };
                await syncService.finishSpin(winner);
                await syncService.finalizeGame(resultData);
                // 호스트 즉시 Result 화면으로 이동
                isNavigating.current = true;
                navigation.navigate('Result', {
                    ...resultData,
                    roomId,
                    role,
                    category
                });
            } else {
                // menu 모드: 기존 vote 방식 유지
                await syncService.submitVote(winner);
                await syncService.finishSpin(winner);
            }
            isInitiator.current = false;
        }

        setSpinning(false);
    };

    useAnimatedReaction(
        () => rotation.value,
        (currentValue) => {
            const normalizedRotation = (currentValue % 360 + 360) % 360;
            const pointerAngle = (360 - normalizedRotation) % 360;
            const pointerAngleInPattern = pointerAngle % PATTERN_ANGLE;

            let totalWeight = 0;
            if (Array.isArray(currentList)) {
                for (let i = 0; i < currentList.length; i++) {
                    const item = currentList[i];
                    totalWeight += (spinTarget === 'people' ? (typeof item === 'object' ? (item.weight || 0) : 1) : 1);
                }
            }

            // Avoid division by zero
            if (totalWeight <= 0) return;

            let cumulativeAngle = 0;
            let currentIndex = 0;
            for (let i = 0; i < currentList.length; i++) {
                const p = currentList[i];
                const weight = spinTarget === 'people' ? (typeof p === 'object' ? (p.weight || 0) : 1) : 1;
                const sectorAngle = (weight / totalWeight) * PATTERN_ANGLE;
                if (pointerAngleInPattern >= cumulativeAngle && pointerAngleInPattern < cumulativeAngle + sectorAngle) {
                    currentIndex = i;
                    break;
                }
                cumulativeAngle += sectorAngle;
            }

            // Skip sound on initial state (-1 -> current)
            if (lastTickIndex.value === -1) {
                lastTickIndex.value = currentIndex;
                return;
            }

            if (currentIndex !== lastTickIndex.value) {
                lastTickIndex.value = currentIndex;
                // Ignore ticks during the very first phase of spin (150ms silence period)
                // to avoid double/triple sound artifacts at start
                if (Date.now() - spinStartTime.value > 150) {
                    runOnJS(triggerTick)();
                }
            }
        },
        [currentList, spinTarget, PATTERN_ANGLE]
    );

    const startSpinAnimation = (shouldSyncStart = true, fixedWinnerIndex = null) => {
        if (spinning) return;

        const totalWeight = calculateTotalWeight(currentList, spinTarget);
        if (!Array.isArray(currentList) || currentList.length === 0 || totalWeight <= 0) {
            if (mode === 'online') {
                Alert.alert(t('common.alert'), spinTarget === 'menu' ? t('roulette.no_menu_items') : t('roulette.no_participants'));
            }
            return;
        }

        setSpinning(true);
        isInitiator.current = shouldSyncStart;
        spinStartTime.value = Date.now();

        // Calculate the ACTUAL initial index to prevent double tick sound at start
        const normalizedRotation = (rotation.value % 360 + 360) % 360;
        const pointerAngle = (360 - normalizedRotation) % 360;
        const pointerAngleInPattern = pointerAngle % PATTERN_ANGLE;

        let initialIdx = 0;
        if (totalWeight > 0) {
            let cumulativeAngle = 0;
            for (let i = 0; i < currentList.length; i++) {
                const p = currentList[i];
                const weight = spinTarget === 'people' ? (typeof p === 'object' ? (p.weight || 0) : 1) : 1;
                const sectorAngle = (weight / totalWeight) * PATTERN_ANGLE;
                if (pointerAngleInPattern >= cumulativeAngle && pointerAngleInPattern < cumulativeAngle + sectorAngle) {
                    initialIdx = i;
                    break;
                }
                cumulativeAngle += sectorAngle;
            }
        }
        lastTickIndex.value = initialIdx;

        feedbackService.playStart();

        // 1. Select a winner index (either random or fixed from remote)
        let winnerIndex = fixedWinnerIndex;

        if (winnerIndex === null) {
            let random = Math.random() * totalWeight;
            let accumulatedWeight = 0;

            for (let i = 0; i < currentList.length; i++) {
                const p = currentList[i];
                const weight = spinTarget === 'people' ? (typeof p === 'object' ? (p.weight || 0) : 1) : 1;
                accumulatedWeight += weight;
                if (random <= accumulatedWeight) {
                    winnerIndex = i;
                    break;
                }
            }
            if (winnerIndex === -1 || winnerIndex === null) winnerIndex = currentList.length - 1;
        }

        // 2. Sync start if I am the starter (and not offline)
        if (shouldSyncStart && mode !== 'offline') {
            syncService.startSpin(mySelectedName || 'Unknown User', winnerIndex, role);
        }

        // 2. Calculate the center angle of the winner's segment
        // Calculate start angle of the winner within a pattern
        let winnerStartAngleInPattern = 0;
        for (let i = 0; i < winnerIndex; i++) {
            const p = currentList[i];
            const weight = spinTarget === 'people' ? (typeof p === 'object' ? (p.weight || 0) : 1) : 1;
            winnerStartAngleInPattern += (weight / totalWeight) * PATTERN_ANGLE;
        }

        const winnerItem = currentList[winnerIndex];
        const winnerWeight = spinTarget === 'people' ? (typeof winnerItem === 'object' ? (winnerItem.weight || 0) : 1) : 1;
        const winnerSegmentAngleInPattern = (winnerWeight / totalWeight) * PATTERN_ANGLE;

        // Target angle is the center of the segment
        const targetAngleOnWheel = winnerStartAngleInPattern + (winnerSegmentAngleInPattern / 2);

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
        const jitter = (Math.random() - 0.5) * (winnerSegmentAngleInPattern * 0.2);

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

        const totalWeight = calculateTotalWeight(currentList, spinTarget);
        if (!Array.isArray(currentList) || currentList.length === 0 || totalWeight <= 0) {
            Alert.alert(t('common.alert'), spinTarget === 'menu' ? t('roulette.no_menu_items') : t('roulette.no_participants'));
            return;
        }

        startSpinAnimation(true);
    };

    const animatedStyle = useAnimatedStyle(() => {
        const val = Number.isFinite(rotation.value) ? rotation.value : 0;
        return { transform: [{ rotate: `${val}deg` }] };
    });

    const renderSections = () => {
        if (!Array.isArray(currentList) || currentList.length === 0) return null;

        // Repeat the pattern for more dynamic visual
        const sections = [];

        for (let repeat = 0; repeat < REPEAT_COUNT; repeat++) {
            let cumulativeAngle = (360 / REPEAT_COUNT) * repeat; // Start angle for this repetition

            const totalWeight = calculateTotalWeight(currentList, spinTarget);
            if (!Number.isFinite(totalWeight) || totalWeight <= 0) return null; // Prevent division by zero / NaN
            currentList.forEach((p, i) => {
                const name = typeof p === 'object' ? p.name : p;
                const weight = spinTarget === 'people' ? (typeof p === 'object' ? (p.weight || 0) : 1) : 1;
                // Divide angle by REPEAT_COUNT since we're repeating the pattern
                const angle = (weight / totalWeight) * (360 / REPEAT_COUNT);
                if (!Number.isFinite(angle)) return; // Skip invalid segment

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

                // Define 18 Distinct Rainbow Colors
                const RAINBOW_COLORS = [
                    '#FF6B6B', // Red
                    '#FF4757', // Bright Red
                    '#FF7F50', // Coral
                    '#FFA502', // Orange
                    '#FF9F43', // Light Orange
                    '#ECCC68', // Golden Yellow
                    '#F1C40F', // Yellow
                    '#7BED9F', // Light Green
                    '#2ECC71', // Green
                    '#16A085', // Teal
                    '#1ABC9C', // Turquoise
                    '#7EFFF5', // Cyan
                    '#70A1FF', // Light Blue
                    '#1E90FF', // Dodger Blue
                    '#5352ED', // Indigo
                    '#3742FA', // Blue
                    '#A29BFE', // Light Purple
                    '#FF6348'  // Salmon/Pinkish
                ];

                // Calculate Color Index based on equidistance
                // If 2 items: index 0 and 9 (18/2 = 9)
                // If 3 items: index 0, 6, 12 (18/3 = 6)
                const colorIndex = Math.floor((i * RAINBOW_COLORS.length) / currentList.length) % RAINBOW_COLORS.length;
                const segmentColor = RAINBOW_COLORS[colorIndex];

                // Determine text color based on brightness (simple heuristic or fixed white/black)
                // For these vibrant colors, white usually looks good, or dark for very light ones.
                // Let's stick to White for consistency or dynamic if needed.
                const textColor = '#FFFFFF';

                const totalItems = currentList.length;
                const totalSegments = totalItems * REPEAT_COUNT;

                // Segment thickness in pixels at the outer edge (approx)
                const segmentArcLength = (2 * Math.PI * (ROULETTE_SIZE / 2)) / totalSegments;

                // Dynamic font size calculation
                // Base size is 12, but we scale it down if the segment is too narrow or text is long
                let calculatedFontSize = Math.min(12, segmentArcLength * 0.75);
                if (name.length > 8) calculatedFontSize *= 0.9;
                if (name.length > 12) calculatedFontSize *= 0.8;
                calculatedFontSize = Math.max(7.5, calculatedFontSize); // Minimum readable size

                // Perfect Radial Inward Style (Reference Image Style)
                // Text stands vertically (radially) and grows from border towards center
                const textAngle = startAngle + angle / 2;

                // Rotates text 90 degrees relative to the arc to point at the center center
                // Guard: prevent Infinity/NaN from division-by-zero edge cases
                const finalRotation = Number.isFinite(textAngle) ? textAngle + 90 : 0;

                // Position at the outer edge
                const textDist = REPEAT_COUNT === 1 ? 0.45 : 0.465;
                const tx = ROULETTE_SIZE / 2 + (ROULETTE_SIZE * textDist) * Math.cos((textAngle - 90) * (Math.PI / 180));
                const ty = ROULETTE_SIZE / 2 + (ROULETTE_SIZE * textDist) * Math.sin((textAngle - 90) * (Math.PI / 180));

                // Calculate colors
                let color, strokeColor;
                // Use the calculated vibrant rainbow color
                color = segmentColor;
                strokeColor = segmentColor; // Using the same color for stroke as per instruction 3.

                // Adjust font size for 1:1 mode
                if (REPEAT_COUNT === 1) {
                    calculatedFontSize *= 1.4; // Make it bigger since there's more space
                    calculatedFontSize = Math.min(18, calculatedFontSize);
                }

                sections.push(
                    <G key={`${repeat}-${i}`}>
                        <Path
                            d={d}
                            fill={color}
                            stroke={strokeColor}
                            strokeWidth="0.4"
                            strokeLinejoin="round"
                        />
                        <SvgText
                            x={tx}
                            y={ty}
                            fill="white"
                            fontSize={calculatedFontSize.toFixed(1)}
                            fontWeight="900"
                            textAnchor="start" // Starts at border, grows towards center
                            alignmentBaseline="middle"
                            opacity={0.95}
                            transform={`rotate(${finalRotation}, ${tx}, ${ty})`}
                            letterSpacing={0.5}
                        >
                            {name.toUpperCase()}
                        </SvgText>
                    </G>
                );
            });
        }

        return sections;
    };

    const renderCenterPiece = () => (
        <G>
            {/* Outer Ring Glow */}
            <Circle
                cx={ROULETTE_SIZE / 2}
                cy={ROULETTE_SIZE / 2}
                r={26}
                fill="transparent"
                stroke="#666666"
                strokeWidth="0.3"
                opacity={0.4}
            />
            {/* Main Core Base */}
            <Circle
                cx={ROULETTE_SIZE / 2}
                cy={ROULETTE_SIZE / 2}
                r={22}
                fill={Colors.background}
                stroke="#666666"
                strokeWidth="1.5"
            />
            {/* Inner Glass Glow Layer */}
            <Circle
                cx={ROULETTE_SIZE / 2}
                cy={ROULETTE_SIZE / 2}
                r={18}
                fill="rgba(102, 102, 102, 0.3)"
            />
            {/* Spinning Indicator SVG Path (Arrows) */}
            <Path
                d={`M ${ROULETTE_SIZE / 2 - 7} ${ROULETTE_SIZE / 2} A 7 7 0 0 1 ${ROULETTE_SIZE / 2 + 7} ${ROULETTE_SIZE / 2}`}
                fill="none"
                stroke="#666666"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <Path
                d={`M ${ROULETTE_SIZE / 2 + 5} ${ROULETTE_SIZE / 2 - 3} L ${ROULETTE_SIZE / 2 + 7} ${ROULETTE_SIZE / 2} L ${ROULETTE_SIZE / 2 + 10} ${ROULETTE_SIZE / 2 - 3}`}
                fill="none"
                stroke="#666666"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <SvgText
                x={ROULETTE_SIZE / 2}
                y={ROULETTE_SIZE / 2 + (ROULETTE_SIZE * 0.032)}
                fill={Colors.accent}
                fontSize={Math.max(10, ROULETTE_SIZE * 0.028)}
                fontWeight="900"
                textAnchor="middle"
                letterSpacing={1.5}
            >
                {t('roulette.spin_center').toUpperCase()}
            </SvgText>
        </G>
    );

    const getButtonText = () => {
        // Only show remote spinner if they are actually online
        const isRemoteSpinning = remoteSpinState?.isSpinning &&
            remoteSpinState.starter !== mySelectedName &&
            onlineUsers.some(u => u.name === remoteSpinState.starter);

        if (isRemoteSpinning) {
            return t('roulette.remote_spinning', { name: remoteSpinState.starter });
        }

        if (spinning) return t('roulette.spinning');

        if (mode === 'offline') return t('roulette.go_shout');

        const myVote = (votes || []).find(v => v.userId === syncService.myId);

        // If I have voted, show appropriate status
        if (myVote) return t('roulette.waiting_for_others');

        const expectedVoterCount = Math.max((participantsState || []).length, (onlineUsers || []).length);
        const allVoted = (votes || []).length >= expectedVoterCount && expectedVoterCount > 0;
        if (allVoted) return t('roulette.ready');

        return t('roulette.execute');
    };

    const handleExit = () => {
        setShowExitConfirm(true);
    };

    const renderPickCard = () => {
        const myVote = votes.find(v => v.userId === syncService.myId) || (votedItem ? { votedFor: votedItem } : null);
        if (!myVote) return null;

        // Dynamic color based on category to match NameInputScreen tags
        const categoryColor = category === 'coffee' ? Colors.neonPink :
            category === 'meal' ? Colors.success :
                category === 'snack' ? Colors.accent :
                    Colors.textSecondary;

        return (
            <View style={styles.pickCardContainer}>
                <View style={[styles.pickCard, { shadowColor: categoryColor }]}>
                    <NeonText text={t('roulette.your_pick').toUpperCase()} color={categoryColor} fontSize={16} />
                    <View style={[styles.pickItemBadge, { borderColor: categoryColor, backgroundColor: `${categoryColor}15` }]}>
                        <Text style={[styles.pickItemText, { color: categoryColor }]}>{myVote.votedFor.toUpperCase()}</Text>
                    </View>
                    <View style={styles.waitingContainer}>
                        <View style={[styles.pulseDot, { backgroundColor: categoryColor }]} />
                        <Text style={styles.waitingText}>
                            {t('result.waiting_for_others')}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1, overflow: 'hidden' }}>
                <View style={[styles.container, { paddingVertical: 0, paddingBottom: 16 }]}>
                    <View style={{ width: '100%', paddingTop: 10, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        {mode === 'online' && (
                            <View style={{
                                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: Colors.primary
                            }}>
                                <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>#{t('common.room_id')}: {(roomId || '').toUpperCase()}</Text>
                                <Text style={{ color: Colors.secondary, fontSize: 10, fontWeight: 'bold', marginTop: 1, opacity: 0.8 }}>{t('common.player').toUpperCase()}: {(mySelectedName || (role === 'owner' ? t('common.host') : t(`common.${role}`)) || t('common.unknown')).toUpperCase()}</Text>
                            </View>
                        )}
                        {mode === 'offline' && <View />}

                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            {mode !== 'offline' && (
                                <TouchableOpacity onPress={() => {
                                    // Cancel auto-close timer when manually opened
                                    if (autoCloseTimer.current) {
                                        clearTimeout(autoCloseTimer.current);
                                        autoCloseTimer.current = null;
                                    }
                                    setShowUsersModal(true);
                                }} style={{ padding: 4 }}>
                                    <ListChecks color={Colors.success} size={24} />
                                </TouchableOpacity>
                            )}

                            {role === 'owner' && mode === 'online' && !spinning && (
                                <TouchableOpacity
                                    onPress={() => processFinalResult(true)}
                                    activeOpacity={0.7}
                                    style={{ padding: 4 }}
                                >
                                    <Zap color={Colors.accent} size={24} fill={`${Colors.accent}33`} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={handleExit}
                                disabled={spinning}
                                style={{ padding: 4, opacity: spinning ? 0.3 : 1 }}
                            >
                                <LogOut color="rgba(255,255,255,0.45)" size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.mainContent}>
                        {votedItem && !spinning ? (
                            renderPickCard()
                        ) : (
                            <>
                                <View style={styles.header}>
                                    <NeonText className="text-3xl tracking-widest">{spinTarget === 'people' ? t('roulette.spinning_roulette') : t('roulette.gourmet_selection')}</NeonText>
                                    <View style={[styles.headerLine, { backgroundColor: spinTarget === 'people' ? Colors.primary : Colors.secondary }]} />
                                </View>
                                <View style={styles.wheelWrapper}>
                                    <View style={[styles.wheelGlow, { backgroundColor: '#666666' }]} />
                                    <Animated.View style={[animatedStyle, styles.wheelContainer]}>
                                        <Svg width={ROULETTE_SIZE} height={ROULETTE_SIZE}>
                                            <Defs>
                                                <RadialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
                                                    <Stop offset="0%" stopColor="#666666" stopOpacity="0.2" />
                                                    <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                                                </RadialGradient>
                                            </Defs>
                                            {/* Base Shadow */}
                                            <Circle cx={ROULETTE_SIZE / 2} cy={ROULETTE_SIZE / 2} r={ROULETTE_SIZE / 2} fill="#000" />

                                            {/* Sections */}
                                            {renderSections()}

                                            {/* Glass Shine Overlay */}
                                            <Circle
                                                cx={ROULETTE_SIZE / 2}
                                                cy={ROULETTE_SIZE / 2}
                                                r={ROULETTE_SIZE / 2}
                                                fill="url(#innerGlow)"
                                                pointerEvents="none"
                                            />

                                            {/* Outer Border Ring */}
                                            <Circle
                                                cx={ROULETTE_SIZE / 2}
                                                cy={ROULETTE_SIZE / 2}
                                                r={ROULETTE_SIZE / 2 - 1}
                                                fill="transparent"
                                                stroke="#666666"
                                                strokeWidth="1"
                                                pointerEvents="none"
                                            />

                                            {/* Center Core Piece */}
                                            {renderCenterPiece()}
                                        </Svg>
                                    </Animated.View>
                                    <View style={styles.pointerContainer}>
                                        <View style={[styles.pointer, { borderTopColor: Colors.accent }]} />
                                        <View style={[styles.pointerOuterGlow, { backgroundColor: Colors.accent, opacity: 0.3 }]} />
                                    </View>
                                </View>
                            </>
                        )}
                    </View>

                    <View style={styles.footer}>
                        {(votedItem && !spinning) ? (
                            <>
                                {/* WAITING button */}
                                <TouchableOpacity
                                    disabled={true}
                                    activeOpacity={1}
                                    style={[styles.reselectButton, { opacity: 0.4, marginBottom: 10 }]}
                                >
                                    <RotateCw color={Colors.primary} size={20} strokeWidth={2.5} style={{ marginRight: 8 }} />
                                    <Text style={styles.reselectText}>{getButtonText().toUpperCase()}</Text>
                                </TouchableOpacity>

                                {/* RE PICK button */}
                                <TouchableOpacity
                                    onPress={async () => {
                                        const expectedVoterCount = Math.max(participantsState.length, onlineUsers.length);
                                        const roomData = await syncService.getRoomData(roomId);
                                        if (roomData?.final_results || (votes.length >= expectedVoterCount && expectedVoterCount > 0)) {
                                            Alert.alert(t('common.alert'), t('roulette.voting_already_finished'));
                                            return;
                                        }
                                        try { feedbackService.playClick(); } catch (e) { }
                                        await syncService.removeMyVote();
                                        navigation.navigate('NameInput', {
                                            roomId, role, category,
                                            resetSelection: true,
                                            initialTab: spinTarget
                                        });
                                    }}
                                    activeOpacity={0.8}
                                    style={[styles.reselectButton, { marginBottom: role === 'owner' ? 10 : 0 }]}
                                >
                                    <HandMetal color={Colors.primary} size={20} strokeWidth={2.5} style={{ marginRight: 8 }} />
                                    <Text style={styles.reselectText}>{t('common.re_pick').toUpperCase()}</Text>
                                </TouchableOpacity>

                            </>
                        ) : (
                            !votedItem && (
                                <>
                                    {/* B 방식: people 모드 참여자는 시청만 (스핀 버튼 없음) */}
                                    {spinTarget === 'people' && role === 'participant' ? (
                                        <View style={[styles.spinButton, { opacity: 0.9, justifyContent: 'center' }]}>
                                            <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>
                                                {remoteSpinState?.isSpinning
                                                    ? t('roulette.remote_spinning', { name: remoteSpinState.starter })
                                                    : t('name_input.waiting_for_host')}
                                            </Text>
                                        </View>
                                    ) : (
                                        <>
                                            <TouchableOpacity
                                                onPress={spinRoulette}
                                                disabled={!!(spinning || votes.find(v => v.userId === syncService.myId) || currentList.length === 0)}
                                                activeOpacity={0.8}
                                                style={[
                                                    styles.spinButton,
                                                    (spinning || votes.find(v => v.userId === syncService.myId) || currentList.length === 0) && styles.disabledButton,
                                                    { marginBottom: (votes.find(v => v.userId === syncService.myId) && !spinning) || (role === 'owner' && votes.length > 0) ? 10 : 0 }
                                                ]}
                                            >
                                                <RotateCw color={spinning || votes.find(v => v.userId === syncService.myId) || currentList.length === 0 ? Colors.textSecondary : Colors.primary} size={24} style={{ marginRight: 12 }} />
                                                <NeonText className="text-xl">
                                                    {getButtonText()}
                                                </NeonText>
                                            </TouchableOpacity>

                                            {/* RE PICK button - shown when user has voted but votedItem not set (menu 모드만) */}
                                            {votes.find(v => v.userId === syncService.myId) && !spinning && (
                                        <TouchableOpacity
                                            onPress={async () => {
                                                const expectedVoterCount = Math.max(participantsState.length, onlineUsers.length);
                                                const roomData = await syncService.getRoomData(roomId);
                                                if (roomData?.final_results || (votes.length >= expectedVoterCount && expectedVoterCount > 0)) {
                                                    Alert.alert(t('common.alert'), t('roulette.voting_already_finished'));
                                                    return;
                                                }
                                                try { feedbackService.playClick(); } catch (e) { }
                                                await syncService.removeMyVote();
                                                navigation.navigate('NameInput', {
                                                    roomId, role, category,
                                                    resetSelection: true,
                                                    initialTab: spinTarget
                                                });
                                            }}
                                            activeOpacity={0.8}
                                            style={[styles.reselectButton, { marginBottom: role === 'owner' && votes.length > 0 ? 10 : 0 }]}
                                        >
                                            <HandMetal color={Colors.primary} size={20} strokeWidth={2.5} style={{ marginRight: 8 }} />
                                            <Text style={styles.reselectText}>{t('common.re_pick').toUpperCase()}</Text>
                                        </TouchableOpacity>
                                            )}
                                        </>
                                    )}

                                </>
                            )
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
                                {participantsState.map((participant, idx) => {
                                    const pName = typeof participant === 'object' ? (participant.name || participant.text || '') : String(participant);
                                    if (!pName.trim()) return null;

                                    const onlineUser = onlineUsers.find(u => u.name === pName);
                                    const userVote = votes.find(v => v.userName === pName || (onlineUser && v.userId === onlineUser.id));
                                    const isMe = mySelectedName === pName;

                                    return (
                                        <View key={`part-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                <View style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: onlineUser ? (userVote ? Colors.success : Colors.primary) : '#444',
                                                    marginRight: 10,
                                                    shadowColor: onlineUser ? (userVote ? Colors.success : Colors.primary) : '#000',
                                                    shadowRadius: 4,
                                                    shadowOpacity: 0.5
                                                }} />
                                                <Text style={{ color: onlineUser ? 'white' : 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: '500' }}>
                                                    {pName} {isMe ? <Text style={{ fontSize: 11, color: Colors.primary }}> {t('common.me')}</Text> : ''}
                                                </Text>
                                                {(pName === (roomHostName || route.params?.hostName) || onlineUser?.role === 'owner') && (
                                                    <View style={{
                                                        backgroundColor: `${Colors.accent}25`,
                                                        borderColor: Colors.accent,
                                                        borderWidth: 1.5,
                                                        borderRadius: 6,
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 1,
                                                        marginLeft: 8,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                    }}>
                                                        <Crown color={Colors.accent} size={10} fill={`${Colors.accent}33`} style={{ marginRight: 4 }} />
                                                        <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>{t('common.host').toUpperCase()}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                {onlineUser ? (
                                                    userVote ? (
                                                        <View style={{
                                                            backgroundColor: 'rgba(57, 255, 20, 0.1)',
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 4,
                                                            borderRadius: 4,
                                                            borderWidth: 1,
                                                            borderColor: 'rgba(57, 255, 20, 0.3)',
                                                            flexDirection: 'row',
                                                            alignItems: 'center'
                                                        }}>
                                                            <CheckCircle2 size={12} color={Colors.success} style={{ marginRight: 4 }} />
                                                            <Text style={{ color: Colors.success, fontSize: 11, fontWeight: 'bold' }}>
                                                                {userVote.votedFor ? userVote.votedFor.toUpperCase() : t('name_input.voter').toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    ) : (
                                                        <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: 'bold' }}>{t('name_input.waiting').toUpperCase()}</Text>
                                                    )
                                                ) : (
                                                    <Text style={{ color: '#444', fontSize: 11, fontWeight: 'bold' }}>{(t('common.not_connected') || 'OFFLINE').toUpperCase()}</Text>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}

                                {/* Loose participants section */}
                                {onlineUsers.filter(u => !participantsState.some(p => (typeof p === 'object' ? p.name : p) === u.name)).map((user, index) => (
                                    <View key={`loose-${index}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', opacity: 0.6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <User size={14} color="#666" style={{ marginRight: 10 }} />
                                            <Text style={{ color: '#666', fontSize: 14 }}>{user.name || 'Anonymous'}</Text>
                                            <View style={{ marginLeft: 8, backgroundColor: '#333', paddingHorizontal: 5, borderRadius: 4 }}>
                                                <Text style={{ color: '#999', fontSize: 9 }}>{t('common.not_in_list').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: '#444', fontSize: 11 }}>{t('common.guest').toUpperCase()}</Text>
                                    </View>
                                ))}

                                {participantsState.length === 0 && onlineUsers.length === 0 && (
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
            </SafeAreaView>
        </CyberBackground >
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
        opacity: 0.8,
    },
    wheelContainer: {
        width: ROULETTE_SIZE,
        height: ROULETTE_SIZE,
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
        borderWidth: 1.5,
        borderColor: Colors.primary,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: 'transparent',
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
        borderWidth: 2,
        borderColor: Colors.primary,
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
    mainContent: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    wheelWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
    },
    pickCardContainer: {
        width: '100%',
        alignItems: 'center',
    },
    pickCard: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 24,
        padding: 40,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    pickItemBadge: {
        marginTop: 20,
        marginBottom: 30,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 0, 0.1)',
        borderWidth: 2,
        borderColor: Colors.accent,
    },
    pickItemText: {
        color: Colors.accent,
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 2,
        textAlign: 'center',
    },
    waitingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.accent,
        opacity: 0.6,
    },
    waitingText: {
        color: Colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
    },
    reselectButton: {
        width: '100%',
        backgroundColor: 'transparent',
        paddingVertical: 10,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    reselectText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 2,
    },
    forceResultButton: {
        backgroundColor: '#8B1A1A',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    forceResultText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
});
