
import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, Modal, ScrollView, Platform, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { NeonText } from '../components/NeonText';
import { UserPlus, Trash2, Play, History, CheckCircle2, ListChecks, Users, X, Loader, LogOut, Crown, Utensils, Coffee, Cookie, User, HelpCircle, Circle, Zap, Target } from 'lucide-react-native';
import { syncService } from '../services/SyncService';
import { participantService } from '../services/ParticipantService';
import { CyberAlert } from '../components/CyberAlert';
import { useTranslation } from 'react-i18next';
import { feedbackService } from '../services/FeedbackService';

export default function NameInputScreen({ route, navigation }) {
    const { category = 'coffee', role = 'owner', roomId = 'default', initialTab } = route.params || {};
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [participants, setParticipants] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [activeTab, setActiveTab] = useState(initialTab || 'people'); // 'people' | 'menu' - initialTab으로 복원
    const [isLoaded, setIsLoaded] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingWeightIndex, setEditingWeightIndex] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [editingWeightValue, setEditingWeightValue] = useState('');
    const [mySelectedName, setMySelectedName] = useState(null);
    const [spinning, setSpinning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [votes, setVotes] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [activeCategory, setActiveCategory] = useState(category);
    const categoryRef = useRef(category);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });
    const [selectedMenuIndex, setSelectedMenuIndex] = useState(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    useEffect(() => {
        categoryRef.current = activeCategory;
    }, [activeCategory]);
    const [remoteSpinState, setRemoteSpinState] = useState(null);
    const [roomPhase, setRoomPhaseState] = useState('waiting');
    const [finalResults, setFinalResults] = useState(null);
    const isNavigatingRef = useRef(false);
    const inhibitedByResetRef = useRef(false);
    const isFocused = useIsFocused();
    const participantsRef = useRef(participants);

    useEffect(() => {
        participantsRef.current = participants;
    }, [participants]);

    useEffect(() => {
        const loadInitialData = async () => {
            console.log('NameInputScreen: Initializing room:', roomId);
            await syncService.init(null, roomId, role);

            // Restore previously selected name if available (UX improvement for Retry/Refresh)
            if (syncService.myName) {
                console.log('NameInputScreen: Restoring identity:', syncService.myName);
                setMySelectedName(syncService.myName);
            }

            // Sync room state based on role
            if (role === 'owner') {
                const isReturningToVote = route.params?.resetSelection;

                if (!isReturningToVote) {
                    console.log('NameInputScreen: Owner full initialization');
                    await syncService.setRoomPhase('waiting');
                    await syncService.setRoomCategory(category);
                    setActiveCategory(category);

                    // Initialize data
                    let existingParticipants = await syncService.getParticipants();
                    let savedParticipants = [];
                    if (existingParticipants && existingParticipants.length > 0) {
                        savedParticipants = existingParticipants;
                    } else {
                        savedParticipants = await participantService.getParticipants();
                        if (!savedParticipants || savedParticipants.length < 2) {
                            savedParticipants = [{ name: 'PARTICIPANT 1', weight: 1 }, { name: 'PARTICIPANT 2', weight: 1 }];
                        }
                    }
                    setParticipants(savedParticipants);
                    await syncService.setParticipants(savedParticipants);

                    let existingMenus = await syncService.getMenuItems();
                    let menuList = [];
                    if (existingMenus && existingMenus.length > 0) {
                        menuList = existingMenus;
                    } else {
                        if (category === 'coffee') menuList = [{ name: 'AMERICANO', weight: 1 }, { name: 'CAFE LATTE', weight: 1 }];
                        else if (category === 'meal') menuList = [{ name: 'KIMCHI STEW', weight: 1 }, { name: 'SOYBEAN STEW', weight: 1 }];
                        else menuList = [{ name: 'CHICKEN', weight: 1 }, { name: 'PIZZA', weight: 1 }];
                    }
                    setMenuItems(menuList);
                    await syncService.setMenuItems(menuList);

                    await syncService.clearSpinState();
                    await syncService.clearVotes();
                    await syncService.clearFinalResults();
                } else {
                    console.log('NameInputScreen: Owner returning to re-vote, skipping room reset');
                    // Just load current state to ensure local UI matches DB
                    const currentParticipants = await syncService.getParticipants();
                    if (currentParticipants) setParticipants(currentParticipants);

                    const currentMenus = await syncService.getMenuItems();
                    if (currentMenus) setMenuItems(currentMenus);

                    const currentCat = await syncService.getRoomCategory();
                    if (currentCat) setActiveCategory(currentCat);
                }
            }

            // --- Subscriptions MUST happen after init (when roomPath is set) ---

            // Store unsubs
            const unsubs = [];

            // Subscribe to room category (Everyone should stay in sync)
            unsubs.push(syncService.subscribeToCategory(cat => {
                setActiveCategory(cat);
            }));

            // If participant, subscribe to other room states
            if (role === 'participant') {
                unsubs.push(syncService.subscribeToParticipants(list => {
                    console.log('NameInputScreen: Received participants update:', list.length, 'items');
                    setParticipants(list);
                }));

                unsubs.push(syncService.subscribeToMenuItems(list => {
                    console.log('NameInputScreen: Received menu items update:', list.length, 'items');
                    setMenuItems(list);
                }));
            }

            // Subscribe to online users
            unsubs.push(syncService.subscribeToOnlineUsers(users => {
                console.log(`NameInputScreen: Online users updated: ${users.length} `);
                setOnlineUsers(users);
            }));

            // Subscribe to votes
            unsubs.push(syncService.subscribeToVotes(vts => {
                setVotes(vts);
            }));

            // Listen for spin start from owner
            unsubs.push(syncService.subscribeToSpinState(state => {
                setRemoteSpinState(state);
            }));

            // Listen for room phase
            unsubs.push(syncService.subscribeToRoomPhase(phase => {
                setRoomPhaseState(phase);
            }));

            // Listen for final results (game finished)
            unsubs.push(syncService.subscribeToFinalResults(results => {
                setFinalResults(results);
            }));

            setIsLoaded(true);
            return unsubs;
        };

        let activeUnsubs = [];
        loadInitialData().then(unsubs => {
            activeUnsubs = unsubs;
        });

        return () => {
            console.log('NameInputScreen: Cleaning up subscriptions...');
            activeUnsubs.forEach(unsub => unsub && unsub());
        };
    }, []);

    // Auto-navigate ONLY to Result screen when game is finished
    // Participants must manually click "WHAT?" button to join roulette screen
    useEffect(() => {
        // Guard: Only for participants, must be focused, and not currently navigating or resetting
        if (role !== 'participant' || !isFocused || isNavigatingRef.current || inhibitedByResetRef.current) return;

        // Auto-navigate ONLY if game is finished (Results exist)
        if (finalResults) {
            console.log('NameInputScreen: Game already finished, auto-navigating to result...');
            isNavigatingRef.current = true;
            navigation.navigate('Result', {
                ...finalResults,
                roomId,
                role: 'participant',
                category: activeCategory
            });
            return;
        }

    }, [finalResults, role, isFocused, roomId, activeCategory]);

    // Safe reset of selection state when navigating back
    useEffect(() => {
        if (route.params?.resetSelection) {
            console.log('NameInputScreen: Resetting selection state and inhibiting navigation...');
            inhibitedByResetRef.current = true;
            setSelectedMenuIndex(null);
            isNavigatingRef.current = false;

            // Clear the param
            navigation.setParams({ resetSelection: undefined });

            // Release inhibition after short delay to allow state to settle in DB
            setTimeout(() => {
                inhibitedByResetRef.current = false;
                console.log('NameInputScreen: Reset inhibition released');
            }, 1000);
        }
    }, [route.params?.resetSelection]);

    // Sync local selection with DB votes (Preserves selection on Retry/Refresh)
    useEffect(() => {
        if (!isFocused || !syncService.myId || votes.length === 0 || menuItems.length === 0) return;

        // Find current user's vote
        const myVote = votes.find(v => v.userId === syncService.myId);
        if (myVote && selectedMenuIndex === null) {
            const index = menuItems.findIndex(item => item.name === myVote.votedFor);
            if (index !== -1) {
                console.log(`NameInputScreen: Syncing selection with DB vote: ${myVote.votedFor} `);
                setSelectedMenuIndex(index);
            }
        }
    }, [votes, menuItems, isFocused]);

    // Restore tab from initialTab parameter (for retry functionality)
    useEffect(() => {
        if (initialTab && (initialTab === 'people' || initialTab === 'menu')) {
            console.log(`NameInputScreen: Restoring tab to: ${initialTab} `);
            setActiveTab(initialTab);
            // Clear the param after using it
            navigation.setParams({ initialTab: undefined });
        }
    }, [initialTab]);


    // Save participants whenever they change
    useEffect(() => {
        if (role === 'owner' && isLoaded && participants.length > 0) {
            participantService.saveParticipants(participants);
            syncService.setParticipants(participants);
        }
    }, [participants, isLoaded]);

    // Handle data restoration from history
    useEffect(() => {
        if (route.params?.restoredData && role === 'owner') {
            const { type, list } = route.params.restoredData;
            console.log(`NameInputScreen: Restoring ${type} from history...`);

            if (type === 'people') {
                setParticipants(list);
                syncService.setParticipants(list);
                setActiveTab('people');
            } else {
                setMenuItems(list);
                syncService.setMenuItems(list);
                setActiveTab('menu');
            }

            // Clear the param so it doesn't trigger again on re-focus
            navigation.setParams({ restoredData: null });
        }
    }, [route.params?.restoredData]);

    const redistributeWeights = (list) => {
        return list; // Numerical weights don't need auto-redistribution to 100%
    };

    const addParticipant = async () => {
        if (!name.trim()) return;
        if (activeTab === 'people') {
            const updated = [...participants, { name: name.trim(), weight: 1 }];
            setParticipants(updated);
            if (role === 'owner') await syncService.setParticipants(updated);
        } else {
            const updated = [...menuItems, { name: name.trim(), weight: 1 }];
            setMenuItems(updated);
            if (role === 'owner') await syncService.setMenuItems(updated);
        }
        setName('');
    };

    const removeParticipant = async (index) => {
        if (activeTab === 'people') {
            const removedItem = participants[index];
            if (removedItem.name === mySelectedName) setMySelectedName(null);
            const updated = participants.filter((_, i) => i !== index);
            setParticipants(updated);
            if (role === 'owner') await syncService.setParticipants(updated);
        } else {
            const updated = menuItems.filter((_, i) => i !== index);
            setMenuItems(updated);
            setSelectedMenuIndex(null);
            if (role === 'owner') await syncService.setMenuItems(updated);
        }
    };

    const startEditing = (index) => {
        const list = activeTab === 'people' ? participants : menuItems;
        setEditingIndex(index);
        setEditingValue(list[index].name);
    };

    const startEditingWeight = (index) => {
        const list = activeTab === 'people' ? participants : menuItems;
        setEditingWeightIndex(index);
        setEditingWeightValue(list[index].weight.toString());
    };

    const saveEdit = async () => {
        if (editingValue.trim()) {
            if (activeTab === 'people') {
                const oldName = participants[editingIndex].name;
                const newName = editingValue.trim();
                const newParticipants = [...participants];
                newParticipants[editingIndex] = { ...newParticipants[editingIndex], name: newName };
                setParticipants(newParticipants);
                if (role === 'owner') await syncService.setParticipants(newParticipants);
                if (oldName === mySelectedName) toggleMe(newName);
            } else {
                const newMenu = [...menuItems];
                newMenu[editingIndex] = { ...newMenu[editingIndex], name: editingValue.trim() };
                setMenuItems(newMenu);
                if (role === 'owner') await syncService.setMenuItems(newMenu);
            }
        }
        setEditingIndex(null);
    };

    const saveWeightEdit = async () => {
        const val = parseFloat(editingWeightValue);
        if (!isNaN(val) && val >= 0) {
            const roundedVal = Math.round(val * 10) / 10;
            if (activeTab === 'people') {
                const newParticipants = [...participants];
                newParticipants[editingWeightIndex] = { ...newParticipants[editingWeightIndex], weight: roundedVal };
                setParticipants(newParticipants);
                if (role === 'owner') await syncService.setParticipants(newParticipants);
            } else {
                const newMenu = [...menuItems];
                newMenu[editingWeightIndex] = { ...newMenu[editingWeightIndex], weight: roundedVal };
                setMenuItems(newMenu);
                if (role === 'owner') await syncService.setMenuItems(newMenu);
            }
        }
        setEditingWeightIndex(null);
    };

    const toggleMe = async (participantName) => {
        if (mySelectedName === participantName) {
            setMySelectedName(null);
            await syncService.setIdentity('');
        } else {
            setMySelectedName(participantName);
            await syncService.setIdentity(participantName);
        }
    };

    const handleDirectPick = async () => {
        if (selectedMenuIndex === null) {
            setAlertConfig({
                visible: true,
                title: t('common.alert'),
                message: t('name_input.select_menu_error')
            });
            return;
        }

        const pickedItem = menuItems[selectedMenuIndex];
        const winner = pickedItem.name;

        if (role === 'owner') {
            const isGameAlreadyActive = roomPhase === 'roulette' || (votes && votes.length > 0);

            if (isGameAlreadyActive) {
                // If game is active, just submit vote like a participant
                try {
                    console.log(`NameInputScreen: Owner joining active session, submitting vote: ${winner} `);
                    await syncService.submitVote(winner);

                    navigation.navigate('Roulette', {
                        participants,
                        menuItems,
                        mySelectedName,
                        roomId,
                        role,
                        category: activeCategory,
                        votedItem: winner,
                        spinTarget: 'menu'
                    });
                } catch (e) {
                    console.error('Owner failed to join active session:', e);
                }
            } else {
                try {
                    // Initialize game session for Menu Selection
                    console.log(`NameInputScreen: Owner initializing Direct Pick session for menu in room: `, roomId);
                    await syncService.setSpinTarget('menu');
                    await syncService.setRoomPhase('roulette');

                    // Clear previous session data
                    await syncService.clearVotes();
                    await syncService.clearSpinState();
                    await syncService.clearFinalResults();

                    // Submit the owner's direct choice as a vote
                    console.log(`NameInputScreen: Submitting owner's direct pick: ${winner}`);
                    await syncService.submitVote(winner);

                    // Navigate to Roulette Screen to wait for others
                    navigation.navigate('Roulette', {
                        participants,
                        menuItems,
                        mySelectedName,
                        roomId,
                        role,
                        category: activeCategory,
                        votedItem: winner,
                        spinTarget: 'menu'
                    });

                } catch (err) {
                    console.error('Direct pick failed:', err);
                    setAlertConfig({
                        visible: true,
                        title: t('common.error'),
                        message: t('name_input.connection_error')
                    });
                }
            }

        } else {
            // Participant handling for PICK NOW
            const isGameActive = roomPhase === 'roulette' || votes.length > 0 || remoteSpinState?.isSpinning;
            if (!isGameActive) {
                setAlertConfig({
                    visible: true,
                    title: t('common.info'),
                    message: t('name_input.waiting_for_host')
                });
                return;
            }

            try {
                await syncService.submitVote(winner);
            } catch (e) { console.error(e); }

            navigation.navigate('Roulette', {
                participants,
                menuItems,
                mySelectedName,
                roomId,
                role,
                category: activeCategory,
                votedItem: winner,
                spinTarget: 'menu'
            });
        }
    };

    const startRoulette = async (target = 'people') => {
        if (target === 'people') {
            if (participants.length < 2) {
                setAlertConfig({
                    visible: true,
                    title: t('common.alert'),
                    message: t('name_input.min_participants_error')
                });
                return;
            }
            // Validate total weight is positive
            const totalWeight = participants.reduce((sum, p) => sum + (p.weight || 0), 0);
            if (totalWeight <= 0) {
                setAlertConfig({
                    visible: true,
                    title: t('common.alert'),
                    message: t('name_input.min_participants_error')
                });
                return;
            }
        } else {
            if (menuItems.length < 2) {
                setAlertConfig({
                    visible: true,
                    title: t('common.alert'),
                    message: t('name_input.min_menu_error')
                });
                return;
            }
        }

        // Check if game is already in progress
        const isGameAlreadyActive = roomPhase === 'roulette' || votes.length > 0;

        // Clear previous session data ONLY when starting a fresh game
        if (role === 'owner') {
            try {
                // Determine if we need to switch targets or start fresh
                const currentSyncTarget = await syncService.getSpinTarget();
                const needsTargetSwitch = currentSyncTarget !== target;

                if (isGameAlreadyActive && !needsTargetSwitch) {
                    // Same mode game is in progress - just rejoin
                    console.log(`NameInputScreen: Owner rejoining active session for ${target} in room:`, roomId);
                } else {
                    // Different mode requested or fresh game - reset and initialize
                    console.log(`NameInputScreen: Owner initializing ${needsTargetSwitch ? 'NEW' : 'fresh'} session for ${target} in room:`, roomId);
                    await syncService.setSpinTarget(target);
                    await syncService.setRoomPhase('roulette');
                    await syncService.clearVotes();
                    await syncService.clearSpinState();
                    await syncService.clearFinalResults();
                }
            } catch (e) {
                console.error('NameInputScreen: Failed to initialize session:', e);
            }

            navigation.navigate('Roulette', {
                participants,
                menuItems,
                mySelectedName,
                roomId,
                role,
                category: activeCategory,
                spinTarget: target // Explicitly pass the target mode
            });
        }
    };

    const activeMenuColor = activeCategory === 'coffee' ? Colors.neonPink :
        activeCategory === 'meal' ? Colors.success :
            Colors.accent;

    const isPeopleTab = activeTab === 'people';

    const handleExit = () => {
        setShowExitConfirm(true);
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 20, width: '100%', maxWidth: 500, alignSelf: 'center' }}>
                    <View style={{ marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>#{t('common.room_id')}: {roomId.toUpperCase()}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 4 }}>
                                <ListChecks color={Colors.success} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('History', { role, roomId, category: activeCategory })} style={{ padding: 4 }}>
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

                    <View style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                            {(() => {
                                const catColor = activeCategory === 'coffee' ? Colors.neonPink :
                                    activeCategory === 'meal' ? Colors.success :
                                        Colors.accent;
                                return (
                                    <View style={{
                                        backgroundColor: `${catColor}20`,
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                        borderWidth: 1,
                                        borderColor: catColor
                                    }}>
                                        <Text style={{ color: catColor, fontSize: 10, fontWeight: 'bold' }}>
                                            {t(`categories.${activeCategory}`).toUpperCase()}
                                        </Text>
                                    </View>
                                );
                            })()}
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>{t(`common.${role === 'owner' ? 'host' : 'participant'}`).toUpperCase()}</Text>
                            </View>
                        </View>
                        <NeonText className="text-4xl">{activeTab === 'people' ? t('name_input.participants') : t('name_input.menu_items')}</NeonText>
                        <View style={{ height: 2, width: 100, backgroundColor: activeTab === 'people' ? Colors.primary : activeMenuColor, marginTop: 10, shadowColor: activeTab === 'people' ? Colors.primary : activeMenuColor, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 }} />
                    </View>

                    {/* Tab Switcher */}
                    <View style={{ flexDirection: 'row', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
                        <TouchableOpacity
                            onPress={() => setActiveTab('people')}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                alignItems: 'center',
                                backgroundColor: activeTab === 'people' ? 'rgba(0, 255, 255, 0.15)' : 'transparent',
                                borderRadius: 10,
                                borderWidth: activeTab === 'people' ? 1 : 0,
                                borderColor: Colors.primary
                            }}
                        >
                            <Text style={{ color: activeTab === 'people' ? Colors.primary : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>{t('name_input.people')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('menu')}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                alignItems: 'center',
                                backgroundColor: activeTab === 'menu' ? `${activeMenuColor}25` : 'transparent',
                                borderRadius: 10,
                                borderWidth: activeTab === 'menu' ? 1 : 0,
                                borderColor: activeMenuColor
                            }}
                        >
                            <Text style={{ color: activeTab === 'menu' ? activeMenuColor : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>{t('name_input.menu')}</Text>
                        </TouchableOpacity>
                    </View>

                    {role === 'owner' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
                            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginRight: 10, overflow: 'hidden' }}>
                                <TextInput
                                    style={{ color: 'white', padding: 16, fontSize: 16 }}
                                    placeholder={activeTab === 'people' ? t('name_input.add_participant') : t('name_input.add_menu_item')}
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={name}
                                    onChangeText={setName}
                                    onSubmitEditing={addParticipant}
                                    maxLength={15}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={addParticipant}
                                style={{
                                    backgroundColor: activeTab === 'people' ? Colors.primary : activeMenuColor,
                                    padding: 16,
                                    borderRadius: 12,
                                    shadowColor: activeTab === 'people' ? Colors.primary : activeMenuColor,
                                    shadowOpacity: 0.5,
                                    shadowRadius: 15,
                                    elevation: 8,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'row'
                                }}
                            >
                                <View style={{ position: 'relative' }}>
                                    {(() => {
                                        const iconProps = { color: "black", size: 24, strokeWidth: 2.5 };

                                        if (activeTab === 'people') {
                                            return <UserPlus {...iconProps} />;
                                        }

                                        switch (activeCategory) {
                                            case 'coffee':
                                                return <Coffee {...iconProps} />;
                                            case 'meal':
                                            case 'snack':
                                            default:
                                                return <Utensils {...iconProps} />;
                                        }
                                    })()}
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    <FlatList
                        data={activeTab === 'people' ? participants : menuItems}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item, index }) => {
                            const nameToCheck = item.name || item;
                            const isTakenByOther = isPeopleTab && onlineUsers.some(u => u.name === nameToCheck && u.id !== syncService.myId);
                            const isMe = isPeopleTab && mySelectedName === nameToCheck;
                            const activeThemeColor = isPeopleTab ? Colors.primary : activeMenuColor;
                            const currentList = activeTab === 'people' ? participants : menuItems;
                            const totalWeightSum = currentList.reduce((sum, p) => sum + (p.weight || 0), 0);
                            const totalWeight = Math.max(1, totalWeightSum);
                            // Format percentage: remove .0 if it's an integer
                            const percentageValue = (item.weight / totalWeight) * 100;
                            const percentage = percentageValue % 1 === 0 ? percentageValue.toFixed(0) : percentageValue.toFixed(1);
                            // Format weight: remove .0 if it's an integer
                            const displayWeight = item.weight % 1 === 0 ? item.weight.toFixed(0) : item.weight.toFixed(1);

                            return (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: isMe ? `${Colors.primary}15` : (isTakenByOther ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)'),
                                    padding: 8,
                                    borderRadius: 12,
                                    marginBottom: 6,
                                    borderWidth: 1,
                                    borderColor: isMe ? Colors.primary : (isTakenByOther ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'),
                                    opacity: isTakenByOther && !isMe ? 0.5 : 1
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        {isPeopleTab ? (
                                            <TouchableOpacity
                                                onPress={() => !isTakenByOther ? toggleMe(nameToCheck) : null}
                                                style={{ marginRight: 12 }}
                                                disabled={isTakenByOther && !isMe}
                                            >
                                                <CheckCircle2
                                                    color={isMe ? Colors.primary : (isTakenByOther ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)')}
                                                    size={22}
                                                    fill={isMe ? `${Colors.primary}33` : 'transparent'}
                                                />
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                // Allow everyone to select locally to indicate their preference (even if just for "Pick Now" voting)
                                                onPress={() => setSelectedMenuIndex(index)}
                                                style={{ marginRight: 12 }}
                                            >
                                                {selectedMenuIndex === index ? (
                                                    <CheckCircle2 color={activeMenuColor} size={22} fill={`${activeMenuColor}33`} />
                                                ) : (
                                                    <Circle color="rgba(255,255,255,0.2)" size={22} />
                                                )}
                                            </TouchableOpacity>
                                        )}

                                        {editingIndex === index && role === 'owner' ? (
                                            <TextInput
                                                autoFocus
                                                style={{ color: activeThemeColor, fontSize: 18, fontWeight: '500', flex: 1, padding: 0 }}
                                                value={editingValue}
                                                onChangeText={setEditingValue}
                                                onBlur={saveEdit}
                                                onSubmitEditing={saveEdit}
                                            />
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (activeTab === 'menu') {
                                                        if (role === 'owner') setSelectedMenuIndex(index);
                                                    } else {
                                                        if (!isTakenByOther && role === 'owner') startEditing(index);
                                                        else if (isPeopleTab && !isTakenByOther) toggleMe(nameToCheck);
                                                    }
                                                }}
                                                activeOpacity={isTakenByOther ? 1 : 0.7}
                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                                            >
                                                <Text style={{
                                                    color: isTakenByOther && !isMe ? 'rgba(255,255,255,0.4)' : activeThemeColor,
                                                    fontSize: 18,
                                                    fontWeight: '500',
                                                    letterSpacing: 1,
                                                    opacity: isMe ? 1 : 0.8,
                                                    textDecorationLine: isTakenByOther && !isMe ? 'line-through' : 'none'
                                                }}>{item.name}{isMe ? <Text style={{ fontSize: 13 }}> {t('common.me')}</Text> : ''}</Text>

                                                {/* Show Crown if this name is taken by an owner */}
                                                {isPeopleTab && onlineUsers.some(u => u.name === item.name && u.role === 'owner') && (
                                                    <View style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        marginLeft: 8,
                                                        backgroundColor: 'rgba(255, 255, 0, 0.15)',
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 3,
                                                        borderRadius: 6,
                                                        borderWidth: 1,
                                                        borderColor: Colors.accent,
                                                        shadowColor: Colors.accent,
                                                        shadowOpacity: 0.5,
                                                        shadowRadius: 5
                                                    }}>
                                                        <Crown color={Colors.accent} size={12} fill={Colors.accent} style={{ marginRight: 4 }} />
                                                        <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>{t('common.host').toUpperCase()}</Text>
                                                    </View>
                                                )}

                                                {/* Show Status Badge if taken */}
                                                {isPeopleTab && isTakenByOther && !isMe && (
                                                    <View style={{
                                                        marginLeft: 8,
                                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 2,
                                                        borderRadius: 4,
                                                    }}>
                                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 'bold' }}>{t('name_input.selected').toUpperCase()}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {role === 'owner' && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            {isPeopleTab && (
                                                editingWeightIndex === index ? (
                                                    <TextInput
                                                        autoFocus
                                                        keyboardType={Platform.OS === 'web' ? 'text' : 'decimal-pad'}
                                                        style={{
                                                            color: Colors.secondary,
                                                            fontSize: 16,
                                                            fontWeight: 'bold',
                                                            width: 50,
                                                            textAlign: 'right',
                                                            marginRight: 2,
                                                            padding: 0
                                                        }}
                                                        value={editingWeightValue}
                                                        onChangeText={setEditingWeightValue}
                                                        onBlur={saveWeightEdit}
                                                        onSubmitEditing={saveWeightEdit}
                                                    />
                                                ) : (
                                                    <TouchableOpacity onPress={() => startEditingWeight(index)}>
                                                        <View style={{ alignItems: 'flex-end', minWidth: 65 }}>
                                                            <Text style={{
                                                                color: Colors.secondary,
                                                                fontSize: 16,
                                                                fontWeight: 'bold',
                                                                textAlign: 'right'
                                                            }}>{displayWeight}</Text>
                                                            <Text style={{
                                                                color: 'rgba(255,255,255,0.4)',
                                                                fontSize: 10,
                                                                textAlign: 'right'
                                                            }}>
                                                                ({percentage}%)
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )
                                            )}

                                            <TouchableOpacity onPress={() => removeParticipant(index)} style={{ marginLeft: 20 }}>
                                                <Trash2 color={Colors.textSecondary} size={18} opacity={0.6} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {role === 'participant' && isPeopleTab && (
                                        <View style={{ minWidth: 65, alignItems: 'flex-end' }}>
                                            <Text style={{ color: Colors.secondary, fontSize: 16, fontWeight: 'bold', marginRight: 10 }}>
                                                {displayWeight}
                                            </Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginRight: 10 }}>
                                                ({percentage}%)
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListFooterComponent={(activeTab === 'people' ? participants : menuItems).length > 0 ? (
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                paddingHorizontal: 12,
                                marginTop: 5,
                                marginBottom: 15
                            }}>
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginRight: 10 }}>{t('name_input.total_ratio').toUpperCase()}:</Text>
                                <Text style={{
                                    color: Colors.secondary,
                                    fontSize: 14,
                                    fontWeight: 'bold'
                                }}>
                                    {(() => {
                                        const currentList = activeTab === 'people' ? participants : menuItems;
                                        const sum = currentList.reduce((sum, p) => sum + (p.weight || 0), 0);
                                        return sum % 1 === 0 ? sum.toFixed(0) : sum.toFixed(1);
                                    })()}
                                </Text>
                            </View>
                        ) : null}
                        ListEmptyComponent={
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 50 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>
                                    {role === 'owner' ? t('name_input.please_add_participants') : t('name_input.host_setting_up')}
                                </Text>
                            </View>
                        }
                    />

                    <View style={{ marginTop: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {isPeopleTab ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        if (role === 'owner') {
                                            startRoulette('people');
                                        } else {
                                            const isGameActive = roomPhase === 'roulette' || votes.length > 0 || remoteSpinState?.isSpinning;
                                            if (isGameActive) {
                                                navigation.navigate('Roulette', {
                                                    participants,
                                                    menuItems,
                                                    mySelectedName,
                                                    roomId,
                                                    role,
                                                    category: activeCategory,
                                                    spinTarget: 'people'
                                                });
                                            } else {
                                                setAlertConfig({
                                                    visible: true,
                                                    title: t('common.info'),
                                                    message: t('name_input.waiting_for_host')
                                                });
                                            }
                                        }
                                    }}
                                    activeOpacity={0.8}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(0, 255, 255, 0.05)',
                                        paddingVertical: 12,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: Colors.primary,
                                        shadowColor: Colors.primary,
                                        shadowOpacity: 0.3,
                                        shadowRadius: 15,
                                        elevation: 8
                                    }}
                                >
                                    <Users color={Colors.primary} size={20} style={{ marginRight: 8 }} />
                                    <NeonText className="text-lg" style={{ color: Colors.primary }}>
                                        {t('name_input.who')}
                                    </NeonText>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        onPress={handleDirectPick}
                                        activeOpacity={0.8}
                                        style={{
                                            flex: 1.2,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'rgba(0, 255, 255, 0.05)',
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            borderWidth: 2,
                                            borderColor: Colors.secondary,
                                            shadowColor: Colors.secondary,
                                            shadowOpacity: 0.3,
                                            shadowRadius: 15,
                                            elevation: 8,
                                            marginRight: 10
                                        }}
                                    >
                                        <Target color={Colors.secondary} size={20} style={{ marginRight: 8 }} />
                                        <NeonText className="text-lg" style={{ color: Colors.secondary }}>{t('name_input.pick_now')}</NeonText>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (role === 'owner') {
                                                startRoulette('menu');
                                            } else {
                                                // Participant: Just navigate to roulette screen without submitting vote
                                                // They will vote by spinning the wheel in the roulette screen
                                                const isGameActive = roomPhase === 'roulette' || votes.length > 0 || remoteSpinState?.isSpinning;
                                                if (!isGameActive) {
                                                    setAlertConfig({
                                                        visible: true,
                                                        title: t('common.info'),
                                                        message: t('name_input.waiting_for_host')
                                                    });
                                                    return;
                                                }

                                                // Navigate to roulette screen WITHOUT submitting vote
                                                // Vote will be submitted when they spin the wheel
                                                navigation.navigate('Roulette', {
                                                    participants,
                                                    menuItems,
                                                    mySelectedName,
                                                    roomId,
                                                    role,
                                                    category: activeCategory,
                                                    spinTarget: 'menu'
                                                });
                                            }
                                        }}
                                        activeOpacity={0.8}
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'rgba(0, 255, 255, 0.05)',
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            borderWidth: 2,
                                            borderColor: activeMenuColor, // Use activeMenuColor or Colors.secondary if strict
                                            shadowColor: activeMenuColor,
                                            shadowOpacity: 0.3,
                                            shadowRadius: 15,
                                            elevation: 8
                                        }}
                                    >
                                        <View style={{ marginRight: 8 }}>
                                            <Zap color={activeMenuColor} size={20} fill={activeMenuColor} />
                                        </View>
                                        <NeonText className="text-lg" style={{ color: activeMenuColor }}>
                                            {t('name_input.what')}
                                        </NeonText>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                    <View style={{
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: 'center',
                        marginTop: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    }}>
                        <Loader color={Colors.primary} size={20} style={{ marginBottom: 8 }} />
                        <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: 'bold', letterSpacing: 2 }}>
                            {finalResults
                                ? t('name_input.game_finished')
                                : (roomPhase === 'roulette' || votes.length > 0 || remoteSpinState?.isSpinning)
                                    ? (mySelectedName ? t('name_input.game_in_progress') : t('name_input.select_name_to_join'))
                                    : (mySelectedName ? t('name_input.waiting_for_host') : t('name_input.please_select_name'))
                            }
                        </Text>
                    </View>
                </View>

                <CyberAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type="info"
                    onConfirm={() => setAlertConfig({ ...alertConfig, visible: false })}
                />

                {/* Active Nodes Modal */}
                <Modal
                    visible={showUsersModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowUsersModal(false)}
                >
                    <View style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 20
                    }}>
                        <View style={{
                            backgroundColor: Colors.surface,
                            borderRadius: 20,
                            padding: 20,
                            width: '100%',
                            maxWidth: 400,
                            borderWidth: 2,
                            borderColor: Colors.primary,
                            shadowColor: Colors.primary,
                            shadowOpacity: 0.5,
                            shadowRadius: 20,
                            elevation: 10
                        }}>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 15
                            }}>
                                <NeonText className="text-2xl">{t('name_input.participant_status')}</NeonText>
                                <TouchableOpacity onPress={() => setShowUsersModal(false)}>
                                    <X color={Colors.primary} size={24} />
                                </TouchableOpacity>
                            </View>
                            <View style={{
                                height: 2,
                                backgroundColor: Colors.primary,
                                opacity: 0.3,
                                marginBottom: 15
                            }} />

                            {/* Column Headers */}
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                paddingHorizontal: 15,
                                paddingVertical: 10,
                                backgroundColor: 'rgba(0, 255, 255, 0.05)',
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(0, 255, 255, 0.2)',
                                marginBottom: 5
                            }}>
                                <Text style={{
                                    color: Colors.primary,
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    letterSpacing: 1.5,
                                    textTransform: 'uppercase'
                                }}>{t('name_input.voter')}</Text>
                                <Text style={{
                                    color: Colors.primary,
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    letterSpacing: 1.5,
                                    textTransform: 'uppercase'
                                }}>{t('name_input.winner')}</Text>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
                                {onlineUsers.map((user, idx) => {
                                    const userVote = votes.find(v => v.userId === user.id);
                                    return (
                                        <View key={user.id} style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            padding: 15,
                                            borderRadius: 12,
                                            marginBottom: 10,
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.08)'
                                        }}>
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 4,
                                                    marginRight: 15,
                                                    backgroundColor: userVote ? Colors.success : Colors.primary,
                                                    shadowColor: Colors.primary,
                                                    shadowOpacity: 0.8,
                                                    shadowRadius: 5,
                                                    elevation: 5
                                                }} />
                                                <Text style={{
                                                    color: 'white',
                                                    fontSize: 16,
                                                    fontWeight: '500',
                                                    letterSpacing: 1
                                                }}>
                                                    {user.name} {user.id === syncService.myId ? <Text style={{ fontSize: 11 }}> {t('common.me')}</Text> : ''}
                                                </Text>
                                            </View>
                                            <View style={{
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 6,
                                                borderWidth: 1,
                                                borderColor: userVote ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255,255,255,0.1)'
                                            }}>
                                                <Text style={{
                                                    color: userVote ? Colors.success : 'rgba(255,255,255,0.3)',
                                                    fontSize: 12,
                                                    fontWeight: 'bold'
                                                }}>
                                                    {userVote ? userVote.votedFor : t('name_input.waiting').toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
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
        </CyberBackground>
    );
}

