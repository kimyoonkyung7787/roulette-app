
import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, Modal, ScrollView, Platform, Alert, StyleSheet, LayoutAnimation, UIManager, Share, Animated } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { NeonText } from '../components/NeonText';
import { UserPlus, Trash2, Play, History, CheckCircle2, ListChecks, Users, X, Loader, LogOut, Crown, Utensils, Coffee, Cookie, User, HelpCircle, Circle, Zap, Target, Home, RotateCw, Guitar, Pencil, Check, Share2, Search, MapPin, Store, Sparkles } from 'lucide-react-native';
import { syncService } from '../services/SyncService';
import { participantService } from '../services/ParticipantService';
import { CyberAlert } from '../components/CyberAlert';
import { CoachMark } from '../components/CoachMark';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { feedbackService } from '../services/FeedbackService';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}



const CATEGORY_OPTIONS = {
    coffee: {
        key: 'temperature',
        options: [
            { label: 'Hot', color: '#ff8c00', icon: '☕' },
            { label: 'Ice', color: '#00bfff', icon: '🧊' },
        ]
    },
};

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
    const [showOptionSheet, setShowOptionSheet] = useState(false);
    const [pendingMenuIndex, setPendingMenuIndex] = useState(null);
    const [editingWeightValue, setEditingWeightValue] = useState('');
    const [mySelectedName, setMySelectedName] = useState(null);
    const [spinning, setSpinning] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [votes, setVotes] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [activeCategory, setActiveCategory] = useState(category);
    const categoryRef = useRef(category);
    const isSwitchingCategoryRef = useRef(false);
    const menuCacheRef = useRef({});
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });
    const [selectedMenuIndex, setSelectedMenuIndex] = useState(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [editingParticipantIndex, setEditingParticipantIndex] = useState(null);
    const [editingParticipantName, setEditingParticipantName] = useState('');
    const [modalFocusedIndex, setModalFocusedIndex] = useState(null);
    const [pendingSelectedName, setPendingSelectedName] = useState(null);
    const [backupParticipants, setBackupParticipants] = useState(null);
    const [backupMySelectedName, setBackupMySelectedName] = useState(null);
    const participantRefs = useRef([]);
    const modalScrollRef = useRef(null);

    const [showCoachMark, setShowCoachMark] = useState(false);
    const shareRef = useRef(null);
    const shareIconRef = useRef(null);
    const identityRef = useRef(null);
    const categoryTabsRef = useRef(null);
    const spinButtonRef = useRef(null);
    const menuListRef = useRef(null);
    const participantInputRef = useRef(null);
    const historyRef = useRef(null);

    const [showRestaurantSearch, setShowRestaurantSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isGeneratingMenu, setIsGeneratingMenu] = useState(false);
    const [generatedMenus, setGeneratedMenus] = useState(null);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);

    const getApiBaseUrl = () => {
        if (Platform.OS === 'web') {
            const origin = window.location.origin;
            // 로컬 개발 시 API는 Vercel 서버리스에만 있으므로 배포 URL 사용
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                return process.env.EXPO_PUBLIC_API_URL || 'https://roulette-app-two.vercel.app';
            }
            return origin;
        }
        return '';
    };

    const searchRestaurant = async () => {
        const q = searchQuery.trim();
        if (!q) return;
        setIsSearching(true);
        setSearchResults([]);
        setSelectedRestaurant(null);
        setGeneratedMenus(null);
        try {
            const resp = await fetch(`${getApiBaseUrl()}/api/search-restaurant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q }),
            });
            const text = await resp.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                console.error('searchRestaurant: API returned non-JSON', text?.slice(0, 200));
                throw new Error(t('name_input.search_error'));
            }
            if (resp.ok && data.items) {
                setSearchResults(data.items);
            } else {
                setAlertConfig({ visible: true, title: t('common.error'), message: t('name_input.search_error') });
            }
        } catch (err) {
            console.error('searchRestaurant error:', err);
            setAlertConfig({ visible: true, title: t('common.error'), message: t('name_input.search_error') });
        } finally {
            setIsSearching(false);
        }
    };

    const generateMenuForRestaurant = async (restaurant) => {
        setSelectedRestaurant(restaurant);
        setIsGeneratingMenu(true);
        setGeneratedMenus(null);
        try {
            const resp = await fetch(`${getApiBaseUrl()}/api/generate-menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantName: restaurant.title,
                    category: activeCategory,
                    address: restaurant.roadAddress || restaurant.address,
                }),
            });
            const data = await resp.json();
            if (resp.ok && data.menus) {
                setGeneratedMenus(data.menus);
            } else {
                setAlertConfig({ visible: true, title: t('common.error'), message: t('name_input.menu_gen_error') });
            }
        } catch (err) {
            console.error('generateMenu error:', err);
            setAlertConfig({ visible: true, title: t('common.error'), message: t('name_input.menu_gen_error') });
        } finally {
            setIsGeneratingMenu(false);
        }
    };

    const applyGeneratedMenus = async () => {
        if (!generatedMenus || generatedMenus.length === 0) return;
        const newItems = generatedMenus.map(name => ({ name }));
        setMenuItems(newItems);
        if (role === 'owner') {
            await syncService.setMenuByCategory(activeCategory, newItems);
            await syncService.setMenuItems(newItems);
        }
        setShowRestaurantSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedRestaurant(null);
        setGeneratedMenus(null);
        try { feedbackService.playClick(); } catch (e) { }
    };

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
        // Firebase sync deferred to modal confirm
        setEditingParticipantIndex(null);
        setEditingParticipantName('');
    };

    useEffect(() => {
        categoryRef.current = activeCategory;
    }, [activeCategory]);
    const [remoteSpinState, setRemoteSpinState] = useState(null);
    const [roomPhase, setRoomPhaseState] = useState('waiting');
    const [finalResults, setFinalResults] = useState(null);
    const [hostName, setHostName] = useState(null);
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
                    }

                    // Standardize and filter out completely empty entries if they somehow exist
                    let sanitizedParticipants = savedParticipants.filter(p => {
                        const n = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                        return n.trim() !== '';
                    }).map(p => {
                        const name = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                        const weight = typeof p === 'object' ? (p.weight || 1) : 1;
                        return { name: name.trim(), weight };
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
                                if (role === 'owner') await syncService.setHostName(firstGuestName);
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

                        if (!existing || !Array.isArray(existing) || existing.length === 0) {
                            console.log(`NameInputScreen: Initializing default items for ${cat}`);
                            const translatedPopular = t(`popular_items.${cat}`, { returnObjects: true });
                            const popular = Array.isArray(translatedPopular) ? translatedPopular : [];

                            const defaultMenus = popular.length > 0
                                ? popular.map(name => ({ name }))
                                : [{ name: `${t('common.item') || 'Item'} 1` }, { name: `${t('common.item') || 'Item'} 2` }];

                            await syncService.setMenuByCategory(cat, defaultMenus);
                            menuCacheRef.current[cat] = defaultMenus;

                            if (cat === initialCat) {
                                console.log(`NameInputScreen: Setting initial state for ${cat}`);
                                setMenuItems(defaultMenus);
                            }
                        } else {
                            menuCacheRef.current[cat] = existing;
                            if (cat === initialCat) {
                                console.log(`NameInputScreen: Loading existing data for initial category ${cat}`);
                                setMenuItems(existing);
                            }
                        }
                    }

                    await syncService.clearSpinState();
                    await syncService.clearVotes();
                    await syncService.clearFinalResults();
                } else {
                    console.log('NameInputScreen: Owner returning to re-vote, skipping room reset');
                    const currentParticipants = await syncService.getParticipants();
                    if (currentParticipants) setParticipants(currentParticipants);

                    const currentCat = await syncService.getRoomCategory() || 'coffee';
                    setActiveCategory(currentCat);
                    categoryRef.current = currentCat;

                    // Load ALL categories into cache, then set current
                    const cats = ['coffee', 'meal', 'snack', 'etc'];
                    for (const cat of cats) {
                        const catMenus = await syncService.getMenuByCategory(cat);
                        if (catMenus && catMenus.length > 0) {
                            menuCacheRef.current[cat] = catMenus;
                        }
                    }

                    const currentMenus = menuCacheRef.current[currentCat];
                    if (currentMenus && currentMenus.length > 0) {
                        setMenuItems(currentMenus);
                    } else {
                        const fallback = await syncService.getMenuItems();
                        if (fallback) setMenuItems(fallback);
                    }
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

            // Subscribe to room host name
            unsubs.push(syncService.subscribeToHostName(name => {
                if (name) setHostName(name);
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

    const getOnboardingKey = () => {
        const modeKey = activeTab === 'menu' ? 'menu' : 'people';
        const roleKey = role === 'owner' ? 'owner' : 'participant';
        return `onboarding_${modeKey}_${roleKey}_done`;
    };

    useEffect(() => {
        if (!isLoaded) return;
        const checkOnboarding = async () => {
            const key = getOnboardingKey();
            try {
                const countStr = await AsyncStorage.getItem(key);
                const count = countStr ? parseInt(countStr, 10) : 0;
                if (count < 3) {
                    setTimeout(() => setShowCoachMark(true), 800);
                }
            } catch (e) { /* ignore */ }
        };
        checkOnboarding();
    }, [isLoaded, mode, activeTab]);

    const handleOnboardingComplete = async () => {
        setShowCoachMark(false);
        const key = getOnboardingKey();
        try {
            const countStr = await AsyncStorage.getItem(key);
            const count = countStr ? parseInt(countStr, 10) : 0;
            await AsyncStorage.setItem(key, String(count + 1));
        } catch (e) { /* ignore */ }
    };

    const getCoachMarkSteps = () => {
        const historyStep = { ref: historyRef, title: t('onboarding.history_step_title'), message: t('onboarding.history_step_msg'), icon: t('onboarding.history_step_icon') };

        if (activeTab === 'menu') {
            if (role === 'owner') {
                return [
                    { ref: identityRef, title: t('onboarding.owner_step1_title'), message: t('onboarding.owner_step1_msg'), icon: t('onboarding.owner_step1_icon') },
                    { ref: shareRef, arrowRef: shareIconRef, title: t('onboarding.owner_step2_title'), message: t('onboarding.owner_step2_msg'), icon: t('onboarding.owner_step2_icon') },
                    { ref: categoryTabsRef, title: t('onboarding.owner_step3_title'), message: t('onboarding.owner_step3_msg'), icon: t('onboarding.owner_step3_icon') },
                    { ref: menuListRef, title: t('onboarding.owner_step4_title'), message: t('onboarding.owner_step4_msg'), icon: t('onboarding.owner_step4_icon') },
                    historyStep,
                ];
            }
            return [
                { ref: identityRef, title: t('onboarding.participant_step1_title'), message: t('onboarding.participant_step1_msg'), icon: t('onboarding.participant_step1_icon') },
                { ref: menuListRef, title: t('onboarding.participant_step2_title'), message: t('onboarding.participant_step2_msg'), icon: t('onboarding.participant_step2_icon') },
                { ref: spinButtonRef, title: t('onboarding.participant_step3_title'), message: t('onboarding.participant_step3_msg'), icon: t('onboarding.participant_step3_icon') },
            ];
        }
        if (role === 'owner') {
            const steps = [
                { ref: participantInputRef, title: t('onboarding.people_owner_step1_title'), message: t('onboarding.people_owner_step1_msg'), icon: t('onboarding.people_owner_step1_icon') },
            ];
            if (mode === 'online') {
                steps.push({ ref: shareRef, arrowRef: shareIconRef, title: t('onboarding.people_owner_step2_title'), message: t('onboarding.people_owner_step2_msg'), icon: t('onboarding.people_owner_step2_icon') });
            }
            steps.push({ ref: spinButtonRef, title: t('onboarding.people_owner_step3_title'), message: t('onboarding.people_owner_step3_msg'), icon: t('onboarding.people_owner_step3_icon') });
            steps.push(historyStep);
            return steps;
        }
        return [
            { ref: menuListRef, title: t('onboarding.people_participant_step1_title'), message: t('onboarding.people_participant_step1_msg'), icon: t('onboarding.people_participant_step1_icon') },
            { ref: spinButtonRef, title: t('onboarding.people_participant_step2_title'), message: t('onboarding.people_participant_step2_msg'), icon: t('onboarding.people_participant_step2_icon') },
        ];
    };

    // Effect to identify the first available participant when the identity modal opens
    useEffect(() => {
        if (showIdentityModal) {
            // Backup current state for cancel restoration
            if (backupParticipants === null) {
                setBackupParticipants(JSON.parse(JSON.stringify(participants)));
                setBackupMySelectedName(mySelectedName);
            }
            setPendingSelectedName(mySelectedName);
            // Guard: Wait for host to avoid focusing on host's slot during sync delay
            // This prevents the participant from auto-focusing on the host's name (usually index 0)
            const hostUser = onlineUsers.find(u => u.role === 'owner');
            if (role === 'participant' && !hostUser && onlineUsers.length > 0) {
                setModalFocusedIndex(null);
                return;
            }

            // Priority 1: Find MY currently selected participant
            let index = -1;
            if (mySelectedName) {
                index = participants.findIndex(p => {
                    const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                    return mySelectedName === pName.trim();
                });
            }

            // Priority 2: Find first NOT taken participant
            if (index === -1) {
                index = participants.findIndex(p => {
                    const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                    const pNameTrimmed = pName.trim();
                    if (!pNameTrimmed) return false;
                    const otherUserWithName = onlineUsers.find(u => u.name === pNameTrimmed && u.id !== syncService.myId);
                    const isTaken = !!otherUserWithName;
                    return !isTaken;
                });
            }

            const finalIndex = index !== -1 ? index : null;
            setModalFocusedIndex(finalIndex);

            // Auto-select pending if no current selection
            if (!mySelectedName && finalIndex !== null) {
                const autoP = participants[finalIndex];
                const autoName = typeof autoP === 'object' ? (autoP.name || autoP.text || '') : String(autoP);
                setPendingSelectedName(autoName.trim());
            }

            // Scroll to focused item after render
            if (finalIndex !== null) {
                setTimeout(() => {
                    participantRefs.current[finalIndex]?.measureLayout?.(
                        modalScrollRef.current,
                        (x, y) => {
                            modalScrollRef.current?.scrollTo?.({ y: Math.max(0, y - 20), animated: true });
                        },
                        () => {}
                    );
                }, 300);
            }
        } else {
            setModalFocusedIndex(null);
            setPendingSelectedName(null);
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
            const resultScreen = (mode === 'online' && finalResults.type === 'menu') ? 'MenuResult' : 'Result';
            navigation.navigate(resultScreen, {
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
        // Do not recover when presence with myId is the host (same device, different tab): treat as new participant and auto-select
        const isRecoveryValid = meInRoom && meInRoom.name && !(role === 'participant' && meInRoom.role === 'owner');
        if (isRecoveryValid) {
            if (mySelectedName !== meInRoom.name) {
                console.log(`NameInputScreen: Recovering previous selection: ${meInRoom.name}`);
                setMySelectedName(meInRoom.name);
            }
            return; // Already has a selection, so done
        }

        // 2. AUTO-SELECT: If no selection, pick the first available slot (excluding host)
        // Guard: Wait for host information to avoid race conditions where onlineUsers is empty
        const hostUser = onlineUsers.find(u => u.role === 'owner');
        const guardOk = !mySelectedName && participants.length > 0 && (role !== 'participant' || hostUser);
        if (!guardOk) return;

        const sameIdEntry = onlineUsers.find(u => u.id === syncService.myId);
        const firstAvailable = participants.find(p => {
            const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
            const pNameTrimmed = pName.trim();
            if (!pNameTrimmed) return false;

            // Taken by another user (different id)
            const otherUserWithName = onlineUsers.find(u => u.name === pNameTrimmed && u.id !== syncService.myId);
            // Same myId but host (other tab on same device): treat slot as taken so we don't pick host's name
            const isTakenByOtherTab = sameIdEntry?.role === 'owner' && sameIdEntry?.name === pNameTrimmed;
            const isTaken = !!otherUserWithName || !!isTakenByOtherTab;
            const isHostName = otherUserWithName?.role === 'owner' || (sameIdEntry?.role === 'owner' && sameIdEntry?.name === pNameTrimmed);

            return !isTaken && !isHostName;
        });

        if (firstAvailable) {
            const nameToSelect = typeof firstAvailable === 'object' ? (firstAvailable.name || firstAvailable.text) : firstAvailable;
            console.log(`NameInputScreen: Auto-selecting first available slot: ${nameToSelect}`);
            // Use toggleMe to set state and sync to DB
            toggleMe(nameToSelect);
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
        if (role === 'owner' && isLoaded && menuItems.length > 0 && !isSwitchingCategoryRef.current) {
            const cat = categoryRef.current;
            console.log(`NameInputScreen: Syncing ${cat} menu to DB...`, menuItems.length);
            menuCacheRef.current[cat] = menuItems;
            syncService.setMenuByCategory(cat, menuItems);
        }
    }, [menuItems, role, isLoaded]);

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
            const { type, list, participants: restoredParticipants } = route.params.restoredData;
            console.log(`NameInputScreen: Restoring ${type} from history... (current mode: ${mode})`);

            if (type === 'people') {
                // Normalize list: handle both {name} and {text} formats from history
                const normalizedList = list.map(p => {
                    const itemName = typeof p === 'object' ? (p.name || p.text || '') : p;
                    return { name: itemName, weight: p.weight ?? 1 };
                });
                setParticipants(normalizedList);
                syncService.setParticipants(normalizedList);
                // Don't force tab switch - stay on current tab
                // This allows "뭐 먹지?" mode to import participants from "누가 쏠까?" history
            } else {
                // Restore menu items
                const normalizedList = list.map(m => {
                    const itemName = typeof m === 'object' ? (m.name || m.text || m) : m;
                    return { name: itemName };
                });
                setMenuItems(normalizedList);
                syncService.setMenuItems(normalizedList);

                // Also restore participants from the voting details (if available)
                if (restoredParticipants && restoredParticipants.length > 0) {
                    console.log(`NameInputScreen: Also restoring ${restoredParticipants.length} participants from menu history`);
                    setParticipants(restoredParticipants);
                    syncService.setParticipants(restoredParticipants);
                }
                // Don't force tab switch - stay on current tab
            }

            // Clear the param so it doesn't trigger again on re-focus
            navigation.setParams({ restoredData: null });
        }
    }, [route.params?.restoredData]);

    const handleCategoryChange = async (newCat) => {
        if (role !== 'owner') return;
        if (isSwitchingCategoryRef.current) return;

        const currentCat = categoryRef.current;
        if (currentCat !== newCat) {
            isSwitchingCategoryRef.current = true;
            console.log(`NameInputScreen: Category switching from ${currentCat} to ${newCat}`);

            try {
                // 1. Save current items to local cache AND Firebase
                menuCacheRef.current[currentCat] = [...menuItems];
                syncService.setMenuByCategory(currentCat, menuItems);

                // 2. Clear state that should be reset
                setSelectedMenuIndex(null);

                // 3. Update category ref + state + Firebase
                categoryRef.current = newCat;
                setActiveCategory(newCat);
                syncService.setRoomCategory(newCat);

                // 4. Load new category items from LOCAL CACHE first (instant, no race condition)
                const cached = menuCacheRef.current[newCat];
                if (cached && cached.length > 0) {
                    console.log(`NameInputScreen: Loaded menu for ${newCat} from cache (${cached.length} items)`);
                    setMenuItems([...cached]);
                } else {
                    // Fallback: try Firebase, then i18n defaults
                    const savedMenus = await syncService.getMenuByCategory(newCat);
                    if (savedMenus && savedMenus.length > 0) {
                        console.log(`NameInputScreen: Loaded saved menu for ${newCat} from Firebase`);
                        menuCacheRef.current[newCat] = savedMenus;
                        setMenuItems(savedMenus);
                    } else {
                        console.log(`NameInputScreen: Loading defaults for ${newCat}`);
                        const translatedPopular = t(`popular_items.${newCat}`, { returnObjects: true });
                        const popular = Array.isArray(translatedPopular) ? translatedPopular : [];
                        const newItems = popular.length > 0 ? popular.map(name => ({ name })) : [{ name: `${t('common.item') || 'Item'} 1` }];
                        menuCacheRef.current[newCat] = newItems;
                        setMenuItems(newItems);
                    }
                }

                if (Platform.OS !== 'web') {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                }
            } finally {
                isSwitchingCategoryRef.current = false;
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

        setName(''); // Clear input
        try { feedbackService.playClick(); } catch (e) { }
    };

    // Dedicated function for Modal to ensure it always adds to PEOPLE list regardless of activeTab
    const addParticipantFromModal = () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        // Force add to participants list (local only, sync deferred to confirm)
        const updated = [...participants, { name: trimmedName, weight: 1 }];
        setParticipants(updated);

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

    // Dedicated removal for Modal (local only, sync deferred to confirm)
    const removeParticipantFromModal = (index) => {
        const removedItem = participants[index];
        if (removedItem && removedItem.name === mySelectedName) setMySelectedName(null);

        const updated = participants.filter((_, i) => i !== index);
        setParticipants(updated);
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
        if (!participantName || participantName.toString().trim() === '') return;
        const nameToUse = participantName.toString().trim();

        // Check if taken by other (Host or other participants)
        // Note: Identity selection should be exclusive regardless of activeTab
        const otherUserWithName = onlineUsers.find(u => u.name === nameToUse && u.id !== syncService.myId);
        const isTaken = !!otherUserWithName;

        if (mySelectedName === nameToUse) {
            setMySelectedName(null);
            await syncService.setIdentity('');
        } else if (!isTaken) {
            setMySelectedName(nameToUse);
            await syncService.setIdentity(nameToUse);
            if (role === 'owner') {
                await syncService.setHostName(nameToUse);
                setHostName(nameToUse);
            }
        } else {
            // Check if it's specifically the host
            const isHost = otherUserWithName?.role === 'owner';
            Alert.alert(
                t('common.alert'),
                isHost ? t('name_input.host_selected') || 'Host has chosen this.' : t('name_input.already_taken')
            );
        }
    };

    const handleOptionSelect = (optionLabel) => {
        if (pendingMenuIndex === null) return;
        const menuItem = menuItems[pendingMenuIndex];
        const baseName = typeof menuItem === 'object' ? (menuItem.name || '') : String(menuItem);
        const voteName = `${baseName}(${optionLabel})`;

        setSelectedMenuIndex(pendingMenuIndex);
        setShowOptionSheet(false);
        setPendingMenuIndex(null);

        if (!mySelectedName) {
            setAlertConfig({
                visible: true,
                title: t('common.alert'),
                message: t('name_input.please_select_name')
            });
            return;
        }

        const submitWithOption = async () => {
            if (role === 'owner') {
                const isGameAlreadyActive = roomPhase === 'roulette' || (votes && votes.length > 0);
                if (isGameAlreadyActive) {
                    await syncService.submitVote(voteName);
                    navigation.navigate('Roulette', {
                        participants, menuItems, mySelectedName, roomId, mode, role,
                        category: activeCategory, votedItem: voteName, spinTarget: 'menu'
                    });
                } else {
                    await syncService.setSpinTarget('menu');
                    await syncService.setRoomPhase('roulette');
                    await syncService.clearVotes();
                    await syncService.clearSpinState();
                    await syncService.clearFinalResults();
                    await syncService.submitVote(voteName);
                    const finalHostName = hostName || onlineUsers.find(u => u.role === 'owner')?.name || (role === 'owner' ? mySelectedName : null);
                    navigation.navigate('Roulette', {
                        participants, menuItems, mySelectedName, roomId, mode, role,
                        category: activeCategory, votedItem: voteName, spinTarget: 'menu', hostName: finalHostName
                    });
                }
            } else {
                const isGameActive = roomPhase === 'roulette' || votes.length > 0 || remoteSpinState?.isSpinning;
                if (!isGameActive) {
                    setAlertConfig({ visible: true, title: t('common.alert'), message: t('name_input.wait_for_host') });
                    return;
                }
                await syncService.submitVote(voteName);
                const finalHostName = hostName || onlineUsers.find(u => u.role === 'owner')?.name || null;
                navigation.navigate('Roulette', {
                    participants, menuItems, mySelectedName, roomId, mode, role,
                    category: activeCategory, votedItem: voteName, spinTarget: 'menu', hostName: finalHostName
                });
            }
        };

        submitWithOption().catch(e => console.error('Option vote failed:', e));
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
                    const finalHostName = hostName || onlineUsers.find(u => u.role === 'owner')?.name || (role === 'owner' ? mySelectedName : (roomId.length <= 8 ? roomId : null));

                    navigation.navigate('Roulette', {
                        participants,
                        menuItems,
                        mySelectedName,
                        roomId,
                        mode,
                        role,
                        category: activeCategory,
                        votedItem: winner,
                        spinTarget: 'menu',
                        hostName: finalHostName
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

            const finalHostName = hostName || onlineUsers.find(u => u.role === 'owner')?.name || (role === 'owner' ? mySelectedName : (roomId.length <= 8 ? roomId : null));

            navigation.navigate('Roulette', {
                participants,
                menuItems,
                mySelectedName,
                roomId,
                mode,
                role,
                category: activeCategory,
                votedItem: winner,
                spinTarget: 'menu',
                hostName: finalHostName
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
            let totalWeight = 0;
            for (let i = 0; i < participants.length; i++) {
                totalWeight += (participants[i].weight || 0);
            }
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

            const finalHostName = hostName || onlineUsers.find(u => u.role === 'owner')?.name || (role === 'owner' ? mySelectedName : (roomId.length <= 8 ? roomId : null));

            navigation.navigate('Roulette', {
                participants,
                menuItems,
                mySelectedName,
                roomId,
                mode,
                role,
                category: activeCategory,
                spinTarget: target, // Explicitly pass the target mode
                autoStartSpin: true,
                hostName: finalHostName
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

            const finalHostName = hostName || onlineUsers.find(u => u.role === 'owner')?.name || (role === 'owner' ? mySelectedName : (roomId.length <= 8 ? roomId : null));

            navigation.navigate('Roulette', {
                participants,
                menuItems,
                mySelectedName,
                roomId,
                mode,
                role,
                category: activeCategory,
                spinTarget: target,
                autoStartSpin: true,
                hostName: finalHostName
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
            const inviteUrl = `https://roulette-app-two.vercel.app/?roomId=${roomId}`;
            const displayName = mySelectedName || syncService.myName || t('common.host') || 'Host';
            const message = t('common.invite_message', {
                name: displayName,
                roomId: roomId.toUpperCase(),
                url: inviteUrl
            });
            const title = t('common.invite_title');

            // 1. Web Share API (Mobile Browsers) - Focus on Text & URL
            // We don't send the image as a 'file' because it often hides the text content
            // Instead, the OG tags we set will show the image automatically in the link preview
            if (Platform.OS === 'web' && navigator.share) {
                try {
                    await navigator.share({
                        title,
                        text: `${message}`, // Keep full message
                        url: inviteUrl
                    });
                    return;
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') return;
                    console.log('Web share failed, falling back to clipboard');
                }
            }

            // 2. Native Share (React Native / Expo)
            if (Platform.OS !== 'web') {
                await Share.share({
                    message,
                    url: inviteUrl,
                    title
                });
                return;
            }

            // 3. Final fallback: copy to clipboard
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(message);
                Alert.alert(t('common.info'), t('common.link_copied'));
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    let totalParticipantsWeight = 0;
    for (let i = 0; i < participants.length; i++) {
        totalParticipantsWeight += (participants[i].weight || 0);
    }

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

                        <View ref={shareRef} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            {mode === 'online' && role === 'owner' && (
                                <TouchableOpacity ref={shareIconRef} onPress={handleShare} style={{ padding: 4 }}>
                                    <Share2 color={Colors.accent} size={24} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 4 }}>
                                <ListChecks color={Colors.success} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity ref={historyRef} onPress={() => navigation.navigate('History', { role, roomId, mode, category: activeCategory, activeTab })} style={{ padding: 4 }}>
                                <History color={Colors.primary} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowCoachMark(true)} style={{ padding: 4 }}>
                                <HelpCircle color="rgba(255,255,255,0.45)" size={22} />
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                                        <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>{t('common.host').toUpperCase()}</Text>
                                    </View>
                                ) : (
                                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', marginRight: 10 }}>
                                        <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>{t('common.participant').toUpperCase()}</Text>
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

                            {activeTab === 'menu' && role === 'owner' && (activeCategory === 'meal' || activeCategory === 'snack') && i18n.language === 'ko' && (() => {
                                const aiBtnColor = activeCategory === 'meal' ? Colors.success : Colors.accent;
                                return (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setShowRestaurantSearch(true);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                            setSelectedRestaurant(null);
                                            setGeneratedMenus(null);
                                        }}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: `${aiBtnColor}15`,
                                            borderWidth: 1.5,
                                            borderColor: aiBtnColor,
                                            borderRadius: 6,
                                            paddingVertical: 3,
                                            paddingHorizontal: 10,
                                        }}
                                    >
                                        <Store color={aiBtnColor} size={12} style={{ marginRight: 5 }} />
                                        <Text style={{ color: aiBtnColor, fontSize: 10, fontWeight: '900' }}>
                                            AI 메뉴
                                        </Text>
                                    </TouchableOpacity>
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
                                ref={identityRef}
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
                        <View ref={categoryTabsRef} style={{ flexDirection: 'row', marginBottom: 20, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
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
                        </View>
                    )}

                    {role === 'owner' && (
                        <View ref={participantInputRef} style={{ flexDirection: 'column', marginBottom: 25 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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



                        </View>
                    )}

                    <View ref={menuListRef} style={{ flex: 1 }}>
                    <FlatList
                        data={activeTab === 'people' ? participants : menuItems}
                        extraData={activeCategory}
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
                                let totalWeightSum = 0;
                                for (let i = 0; i < participants.length; i++) {
                                    totalWeightSum += (participants[i].weight || 0);
                                }
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
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 12,
                                    marginBottom: 4,
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
                                                onPress={() => {
                                                    const catOpts = CATEGORY_OPTIONS[activeCategory];
                                                    if (catOpts) {
                                                        setPendingMenuIndex(index);
                                                        setShowOptionSheet(true);
                                                        try { feedbackService.playClick(); } catch (e) { }
                                                    } else {
                                                        setSelectedMenuIndex(index);
                                                    }
                                                }}
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
                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                                            >
                                                <Text style={{
                                                    color: !hasName ? 'rgba(255,255,255,0.2)' : ((isTakenByOther && !isMe) ? Colors.textSecondary : 'white'),
                                                    fontSize: 16,
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
                                                    height: 36,
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
                                        {t('name_input.total_ratio').toUpperCase()}: <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>{totalParticipantsWeight}</Text>
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                    </View>



                    {/* Bottom Action Button */}
                    <View ref={spinButtonRef} style={{ paddingTop: 0 }}>
                        {activeTab === 'menu' ? (
                            <View style={{ alignItems: 'center' }}>
                                {selectedMenuIndex !== null ? (
                                    <>
                                        {/* Item selected → Main "Go with this" button */}
                                        <TouchableOpacity
                                            onPress={handleDirectPick}
                                            style={{
                                            width: '100%',
                                            backgroundColor: `${activeMenuColor}15`,
                                            paddingVertical: 10,
                                            borderRadius: 16,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 1.5,
                                            borderColor: activeMenuColor
                                            }}
                                        >
                                            <CheckCircle2 color={activeMenuColor} size={22} strokeWidth={2.5} />
                                            <Text style={{
                                                color: activeMenuColor,
                                                fontSize: 18,
                                                fontWeight: '900',
                                                letterSpacing: 1,
                                                marginLeft: 8
                                            }}>{t('name_input.go_with_this').toUpperCase()}</Text>
                                        </TouchableOpacity>

                                        {/* Secondary text link: "or spin the roulette" */}
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedMenuIndex(null);
                                                if (checkIdentityBeforeAction()) {
                                                    startRoulette('menu');
                                                }
                                            }}
                                            style={{ marginTop: 12, paddingVertical: 6, paddingHorizontal: 16 }}
                                        >
                                            <Text style={{
                                                color: 'rgba(255,255,255,0.4)',
                                                fontSize: 13,
                                                fontWeight: '500',
                                                textDecorationLine: 'underline'
                                            }}>
                                                🎲 {t('name_input.or_spin')}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    /* No item selected → Spin button only */
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (checkIdentityBeforeAction()) {
                                                startRoulette('menu');
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            backgroundColor: 'transparent',
                                            paddingVertical: 10,
                                            borderRadius: 16,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 1.5,
                                            borderColor: activeMenuColor
                                        }}
                                    >
                                        <RotateCw color={activeMenuColor} size={22} />
                                        <Text style={{
                                            color: activeMenuColor,
                                            fontSize: 18,
                                            fontWeight: '900',
                                            letterSpacing: 2,
                                            marginLeft: 8
                                        }}>{t('name_input.what').toUpperCase()}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    if (checkIdentityBeforeAction()) {
                                        startRoulette(activeTab);
                                    }
                                }}
                                style={{
                                    backgroundColor: 'transparent',
                                    paddingVertical: 10,
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1.5,
                                    borderColor: Colors.primary
                                }}
                            >
                                <RotateCw color={Colors.primary} size={22} />
                                <Text style={{
                                    color: Colors.primary,
                                    fontSize: 18,
                                    fontWeight: '900',
                                    letterSpacing: 2,
                                    marginLeft: 8
                                }}>{t('name_input.what').toUpperCase()}</Text>
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
                                            <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900' }}>{t('common.host').toUpperCase()}</Text>
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
                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: 'bold' }}>{t('common.participant').toUpperCase()}</Text>
                                        </View>
                                    )}
                                    <NeonText style={{ fontSize: 24, color: Colors.primary }}>{t('name_input.participants').toUpperCase()}</NeonText>
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

                                <ScrollView ref={modalScrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                    {participants.length === 0 ? (
                                        <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>
                                            {t('name_input.please_add_participants')}
                                        </Text>
                                    ) : (
                                        participants.map((p, index) => {
                                            const pName = typeof p === 'object' ? (p.name || p.text || '') : String(p);
                                            const isTaken = onlineUsers.some(u => u.name === pName && u.id !== syncService.myId);
                                            const isMe = mySelectedName === pName;
                                            const isPendingMe = pendingSelectedName === pName;
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
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 4,
                                                            borderRadius: 12,
                                                            marginBottom: 3,
                                                            backgroundColor: '#222',
                                                            borderWidth: 1,
                                                            borderColor: Colors.primary,
                                                        }}
                                                    >
                                                        <View style={{ padding: 4, marginRight: 5 }}>
                                                            <CheckCircle2
                                                                size={18}
                                                                color={isPendingMe ? Colors.primary : '#444'}
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
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 6,
                                                        borderRadius: 12,
                                                        marginBottom: 3,
                                                        backgroundColor: '#0a0a0a',
                                                        borderWidth: 1,
                                                        borderColor: isPendingMe ? Colors.primary : ((!isTaken || isMe) ? 'rgba(255, 255, 255, 0.4)' : '#222'),
                                                        borderStyle: 'solid',
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                if (!isTaken || isMe) {
                                                                    setPendingSelectedName(pName);
                                                                }
                                                            }}
                                                            disabled={(isTaken && !isMe)}
                                                            style={{ padding: 4, marginRight: 5 }}
                                                        >
                                                            <CheckCircle2
                                                                size={18}
                                                                color={isPendingMe ? Colors.primary : (index === modalFocusedIndex ? 'rgba(255, 255, 255, 0.5)' : '#444')}
                                                                style={{ opacity: isPendingMe ? 1 : 0.6 }}
                                                            />
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            ref={el => participantRefs.current[index] = el}
                                                            onPress={() => {
                                                                if (role === 'owner') {
                                                                    startEditingParticipant(index, pName);
                                                                } else if (!isTaken || isMe) {
                                                                    setPendingSelectedName(pName);
                                                                }
                                                            }}
                                                            disabled={role !== 'owner' && isTaken && !isMe}
                                                            style={{ flex: 1, paddingVertical: 3 }}
                                                        >
                                                            <Text style={{
                                                                color: isPendingMe ? 'white' : (isTaken && !isMe ? '#666' : 'white'),
                                                                fontSize: 15,
                                                                fontWeight: isPendingMe ? 'bold' : 'normal',
                                                                flexDirection: 'row',
                                                                alignItems: 'center'
                                                            }}>
                                                                {pName}
                                                                {isMe && <Text style={{ fontSize: 12, color: Colors.primary }}> {t('common.me')}</Text>}
                                                                {isTaken && !isMe && <Text style={{ fontSize: 12, color: '#666' }}> ({t('name_input.selected')})</Text>}
                                                                {(pName === hostName || onlineUsers.find(u => u.name === pName)?.role === 'owner') && (
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
                                                                        <Text style={{ color: Colors.accent, fontSize: 9, fontWeight: '900' }}>{t('common.host').toUpperCase()}</Text>
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
                                        onPress={() => {
                                            // Cancel: restore backup
                                            if (backupParticipants !== null) {
                                                setParticipants(backupParticipants);
                                                setMySelectedName(backupMySelectedName);
                                                setBackupParticipants(null);
                                                setBackupMySelectedName(null);
                                            }
                                            setShowIdentityModal(false);
                                        }}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            paddingHorizontal: 15,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: '#444',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ color: '#ccc', fontWeight: 'bold' }}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (pendingSelectedName !== mySelectedName) {
                                                toggleMe(pendingSelectedName);
                                            }
                                            // Confirm: sync changes to Firebase
                                            if (role === 'owner') {
                                                await syncService.setParticipants(participants);
                                            }
                                            setBackupParticipants(null);
                                            setBackupMySelectedName(null);
                                            setShowIdentityModal(false);
                                        }}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            paddingHorizontal: 15,
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

                    {/* Restaurant Search Modal */}
                    <Modal
                        visible={showRestaurantSearch}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setShowRestaurantSearch(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                            <View style={{
                                width: '100%',
                                maxWidth: 420,
                                maxHeight: '85%',
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Store color={Colors.primary} size={20} style={{ marginRight: 8 }} />
                                        <NeonText style={{ fontSize: 18 }}>{t('name_input.search_restaurant')}</NeonText>
                                    </View>
                                    <TouchableOpacity onPress={() => setShowRestaurantSearch(false)}>
                                        <X color={Colors.text} size={24} />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginRight: 10, overflow: 'hidden' }}>
                                        <TextInput
                                            style={{ color: 'white', padding: 14, fontSize: 15 }}
                                            placeholder={t('name_input.search_placeholder')}
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                            onSubmitEditing={searchRestaurant}
                                            autoFocus={true}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={searchRestaurant}
                                        disabled={isSearching || !searchQuery.trim()}
                                        style={{
                                            backgroundColor: isSearching || !searchQuery.trim() ? 'rgba(255,255,255,0.1)' : Colors.primary,
                                            padding: 14,
                                            borderRadius: 12,
                                            opacity: isSearching || !searchQuery.trim() ? 0.4 : 1,
                                        }}
                                    >
                                        <Search color={isSearching || !searchQuery.trim() ? Colors.textSecondary : 'black'} size={22} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                                    {isSearching && (
                                        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                                            <Loader color={Colors.primary} size={24} />
                                            <Text style={{ color: Colors.textSecondary, marginTop: 10, fontSize: 13 }}>{t('name_input.searching')}</Text>
                                        </View>
                                    )}

                                    {!isSearching && searchResults.length > 0 && !selectedRestaurant && (
                                        <View style={{ gap: 8 }}>
                                            {searchResults.map((item, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    onPress={() => generateMenuForRestaurant(item)}
                                                    activeOpacity={0.7}
                                                    style={{
                                                        backgroundColor: 'rgba(255,255,255,0.04)',
                                                        borderRadius: 14,
                                                        padding: 14,
                                                        borderWidth: 1,
                                                        borderColor: 'rgba(255,255,255,0.08)',
                                                    }}
                                                >
                                                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>{item.title}</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                                                        <MapPin color={Colors.textSecondary} size={12} style={{ marginRight: 4 }} />
                                                        <Text style={{ color: Colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                                                            {item.roadAddress || item.address}
                                                        </Text>
                                                    </View>
                                                    {item.category && (
                                                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{item.category}</Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {!isSearching && searchResults.length === 0 && searchQuery.trim().length > 0 && !isGeneratingMenu && (
                                        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                                            <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>{t('name_input.no_results')}</Text>
                                        </View>
                                    )}

                                    {selectedRestaurant && (
                                        <View>
                                            <View style={{
                                                backgroundColor: `${Colors.primary}10`,
                                                borderRadius: 14,
                                                padding: 14,
                                                borderWidth: 1,
                                                borderColor: `${Colors.primary}30`,
                                                marginBottom: 16,
                                            }}>
                                                <Text style={{ color: Colors.primary, fontSize: 15, fontWeight: '900' }}>{selectedRestaurant.title}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <MapPin color={Colors.textSecondary} size={12} style={{ marginRight: 4 }} />
                                                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                                                        {selectedRestaurant.roadAddress || selectedRestaurant.address}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => { setSelectedRestaurant(null); setGeneratedMenus(null); }}
                                                    style={{ position: 'absolute', top: 10, right: 10 }}
                                                >
                                                    <X color={Colors.textSecondary} size={16} />
                                                </TouchableOpacity>
                                            </View>

                                            {isGeneratingMenu && (
                                                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                                    <Sparkles color={Colors.accent} size={28} />
                                                    <Text style={{ color: Colors.accent, marginTop: 10, fontSize: 14, fontWeight: '700' }}>
                                                        {t('name_input.generating_menu')}
                                                    </Text>
                                                </View>
                                            )}

                                            {generatedMenus && generatedMenus.length > 0 && (
                                                <View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                                        <Sparkles color={Colors.accent} size={14} style={{ marginRight: 6 }} />
                                                        <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>
                                                            {t('name_input.ai_recommended')}
                                                        </Text>
                                                    </View>
                                                    <View style={{ gap: 6, marginBottom: 20 }}>
                                                        {generatedMenus.map((menu, idx) => (
                                                            <View
                                                                key={idx}
                                                                style={{
                                                                    flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                                                    borderRadius: 10,
                                                                    paddingHorizontal: 14,
                                                                    paddingVertical: 10,
                                                                    borderWidth: 1,
                                                                    borderColor: 'rgba(255,255,255,0.06)',
                                                                }}
                                                            >
                                                                <View style={{
                                                                    width: 24, height: 24, borderRadius: 12,
                                                                    backgroundColor: `${Colors.primary}20`,
                                                                    justifyContent: 'center', alignItems: 'center',
                                                                    marginRight: 12,
                                                                }}>
                                                                    <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '900' }}>{idx + 1}</Text>
                                                                </View>
                                                                <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>{menu}</Text>
                                                            </View>
                                                        ))}
                                                    </View>

                                                    <TouchableOpacity
                                                        onPress={applyGeneratedMenus}
                                                        activeOpacity={0.8}
                                                        style={{
                                                            backgroundColor: Colors.primary,
                                                            paddingVertical: 12,
                                                            borderRadius: 14,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexDirection: 'row',
                                                        }}
                                                    >
                                                        <CheckCircle2 color="black" size={20} style={{ marginRight: 8 }} />
                                                        <Text style={{ color: 'black', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>
                                                            {t('name_input.apply_menu')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </ScrollView>
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

                    {/* Option Selection Bottom Sheet */}
                    <Modal
                        visible={showOptionSheet}
                        transparent={true}
                        animationType="slide"
                        onRequestClose={() => { setShowOptionSheet(false); setPendingMenuIndex(null); }}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => { setShowOptionSheet(false); setPendingMenuIndex(null); }}
                            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
                        >
                            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{
                                backgroundColor: Colors.surface,
                                borderTopLeftRadius: 20,
                                borderTopRightRadius: 20,
                                paddingHorizontal: 24,
                                paddingTop: 20,
                                paddingBottom: 36,
                                borderTopWidth: 1,
                                borderColor: Colors.glassBorder,
                            }}>
                                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#555', alignSelf: 'center', marginBottom: 16 }} />

                                <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 4 }}>
                                    {t('name_input.select_option') || 'SELECT OPTION'}
                                </Text>
                                <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 20 }}>
                                    {pendingMenuIndex !== null && menuItems[pendingMenuIndex]
                                        ? (typeof menuItems[pendingMenuIndex] === 'object' ? menuItems[pendingMenuIndex].name : menuItems[pendingMenuIndex])
                                        : ''}
                                </Text>

                                {CATEGORY_OPTIONS[activeCategory] && (
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        {CATEGORY_OPTIONS[activeCategory].options.map((opt) => (
                                            <TouchableOpacity
                                                key={opt.label}
                                                onPress={() => {
                                                    try { feedbackService.playClick(); } catch (e) { }
                                                    handleOptionSelect(opt.label);
                                                }}
                                                activeOpacity={0.7}
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 10,
                                                    borderRadius: 12,
                                                    borderWidth: 2,
                                                    borderColor: opt.color,
                                                    backgroundColor: `${opt.color}15`,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                }}
                                            >
                                                <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
                                                <Text style={{ color: opt.color, fontSize: 18, fontWeight: '900', letterSpacing: 1 }}>{opt.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Modal>

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
                                            <View key={`part-${index}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
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
                                                        {onlineUser && !isMe && <Text style={{ color: Colors.textSecondary, fontSize: 11 }}> ({t('name_input.selected').toUpperCase()})</Text>}
                                                    </Text>
                                                    {(pName === hostName || onlineUser?.role === 'owner') && (
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
                                                        <Text style={{ color: '#444', fontSize: 11, fontWeight: 'bold' }}>{t('common.not_connected') || 'OFFLINE'}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}

                                    {/* Show online users who are not in the participants list (e.g. they joined with a name that was later deleted) */}
                                    {onlineUsers.filter(u => !participants.some(p => (typeof p === 'object' ? p.name : p) === u.name)).map((user, index) => {
                                        return (
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

            {/* Onboarding Coach Mark */}
            <CoachMark
                steps={getCoachMarkSteps()}
                visible={showCoachMark}
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingComplete}
            />
        </CyberBackground >
    );
}

const styles = StyleSheet.create({});
