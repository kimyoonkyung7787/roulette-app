
import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, Modal, ScrollView, Platform, Alert, StyleSheet, LayoutAnimation, UIManager, Share } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { NeonText } from '../components/NeonText';
import { UserPlus, Trash2, Play, History, CheckCircle2, ListChecks, Users, X, Loader, LogOut, Crown, Utensils, Coffee, Cookie, User, HelpCircle, Circle, Zap, Target, Home, RotateCw, Guitar, Pencil, Check, Share2 } from 'lucide-react-native';
import { syncService } from '../services/SyncService';
import { participantService } from '../services/ParticipantService';
import { CyberAlert } from '../components/CyberAlert';
import { useTranslation } from 'react-i18next';
import { feedbackService } from '../services/FeedbackService';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}



export default function NameInputScreen({ route, navigation }) {
    const { category = 'coffee', role = 'owner', roomId = 'default', mode = 'online', initialTab } = route.params || {};
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [participants, setParticipants] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [activeTab, setActiveTab] = useState(initialTab || 'people');
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
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [editingParticipantIndex, setEditingParticipantIndex] = useState(null);
    const [editingParticipantName, setEditingParticipantName] = useState('');
    const [modalFocusedIndex, setModalFocusedIndex] = useState(null);
    const participantRefs = useRef([]);

    const startEditingParticipant = (index, currentName) => {
        setEditingParticipantIndex(index);
        setEditingParticipantName(currentName);
    };

    const saveEditingParticipant = async () => {
        if (editingParticipantIndex === null) return;
        const trimmed = editingParticipantName.trim();
        if (!trimmed) {
            setEditingParticipantIndex(null);
            return;
        }

        const updated = [...participants];
        const original = updated[editingParticipantIndex];

        let oldName = '';
        if (typeof original === 'object') {
            updated[editingParticipantIndex] = { ...original, name: trimmed };
            oldName = original.name;
        } else {
            updated[editingParticipantIndex] = { name: trimmed, weight: 1 };
            oldName = original;
        }

        if (mySelectedName === oldName) {
            setMySelectedName(trimmed);
        }

        setParticipants(updated);
        if (role === 'owner') await syncService.setParticipants(updated);
        setEditingParticipantIndex(null);
        setEditingParticipantName('');
    };

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
            } else {
                console.log('NameInputScreen: No identity found in syncService');
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
                    }

                    // Standardize and filter out completely empty entries if they somehow exist
                    let sanitizedParticipants = savedParticipants.filter(p => {
                        const n = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                        return n.trim() !== '';
                    });

                    // Default to at least 2 participants if empty or all was blank
                    if (sanitizedParticipants.length === 0) {
                        const pName = t('common.participant') || 'Participant';
                        const defaultParticipants = [
                            { name: `${pName} 1`, weight: 1 },
                            { name: `${pName} 2`, weight: 1 }
                        ];
                        setParticipants(defaultParticipants);
                        await syncService.setParticipants(defaultParticipants);

                        // AUTO-SELECT for owner if not set
                        if (role === 'owner' && !mySelectedName && !syncService.myName) {
                            const firstGuestName = defaultParticipants[0].name;
                            setMySelectedName(firstGuestName);
                            await syncService.setIdentity(firstGuestName);
                        }
                    } else {
                        setParticipants(sanitizedParticipants);
                        await syncService.setParticipants(sanitizedParticipants);

                        // AUTO-SELECT for owner if not set
                        if (role === 'owner' && !mySelectedName && !syncService.myName) {
                            const firstGuestName = typeof sanitizedParticipants[0] === 'object'
                                ? (sanitizedParticipants[0].name || sanitizedParticipants[0].text)
                                : sanitizedParticipants[0];

                            if (firstGuestName) {
                                setMySelectedName(firstGuestName);
                                await syncService.setIdentity(firstGuestName);
                            }
                        }
                    }

                    // Default category setup
                    // Default category setup
                    const initialCat = category || 'coffee';
                    setActiveCategory(initialCat);

                    // PROACTIVE SETUP: Ensure ALL categories have default menus if empty
                    const categoriesToInit = ['coffee', 'meal', 'snack', 'etc'];
                    console.log('NameInputScreen: Starting proactive menu initialization for room:', roomId);

                    for (const cat of categoriesToInit) {
                        const existing = await syncService.getMenuByCategory(cat);

                        // If category is empty, populate with 8 popular items
                        if (!existing || !Array.isArray(existing) || existing.length === 0) {
                            console.log(`NameInputScreen: Initializing default 8 items for ${cat}`);
                            const translatedPopular = t(`popular_items.${cat}`, { returnObjects: true });
                            const popular = Array.isArray(translatedPopular) ? translatedPopular : [];

                            // Ensure we prioritize 8 items from i18n
                            const defaultMenus = popular.length > 0
                                ? popular.map(name => ({ name }))
                                : [{ name: `${t('common.item') || 'Item'} 1` }, { name: `${t('common.item') || 'Item'} 2` }];

                            // Save to Firebase immediately
                            await syncService.setMenuByCategory(cat, defaultMenus);

                            // If this is the starting category, update local state
                            if (cat === initialCat) {
                                console.log(`NameInputScreen: Setting initial state for ${cat}`);
                                setMenuItems(defaultMenus);
                            }
                        } else if (cat === initialCat) {
                            // If already exists and is the initial category, just load it
                            console.log(`NameInputScreen: Loading existing data for initial category ${cat}`);
                            setMenuItems(existing);
                        }
                    }

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

            // If participant OR host re-syncing, subscribe to other room states
            // Important: Host should NOT subscribe to their own updates to avoid overwriting local state while editing
            if (role === 'participant') {
                unsubs.push(syncService.subscribeToParticipants(list => {
                    if (list && list.length > 0) {
                        console.log('NameInputScreen: Received participants update:', list.length, 'items');
                        setParticipants(list);
                    }
                }));

                unsubs.push(syncService.subscribeToMenuItems(list => {
                    if (list && list.length > 0) {
                        console.log('NameInputScreen: Received menu items update:', list.length, 'items');
                        setMenuItems(list);
                    }
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

    // Effect to identify the first available participant when the identity modal opens
    useEffect(() => {
        if (showIdentityModal) {
            // Priority: Find first one that is NOT taken and NOT me
            let index = participants.findIndex(p => {
                const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                if (!pName.trim()) return false;
                const isTaken = onlineUsers.some(u => u.name === pName && u.id !== syncService.myId);
                const isMe = mySelectedName === pName;
                return !isTaken && !isMe;
            });

            // Fallback: If no others available, maybe focus on myself
            if (index === -1) {
                index = participants.findIndex(p => {
                    const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                    return mySelectedName === pName;
                });
            }

            setModalFocusedIndex(index !== -1 ? index : null);
        } else {
            setModalFocusedIndex(null);
        }
    }, [showIdentityModal, participants, onlineUsers, mySelectedName]);

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
                mode,
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

    // Auto-select identity for participants upon entry or retry
    useEffect(() => {
        // Only run for participants and when data is fully loaded
        if (!isLoaded || role !== 'participant') return;

        // 1. RECOVERY: Check if I already have a selected name in the room (e.g. from Retry)
        const meInRoom = onlineUsers.find(u => u.id === syncService.myId);
        if (meInRoom && meInRoom.name) {
            if (mySelectedName !== meInRoom.name) {
                console.log(`NameInputScreen: Recovering previous selection: ${meInRoom.name}`);
                setMySelectedName(meInRoom.name);
            }
            return; // Already has a selection, so done
        }

        // 2. AUTO-SELECT: If no selection, pick the first available slot
        if (!mySelectedName && participants.length > 0) {
            const firstAvailable = participants.find(p => {
                const pName = typeof p === 'object' ? p.name : p;
                // Check if taken by anyone else (host or other participants)
                const isTaken = onlineUsers.some(u => u.name === pName);
                return !isTaken;
            });

            if (firstAvailable) {
                const nameToSelect = typeof firstAvailable === 'object' ? firstAvailable.name : firstAvailable;
                console.log(`NameInputScreen: Auto-selecting first available slot: ${nameToSelect}`);
                // Use toggleMe to set state and sync to DB
                toggleMe(nameToSelect);
            }
        }
    }, [isLoaded, role, participants, onlineUsers, mySelectedName]);

    // Restore tab from initialTab parameter (for retry functionality)
    useEffect(() => {
        if (initialTab && (initialTab === 'people' || initialTab === 'menu')) {
            console.log(`NameInputScreen: Restoring tab to: ${initialTab} `);
            setActiveTab(initialTab);
            // Clear the param after using it
            navigation.setParams({ initialTab: undefined });
        }
    }, [initialTab]);


    // Save participants whenever they change (Only work in owner mode and once loaded)
    useEffect(() => {
        // We only save if there's actually something to save
        if (role === 'owner' && isLoaded && participants.length > 0) {
            console.log('NameInputScreen: Syncing participants to DB...', participants.length);
            participantService.saveParticipants(participants);
            syncService.setParticipants(participants);
        }
    }, [participants, role, isLoaded]);

    // Save menus whenever they change
    useEffect(() => {
        // PREVENT OVERWRITE: Only save if the current menuItems actually belong to the current activeCategory
        // We check if the items are legacy (all coffee) when they shouldn't be, or use a simpler check
        if (role === 'owner' && isLoaded && menuItems.length > 0) {
            // We only save if we're not in the middle of a category transition
            // A simple way is to check if the first item matches the new category's defaults if it was just loaded
            console.log(`NameInputScreen: Syncing ${activeCategory} menu to DB...`, menuItems.length);
            syncService.setMenuByCategory(activeCategory, menuItems);
        }
    }, [menuItems, role, isLoaded]); // Removed activeCategory from dependency to prevent transition-overwrites

    // Validate identity against participant list
    useEffect(() => {
        if (isLoaded && mySelectedName && participants.length > 0) {
            const isNameValid = participants.some(p => (typeof p === 'object' ? p.name : p) === mySelectedName);
            if (!isNameValid) {
                console.log('NameInputScreen: Current identity not in participants list, clearing...');
                setMySelectedName(null);
                syncService.setIdentity('');
            }
        }
    }, [participants, isLoaded, mySelectedName]);

    // Handle data restoration from history
    useEffect(() => {
        if (route.params?.restoredData && role === 'owner') {
            const { type, list } = route.params.restoredData;
            console.log(`NameInputScreen: Restoring ${type} from history...`);

            if (type === 'people') {
                // Normalize list: handle both {name} and {text} formats from history
                const normalizedList = list.map(p => {
                    const itemName = typeof p === 'object' ? (p.name || p.text || '') : p;
                    return { name: itemName, weight: p.weight ?? 1 };
                });
                setParticipants(normalizedList);
                syncService.setParticipants(normalizedList);
                setActiveTab('people');
            } else {
                const normalizedList = list.map(m => {
                    const itemName = typeof m === 'object' ? (m.name || m.text || m) : m;
                    return { name: itemName };
                });
                setMenuItems(normalizedList);
                syncService.setMenuItems(normalizedList);
                setActiveTab('menu');
            }

            // Clear the param so it doesn't trigger again on re-focus
            navigation.setParams({ restoredData: null });
        }
    }, [route.params?.restoredData]);

    const handleCategoryChange = async (newCat) => {
        if (role !== 'owner') return;

        if (activeCategory !== newCat) {
            console.log(`NameInputScreen: Category switching from ${activeCategory} to ${newCat}`);
            try { feedbackService.playClick(); } catch (e) { }

            // 1. Save current one explicitly before switching
            await syncService.setMenuByCategory(activeCategory, menuItems);

            // 2. Clear state that should be reset
            setSelectedMenuIndex(null);

            // 3. Update category state
            setActiveCategory(newCat);
            await syncService.setRoomCategory(newCat);

            // 4. Fetch the NEW items FIRST, then set them
            // This order is crucial to prevent the 'save' useEffect from seeing old items with new category
            const savedMenus = await syncService.getMenuByCategory(newCat);

            if (savedMenus && savedMenus.length > 0) {
                console.log(`NameInputScreen: Loaded saved menu for ${newCat}`);
                setMenuItems(savedMenus);
            } else {
                console.log(`NameInputScreen: Loading defaults for ${newCat}`);
                const translatedPopular = t(`popular_items.${newCat}`, { returnObjects: true });
                const popular = Array.isArray(translatedPopular) ? translatedPopular : [];
                const newItems = popular.length > 0 ? popular.map(name => ({ name })) : [{ name: `${t('common.item') || 'Item'} 1` }];
                setMenuItems(newItems);
                // The useEffect will handle saving these new defaults
            }

            if (Platform.OS !== 'web') {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
        }
    };

    const redistributeWeights = (list) => {
        return list; // Numerical weights don't need auto-redistribution to 100%
    };

    const addParticipant = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        if (activeTab === 'people') {
            const updated = [...participants, { name: trimmedName, weight: 1 }];
            setParticipants(updated);
            if (role === 'owner') await syncService.setParticipants(updated);
        } else {
            const updated = [...menuItems, { name: trimmedName }];
            setMenuItems(updated);
            if (role === 'owner') await syncService.setMenuItems(updated);
        }
        setName('');
    };

    // Dedicated function for Modal to ensure it always adds to PEOPLE list regardless of activeTab
    const addParticipantFromModal = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        // Force add to participants list
        const updated = [...participants, { name: trimmedName, weight: 1 }];
        setParticipants(updated);
        if (role === 'owner') await syncService.setParticipants(updated);

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

    // Dedicated removal for Modal
    const removeParticipantFromModal = async (index) => {
        const removedItem = participants[index];
        if (removedItem && removedItem.name === mySelectedName) setMySelectedName(null);

        const updated = participants.filter((_, i) => i !== index);
        setParticipants(updated);
        if (role === 'owner') await syncService.setParticipants(updated);
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
            }
        }
        setEditingWeightIndex(null);
    };

    const toggleMe = async (participantName) => {
        if (!participantName || participantName.trim() === '') return;

        // Check if taken by other
        const isTaken = isPeopleTab && onlineUsers.some(u => u.name === participantName && u.id !== syncService.myId);

        if (mySelectedName === participantName) {
            setMySelectedName(null);
            await syncService.setIdentity('');
        } else if (!isTaken) {
            setMySelectedName(participantName);
            await syncService.setIdentity(participantName);
        } else {
            Alert.alert(t('common.alert'), t('name_input.already_taken'));
        }
    };

    const handleDirectPick = async () => {
        if (!mySelectedName) {
            setAlertConfig({
                visible: true,
                title: t('common.alert'),
                message: t('name_input.please_select_name')
            });
            return;
        }
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
                        mode,
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
                        mode,
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
                mode,
                role,
                category: activeCategory,
                votedItem: winner,
                spinTarget: 'menu'
            });
        }
    };

    const startRoulette = async (target = 'people') => {
        if (!mySelectedName) {
            setAlertConfig({
                visible: true,
                title: t('common.alert'),
                message: t('name_input.please_select_name')
            });
            return;
        }
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
                mode,
                role,
                category: activeCategory,
                spinTarget: target, // Explicitly pass the target mode
                autoStartSpin: true
            });
        } else {
            // Participant handling for SPIN button
            const isGameActive = roomPhase === 'roulette' || remoteSpinState?.isSpinning;
            if (!isGameActive) {
                setAlertConfig({
                    visible: true,
                    title: t('common.info'),
                    message: t('name_input.waiting_for_host')
                });
                return;
            }

            navigation.navigate('Roulette', {
                participants,
                menuItems,
                mySelectedName,
                roomId,
                mode,
                role,
                category: activeCategory,
                spinTarget: target,
                autoStartSpin: true
            });
        }
    };

    const checkIdentityBeforeAction = () => {
        // Offline mode: No need for identity selection as people are gathered together
        if (mode === 'offline') {
            return true;
        }

        // Online mode: Mandatory identity selection to track remote participants
        if (!mySelectedName) {
            Alert.alert(t('common.alert'), t('name_input.please_select_name'));
            setShowIdentityModal(true);
            return false;
        }
        return true;
    };

    const activeMenuColor = Colors.primary;

    const categoryColor = activeCategory === 'coffee' ? Colors.neonPink :
        activeCategory === 'meal' ? Colors.success :
            activeCategory === 'snack' ? Colors.accent :
                Colors.textSecondary;

    const isPeopleTab = activeTab === 'people';

    const handleExit = () => {
        setShowExitConfirm(true);
    };

    const handleShare = async () => {
        try {
            const inviteUrl = `https://roulette-app.vercel.app/?roomId=${roomId}`;
            const message = `[돌림판 게임 초대] 🎮\n\n${mySelectedName || 'Host'}님이 돌림판 게임에 초대했습니다!\n\n방 번호: ${roomId.toUpperCase()}\n\n아래 링크를 클릭해서 바로 참여하세요!\n${inviteUrl}`;

            await Share.share({
                message,
                url: inviteUrl, // iOS supports this
                title: '돌림판 게임 초대'
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const totalParticipantsWeight = participants.reduce((sum, p) => sum + (p.weight || 0), 0);

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 20, width: '100%', maxWidth: 500, alignSelf: 'center' }}>
                    <View style={{ marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        {mode === 'online' && (
                            <View style={{
                                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: Colors.primary,
                                shadowColor: Colors.primary,
                                shadowOpacity: 0.3,
                                shadowRadius: 5,
                                alignSelf: 'center'
                            }}>
                                <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>#{t('common.room_id')}: {roomId.toUpperCase()}</Text>
                            </View>
                        )}
                        {mode === 'offline' && <View />}

                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            {mode === 'online' && role === 'owner' && (
                                <TouchableOpacity onPress={handleShare} style={{ padding: 4 }}>
                                    <Share2 color={Colors.accent} size={24} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 4 }}>
                                <ListChecks color={Colors.success} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('History', { role, roomId, mode, category: activeCategory })} style={{ padding: 4 }}>
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

                    <View style={{ marginBottom: 5 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                            {role === 'owner' ? (
                                <View style={{
                                    backgroundColor: `${Colors.accent}25`,
                                    borderColor: Colors.accent,
                                    borderWidth: 1.5,
                                    borderRadius: 6,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginRight: 10,
                                    shadowColor: Colors.accent,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.8,
                                    shadowRadius: 6,
                                    elevation: 3
                                }}>
                                    <Crown color={Colors.accent} size={12} fill={`${Colors.accent}33`} style={{ marginRight: 4 }} />
                                    <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>HOST</Text>
                                </View>
                            ) : (
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', marginRight: 10 }}>
                                    <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>PARTICIPANT</Text>
                                </View>
                            )}

                            {activeTab !== 'people' && (() => {
                                const cat = activeCategory || 'coffee';
                                const catColor = cat === 'coffee' ? Colors.neonPink :
                                    cat === 'meal' ? Colors.success :
                                        cat === 'snack' ? Colors.accent :
                                            Colors.textSecondary;
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
                                            {cat.toUpperCase()}
                                        </Text>
                                    </View>
                                );
                            })()}
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 25 }}>
                        <View style={{ flex: 1 }}>
                            <NeonText className="text-4xl" style={{ fontSize: 28 }}>{activeTab === 'people' ? t('name_input.participants') : t('name_input.menu_items')}</NeonText>
                            <View style={{ height: 2, width: 60, backgroundColor: activeTab === 'people' ? Colors.primary : activeMenuColor, marginTop: 10, shadowColor: activeTab === 'people' ? Colors.primary : activeMenuColor, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 }} />
                        </View>

                        {activeTab === 'menu' && (
                            <TouchableOpacity
                                onPress={() => setShowIdentityModal(true)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: mySelectedName ? `${Colors.primary}20` : `${Colors.accent}20`,
                                    paddingHorizontal: 15,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    borderWidth: 1.5,
                                    borderColor: mySelectedName ? Colors.primary : Colors.accent,
                                    marginLeft: 10,
                                    minWidth: 110,
                                    justifyContent: 'center',
                                    shadowColor: mySelectedName ? Colors.primary : Colors.accent,
                                    shadowOpacity: 0.5,
                                    shadowRadius: 8,
                                    elevation: 5
                                }}
                            >
                                <User size={16} color={mySelectedName ? Colors.primary : Colors.accent} style={{ marginRight: 8 }} />
                                <Text style={{ color: mySelectedName ? 'white' : Colors.accent, fontSize: 13, fontWeight: '900' }}>
                                    {mySelectedName ? mySelectedName : t('name_input.select_me')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>


                    {activeTab === 'menu' && role === 'owner' && (
                        <View style={{ flexDirection: 'row', marginBottom: 20, flexWrap: 'wrap' }}>
                            {['coffee', 'meal', 'snack', 'etc'].map((cat) => {
                                const isSelected = activeCategory === cat;
                                const catColor = cat === 'coffee' ? Colors.neonPink :
                                    cat === 'meal' ? Colors.success :
                                        cat === 'snack' ? Colors.accent :
                                            Colors.textSecondary;

                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => handleCategoryChange(cat)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 8,
                                            borderWidth: 1.5,
                                            borderColor: isSelected ? catColor : 'rgba(255,255,255,0.1)',
                                            backgroundColor: isSelected ? `${catColor}15` : 'rgba(255,255,255,0.03)',
                                            minWidth: 70,
                                            alignItems: 'center',
                                            marginRight: 8,
                                            marginBottom: 8
                                        }}
                                    >
                                        <Text style={{
                                            color: isSelected ? catColor : 'rgba(255,255,255,0.4)',
                                            fontSize: 12,
                                            fontWeight: '900',
                                            letterSpacing: 1
                                        }}>
                                            {cat.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}


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
                                    backgroundColor: activeTab === 'people' ? Colors.primary : categoryColor,
                                    padding: 16,
                                    borderRadius: 12,
                                    shadowColor: activeTab === 'people' ? Colors.primary : categoryColor,
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
                                                return <Utensils {...iconProps} />;
                                            case 'snack':
                                                return <Cookie {...iconProps} />;
                                            case 'etc':
                                                return <Guitar {...iconProps} />;
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
                        renderItem={({ item, index }) => {
                            // Ensure nameToCheck is always a string
                            const rawName = typeof item === 'object' ? (item.name || item.text || '') : String(item);
                            const nameToCheck = rawName.trim();
                            const hasName = nameToCheck !== '';

                            const isTakenByOther = isPeopleTab && hasName && onlineUsers.some(u => u.name === nameToCheck && u.id !== syncService.myId);
                            const isMe = isPeopleTab && hasName && mySelectedName === nameToCheck;
                            const isHost = isPeopleTab && hasName && (mode === 'online' ? onlineUsers.some(u => u.name === nameToCheck && u.role === 'owner') : (isMe && role === 'owner'));
                            const activeThemeColor = isPeopleTab ? Colors.primary : activeMenuColor;
                            const currentList = activeTab === 'people' ? participants : menuItems;
                            let totalWeight = 1;
                            let percentage = '0';
                            let displayWeight = '1';

                            if (isPeopleTab) {
                                const totalWeightSum = participants.reduce((sum, p) => sum + (p.weight || 0), 0);
                                totalWeight = Math.max(1, totalWeightSum);
                                const weightValue = item.weight || 0;
                                const percentageValue = (weightValue / totalWeight) * 100;
                                percentage = percentageValue % 1 === 0 ? percentageValue.toFixed(0) : percentageValue.toFixed(1);
                                displayWeight = weightValue % 1 === 0 ? weightValue.toFixed(0) : weightValue.toFixed(1);
                            }

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
                                                style={{ marginRight: 12, padding: 4 }}
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
                                                style={{ color: 'white', fontSize: 18, fontWeight: '500', flex: 1, padding: 0 }}
                                                value={editingValue}
                                                onChangeText={setEditingValue}
                                                onBlur={saveEdit}
                                                onSubmitEditing={saveEdit}
                                            />
                                        ) : (
                                            <TouchableOpacity
                                                disabled={role !== 'owner' && isTakenByOther}
                                                onPress={() => {
                                                    if (role === 'owner') {
                                                        startEditing(index);
                                                    } else if (!isTakenByOther) {
                                                        toggleMe(nameToCheck);
                                                    }
                                                }}
                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                                            >
                                                <Text style={{
                                                    color: !hasName ? 'rgba(255,255,255,0.2)' : ((isTakenByOther && !isMe) ? Colors.textSecondary : 'white'),
                                                    fontSize: 18,
                                                    fontWeight: '500',
                                                    fontStyle: !hasName ? 'italic' : 'normal'
                                                }}>
                                                    {hasName ? nameToCheck : t('common.unknown')} {isMe && <Text style={{ color: Colors.primary, fontSize: 14 }}>{t('common.me')}</Text>}
                                                    {isTakenByOther && !isMe && <Text style={{ color: Colors.textSecondary, fontSize: 12 }}> ({t('name_input.selected').toUpperCase()})</Text>}
                                                </Text>
                                                {isHost && (
                                                    <View style={{
                                                        backgroundColor: `${Colors.accent}25`,
                                                        borderColor: Colors.accent,
                                                        borderWidth: 1,
                                                        borderRadius: 4,
                                                        paddingHorizontal: 4,
                                                        marginLeft: 6,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                    }}>
                                                        <Crown color={Colors.accent} size={12} fill={`${Colors.accent}33`} style={{ marginRight: 4 }} />
                                                        <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>{t('common.host').toUpperCase()}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {isPeopleTab && (
                                            <TouchableOpacity
                                                disabled={role !== 'owner'}
                                                onPress={() => role === 'owner' && startEditingWeight(index)}
                                                style={{
                                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                                    width: 40,
                                                    height: 44,
                                                    borderRadius: 6,
                                                    marginRight: 10,
                                                    borderWidth: 1,
                                                    borderColor: 'rgba(255,255,255,0.1)',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {editingWeightIndex === index && role === 'owner' ? (
                                                    <TextInput
                                                        autoFocus
                                                        style={{ color: 'white', fontSize: 14, fontWeight: 'bold', padding: 0, textAlign: 'center', width: '100%', height: '100%' }}
                                                        value={editingWeightValue}
                                                        onChangeText={(text) => setEditingWeightValue(text.replace(/[^0-9]/g, '').slice(0, 2))}
                                                        onBlur={saveWeightEdit}
                                                        onSubmitEditing={saveWeightEdit}
                                                        keyboardType="number-pad"
                                                        maxLength={2}
                                                    />
                                                ) : (
                                                    <View style={{ alignItems: 'center' }}>
                                                        <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: 'bold' }}>
                                                            {displayWeight}
                                                        </Text>
                                                        <Text style={{ color: Colors.textSecondary, fontSize: 10, opacity: 0.7 }}>
                                                            ({percentage}%)
                                                        </Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        )}

                                        {role === 'owner' && (
                                            <TouchableOpacity onPress={() => removeParticipant(index)} style={{ padding: 4 }}>
                                                <Trash2 color="rgba(255,255,255,0.2)" size={20} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        }}

                        ListFooterComponent={
                            activeTab === 'people' && participants.length > 0 ? (
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 10, paddingRight: 10 }}>
                                    <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '500' }}>
                                        TOTAL WEIGHT: <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>{totalParticipantsWeight}</Text>
                                    </Text>
                                </View>
                            ) : null
                        }
                    />



                    {/* Bottom Action Button */}
                    <View style={{ paddingTop: 0 }}>
                        {activeTab === 'menu' ? (
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={handleDirectPick}
                                    style={{
                                        flex: 1,
                                        backgroundColor: 'transparent',
                                        paddingVertical: 14,
                                        borderRadius: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1.5,
                                        borderColor: activeMenuColor
                                    }}
                                >
                                    <CheckCircle2 color={activeMenuColor} size={20} strokeWidth={2.5} />
                                    <Text style={{
                                        color: activeMenuColor,
                                        fontSize: 16,
                                        fontWeight: '900',
                                        letterSpacing: 1,
                                        marginLeft: 6
                                    }}>{t('name_input.pick_now')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (checkIdentityBeforeAction()) {
                                            startRoulette('menu');
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        backgroundColor: 'transparent',
                                        paddingVertical: 14,
                                        borderRadius: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1.5,
                                        borderColor: activeMenuColor
                                    }}
                                >
                                    <RotateCw color={activeMenuColor} size={20} />
                                    <Text style={{
                                        color: activeMenuColor,
                                        fontSize: 16,
                                        fontWeight: '900',
                                        letterSpacing: 1,
                                        marginLeft: 6
                                    }}>{t('name_input.what')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    if (checkIdentityBeforeAction()) {
                                        activeTab === 'menu' ? handleDirectPick() : startRoulette(activeTab);
                                    }
                                }}
                                style={{
                                    backgroundColor: 'transparent',
                                    paddingVertical: 14,
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1.5,
                                    borderColor: activeTab === 'people' ? Colors.primary : activeMenuColor
                                }}
                            >
                                {activeTab === 'people' ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <RotateCw color={Colors.primary} size={24} />
                                        <Text style={{
                                            color: Colors.primary,
                                            fontSize: 20,
                                            fontWeight: '900',
                                            letterSpacing: 2,
                                            marginLeft: 8
                                        }}>{t('name_input.what')}</Text>
                                    </View>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <CheckCircle2 color={activeMenuColor} size={24} strokeWidth={2.5} />
                                        <Text style={{
                                            color: activeMenuColor,
                                            fontSize: 20,
                                            fontWeight: '900',
                                            letterSpacing: 2,
                                            marginLeft: 8
                                        }}>{t('name_input.vote')}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Identity Selection Modal (When me is not set in menu mode) */}
                    {/* Identity Selection Modal (When me is not set in menu mode) */}
                    {/* Identity Selection Modal (When me is not set in menu mode) */}
                    <Modal
                        visible={showIdentityModal}
                        transparent={true}
                        animationType="slide"
                        onRequestClose={() => setShowIdentityModal(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                            <View style={{
                                width: '100%',
                                maxWidth: 500,
                                backgroundColor: '#050505',
                                borderRadius: 24,
                                padding: 24,
                                borderWidth: 2,
                                borderColor: Colors.primary,
                                shadowColor: Colors.primary,
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.5,
                                shadowRadius: 20,
                                elevation: 10,
                                maxHeight: '80%'
                            }}>
                                <View style={{ marginBottom: 20 }}>
                                    {role === 'owner' ? (
                                        <View style={{
                                            backgroundColor: `${Colors.accent}25`,
                                            borderColor: Colors.accent,
                                            borderWidth: 1.5,
                                            borderRadius: 6,
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginBottom: 5,
                                            alignSelf: 'flex-start',
                                            shadowColor: Colors.accent,
                                            shadowOffset: { width: 0, height: 0 },
                                            shadowOpacity: 0.8,
                                            shadowRadius: 6,
                                            elevation: 3
                                        }}>
                                            <Crown color={Colors.accent} size={12} fill={`${Colors.accent}33`} style={{ marginRight: 4 }} />
                                            <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>HOST</Text>
                                        </View>
                                    ) : (
                                        <View style={{
                                            backgroundColor: '#222',
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 4,
                                            alignSelf: 'flex-start',
                                            marginBottom: 5,
                                            borderWidth: 1,
                                            borderColor: '#444'
                                        }}>
                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: 'bold' }}>PARTICIPANT</Text>
                                        </View>
                                    )}
                                    <NeonText style={{ fontSize: 24, color: Colors.primary }}>PARTICIPANTS</NeonText>
                                    <View style={{ height: 2, width: 40, backgroundColor: Colors.primary, marginTop: 5, shadowColor: Colors.primary, shadowOpacity: 1, shadowRadius: 8 }} />
                                </View>

                                {/* Host-only Input Field */}
                                {role === 'owner' && (
                                    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                                        <TextInput
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#1a1a1a',
                                                borderRadius: 12,
                                                padding: 16,
                                                color: 'white',
                                                borderWidth: 1,
                                                borderColor: '#333',
                                                fontSize: 14,
                                                outlineStyle: 'none'
                                            }}
                                            placeholder={t('name_input.add_participant')}
                                            placeholderTextColor="#666"
                                            value={name}
                                            onChangeText={setName}
                                            onSubmitEditing={addParticipantFromModal}
                                            maxLength={15}
                                            autoFocus={false}
                                        />
                                        <TouchableOpacity
                                            onPress={addParticipantFromModal}
                                            style={{
                                                marginLeft: 10,
                                                backgroundColor: Colors.primary,
                                                borderRadius: 12,
                                                width: 50,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                shadowColor: Colors.primary,
                                                shadowOpacity: 0.5,
                                                shadowRadius: 10
                                            }}
                                        >
                                            <UserPlus color="black" size={24} />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                    {participants.length === 0 ? (
                                        <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>
                                            {t('name_input.please_add_participants')}
                                        </Text>
                                    ) : (
                                        participants.map((p, index) => {
                                            const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                                            const isTaken = onlineUsers.some(u => u.name === pName && u.id !== syncService.myId);
                                            const isMe = mySelectedName === pName;
                                            const isEditing = editingParticipantIndex === index;

                                            // Skip empty names
                                            if (!pName.trim()) return null;

                                            if (isEditing) {
                                                return (
                                                    <View
                                                        key={index}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: 8,
                                                            borderRadius: 12,
                                                            marginBottom: 6,
                                                            backgroundColor: '#222',
                                                            borderWidth: 1,
                                                            borderColor: Colors.primary,
                                                        }}
                                                    >
                                                        <View style={{ padding: 8, marginRight: 5 }}>
                                                            <CheckCircle2
                                                                size={20}
                                                                color={isMe ? Colors.primary : '#444'}
                                                            />
                                                        </View>
                                                        <TextInput
                                                            style={{
                                                                flex: 1,
                                                                color: 'white',
                                                                fontSize: 16,
                                                                padding: 5
                                                            }}
                                                            value={editingParticipantName}
                                                            onChangeText={setEditingParticipantName}
                                                            autoFocus={true}
                                                            onBlur={saveEditingParticipant}
                                                            onSubmitEditing={saveEditingParticipant}
                                                        />
                                                        {role === 'owner' && (
                                                            <TouchableOpacity
                                                                onPress={() => removeParticipantFromModal(index)}
                                                                style={{ padding: 8 }}
                                                            >
                                                                <Trash2 color="#444" size={20} />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                );
                                            }

                                            return (
                                                <View
                                                    key={index}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        paddingHorizontal: 16,
                                                        paddingVertical: 10,
                                                        borderRadius: 12,
                                                        marginBottom: 4,
                                                        backgroundColor: '#0a0a0a',
                                                        borderWidth: 1,
                                                        borderColor: isMe ? Colors.primary : (index === modalFocusedIndex ? 'rgba(255, 255, 255, 0.4)' : '#222'),
                                                        borderStyle: 'solid',
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                        <TouchableOpacity
                                                            onPress={() => toggleMe(pName)}
                                                            disabled={(isTaken && !isMe)}
                                                            style={{ padding: 8, marginRight: 5 }}
                                                        >
                                                            <CheckCircle2
                                                                size={20}
                                                                color={isMe ? Colors.primary : (index === modalFocusedIndex ? 'rgba(255, 255, 255, 0.5)' : '#444')}
                                                                style={{ opacity: isMe ? 1 : 0.6 }}
                                                            />
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            ref={el => participantRefs.current[index] = el}
                                                            onPress={() => {
                                                                if (role === 'owner') {
                                                                    startEditingParticipant(index, pName);
                                                                } else if (!isTaken || isMe) {
                                                                    toggleMe(pName);
                                                                }
                                                            }}
                                                            disabled={role !== 'owner' && isTaken && !isMe}
                                                            style={{ flex: 1, paddingVertical: 8 }}
                                                        >
                                                            <Text style={{
                                                                color: isMe ? 'white' : (isTaken ? '#666' : 'white'),
                                                                fontSize: 16,
                                                                fontWeight: isMe ? 'bold' : 'normal',
                                                                flexDirection: 'row',
                                                                alignItems: 'center'
                                                            }}>
                                                                {pName}
                                                                {isMe && <Text style={{ fontSize: 12, color: Colors.primary }}> (ME)</Text>}
                                                                {isTaken && !isMe && <Text style={{ fontSize: 12, color: '#666' }}> ({t('name_input.selected')})</Text>}
                                                                {onlineUsers.find(u => u.name === pName)?.role === 'owner' && (
                                                                    <View style={{
                                                                        backgroundColor: `${Colors.accent}15`,
                                                                        borderColor: Colors.accent,
                                                                        borderWidth: 1,
                                                                        borderRadius: 4,
                                                                        paddingHorizontal: 4,
                                                                        marginLeft: 6,
                                                                        flexDirection: 'row',
                                                                        alignItems: 'center',
                                                                        transform: [{ translateY: 1 }]
                                                                    }}>
                                                                        <Crown color={Colors.accent} size={10} fill={`${Colors.accent}33`} style={{ marginRight: 2 }} />
                                                                        <Text style={{ color: Colors.accent, fontSize: 9, fontWeight: '900' }}>HOST</Text>
                                                                    </View>
                                                                )}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    {role === 'owner' && (
                                                        <TouchableOpacity
                                                            onPress={() => removeParticipantFromModal(index)}
                                                            style={{ padding: 8 }}
                                                        >
                                                            <Trash2 color="#444" size={20} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            );
                                        })
                                    )}
                                </ScrollView>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
                                    <TouchableOpacity
                                        onPress={() => setShowIdentityModal(false)}
                                        style={{
                                            flex: 1,
                                            padding: 15,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: '#444',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ color: '#ccc', fontWeight: 'bold' }}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            if (!mySelectedName && modalFocusedIndex !== null) {
                                                const p = participants[modalFocusedIndex];
                                                const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                                                toggleMe(pName);
                                            }
                                            setShowIdentityModal(false);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: 15,
                                            borderRadius: 12,
                                            backgroundColor: Colors.primary,
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ color: 'black', fontWeight: 'bold' }}>{t('common.confirm')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    <CyberAlert
                        visible={alertConfig.visible}
                        title={alertConfig.title}
                        message={alertConfig.message}
                        onConfirm={() => setAlertConfig({ ...alertConfig, visible: false })}
                    />

                    <CyberAlert
                        visible={showExitConfirm}
                        title={t('common.alert')}
                        message={t('common.exit_confirm')}
                        type="info"
                        confirmText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        onConfirm={async () => {
                            setShowExitConfirm(false);
                            await syncService.clearPresence();
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Welcome' }],
                            });
                        }}
                        onCancel={() => setShowExitConfirm(false)}
                    />

                    {/* Participant Status Modal */}
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
                                padding: 20,
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
                                <ScrollView style={{ maxHeight: 300 }}>
                                    {participants.map((p, index) => {
                                        const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                                        if (!pName.trim()) return null;

                                        const onlineUser = onlineUsers.find(u => u.name === pName);
                                        const userVote = votes.find(v => v.userName === pName || (onlineUser && v.userId === onlineUser.id));
                                        const isMe = mySelectedName === pName;

                                        return (
                                            <View key={`part-${index}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
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
                                                    {onlineUser?.role === 'owner' && (
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
                                                            <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>HOST</Text>
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
                                                        <Text style={{ color: '#444', fontSize: 11, fontWeight: 'bold' }}>{t('common.not_connected') || 'OFFLINE'}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}

                                    {/* Show online users who are not in the participants list (e.g. they joined with a name that was later deleted) */}
                                    {onlineUsers.filter(u => !participants.some(p => (typeof p === 'object' ? p.name : p) === u.name)).map((user, index) => {
                                        return (
                                            <View key={`loose-${index}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', opacity: 0.6 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                    <User size={14} color="#666" style={{ marginRight: 10 }} />
                                                    <Text style={{ color: '#666', fontSize: 14 }}>{user.name || 'Anonymous'}</Text>
                                                    <View style={{ marginLeft: 8, backgroundColor: '#333', paddingHorizontal: 5, borderRadius: 4 }}>
                                                        <Text style={{ color: '#999', fontSize: 9 }}>NOT IN LIST</Text>
                                                    </View>
                                                </View>
                                                <Text style={{ color: '#444', fontSize: 11 }}>GUEST</Text>
                                            </View>
                                        );
                                    })}

                                    {participants.length === 0 && onlineUsers.length === 0 && (
                                        <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>{t('roulette.no_participants').toUpperCase()}</Text>
                                    )}

                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                </View>
            </SafeAreaView>
        </CyberBackground >
    );
}

const styles = StyleSheet.create({});
