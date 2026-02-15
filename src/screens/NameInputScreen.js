import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { NeonText } from '../components/NeonText';
import { UserPlus, Trash2, Play, History, CheckCircle2, ListChecks, Users, X, Loader, LogOut, Crown, Utensils, Coffee, Cookie } from 'lucide-react-native';
import { syncService } from '../services/SyncService';
import { participantService } from '../services/ParticipantService';
import { CyberAlert } from '../components/CyberAlert';

export default function NameInputScreen({ route, navigation }) {
    const { category = 'coffee', role = 'owner', roomId = 'default' } = route.params || {};
    const [name, setName] = useState('');
    const [participants, setParticipants] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [activeTab, setActiveTab] = useState('people'); // 'people' | 'menu'
    const [isLoaded, setIsLoaded] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingWeightIndex, setEditingWeightIndex] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [editingWeightValue, setEditingWeightValue] = useState('');
    const [mySelectedName, setMySelectedName] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [votes, setVotes] = useState([]);
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [activeCategory, setActiveCategory] = useState(category);
    const categoryRef = useRef(category);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });

    useEffect(() => {
        categoryRef.current = activeCategory;
    }, [activeCategory]);
    const [remoteSpinState, setRemoteSpinState] = useState(null);
    const [roomPhase, setRoomPhaseState] = useState('waiting');
    const [finalResults, setFinalResults] = useState(null);
    const isNavigatingRef = useRef(false);
    const participantsRef = useRef(participants);

    useEffect(() => {
        participantsRef.current = participants;
    }, [participants]);

    useEffect(() => {
        const loadInitialData = async () => {
            console.log('NameInputScreen: Initializing room:', roomId);
            await syncService.init(null, roomId, role);

            // Auto-select name for OWNER ONLY to avoid IDENT: UNKNOWN.
            // Participants must still manually select their name in the list.
            if (role === 'owner' && syncService.myName) {
                setMySelectedName(syncService.myName);
            }

            // Sync room state based on role
            if (role === 'owner') {
                await syncService.setRoomPhase('waiting');
                // Use the route param category as the master for retry/initialization
                await syncService.setRoomCategory(category);
                setActiveCategory(category);

                // Participants logic - Prioritize remote data, then local storage, then defaults
                let existingParticipants = await syncService.getParticipants();
                let savedParticipants = [];

                if (existingParticipants && existingParticipants.length > 0) {
                    savedParticipants = existingParticipants;
                } else {
                    savedParticipants = await participantService.getParticipants();
                    if (!savedParticipants || savedParticipants.length < 2) {
                        savedParticipants = [
                            { name: '참여자 1', weight: 50 },
                            { name: '참여자 2', weight: 50 }
                        ];
                    } else if (typeof savedParticipants[0] === 'string') {
                        const weight = Math.floor((100 / savedParticipants.length) * 10) / 10;
                        savedParticipants = savedParticipants.map((p, i) => ({
                            name: p,
                            weight: i === 0 ? Math.round((100 - (weight * (savedParticipants.length - 1))) * 10) / 10 : weight
                        }));
                    }
                }
                setParticipants(savedParticipants);
                await syncService.setParticipants(savedParticipants);

                // Menu items logic - Prioritize remote data, then defaults based on category
                let existingMenus = await syncService.getMenuItems();
                let menuList = [];

                if (existingMenus && existingMenus.length > 0) {
                    menuList = existingMenus;
                } else {
                    if (category === 'coffee') menuList = [{ name: '아메리카노', weight: 50 }, { name: '카페라떼', weight: 50 }];
                    else if (category === 'meal') menuList = [{ name: '김치찌개', weight: 50 }, { name: '된장찌개', weight: 50 }];
                    else menuList = [{ name: '치킨', weight: 50 }, { name: '피자', weight: 50 }];
                }

                setMenuItems(menuList);
                await syncService.setMenuItems(menuList);

                await syncService.clearSpinState();
                await syncService.clearVotes();
                await syncService.clearFinalResults();
            }

            // --- Subscriptions MUST happen after init (when roomPath is set) ---

            // Subscribe to room category (Everyone should stay in sync)
            syncService.subscribeToCategory(cat => {
                setActiveCategory(cat);
            });

            // If participant, subscribe to other room states
            if (role === 'participant') {

                syncService.subscribeToParticipants(list => {
                    console.log('NameInputScreen: Received participants update:', list.length, 'items');
                    setParticipants(list);
                });

                syncService.subscribeToMenuItems(list => {
                    console.log('NameInputScreen: Received menu items update:', list.length, 'items');
                    setMenuItems(list);
                });
            }

            // Subscribe to online users
            syncService.subscribeToOnlineUsers(users => {
                setOnlineUsers(users);
            });

            // Subscribe to votes
            syncService.subscribeToVotes(vts => {
                setVotes(vts);
            });

            // Listen for spin start from owner
            syncService.subscribeToSpinState(state => {
                setRemoteSpinState(state);
            });

            // Listen for room phase
            syncService.subscribeToRoomPhase(phase => {
                setRoomPhaseState(phase);
            });

            // Listen for final results (game finished)
            syncService.subscribeToFinalResults(results => {
                setFinalResults(results);
            });

            setIsLoaded(true);
        };
        loadInitialData();
    }, []);

    // Auto-navigate if game is in roulette phase or there's active game data
    useEffect(() => {
        // Only attempt navigation for participants who have selected a name
        if (role !== 'participant' || !mySelectedName || participants.length === 0 || isNavigatingRef.current) return;

        const isGameActive = roomPhase === 'roulette' || votes.length > 0 || remoteSpinState?.isSpinning;

        // Condition 1: Game is finished (Results exist)
        if (finalResults) {
            console.log('NameInputScreen: Game already finished, showing result screen...');
            isNavigatingRef.current = true;
            navigation.navigate('Result', {
                ...finalResults,
                roomId,
                role: 'participant',
                category: activeCategory
            });
            return;
        }

        if (isGameActive) {
            console.log('NameInputScreen: Active game detected, joining Roulette screen...');
            isNavigatingRef.current = true;
            navigation.navigate('Roulette', {
                participants: participants,
                menuItems: menuItems,
                mySelectedName: mySelectedName,
                roomId,
                role: 'participant',
                category: activeCategory
            });

            // Reset navigation flag after a short delay to allow future joins if needed
            setTimeout(() => {
                isNavigatingRef.current = false;
            }, 2000);
        }
    }, [roomPhase, mySelectedName, role, votes, remoteSpinState, participants, finalResults]);

    // Save participants whenever they change
    useEffect(() => {
        if (role === 'owner' && isLoaded && participants.length > 0) {
            participantService.saveParticipants(participants);
            syncService.setParticipants(participants);
        }
    }, [participants, isLoaded]);

    const redistributeWeights = (list) => {
        if (list.length === 0) return [];
        // Use floor to truncate at 1 decimal place
        const baseWeight = Math.floor((100 / list.length) * 10) / 10;
        const totalOthers = baseWeight * (list.length - 1);
        const ownerWeight = Math.round((100 - totalOthers) * 10) / 10;

        return list.map((p, i) => ({
            ...p,
            weight: i === 0 ? ownerWeight : baseWeight
        }));
    };

    const addParticipant = async () => {
        if (!name.trim()) return;
        if (activeTab === 'people') {
            const newList = [...participants, { name: name.trim(), weight: 0 }];
            const updated = redistributeWeights(newList);
            setParticipants(updated);
            if (role === 'owner') await syncService.setParticipants(updated);
        } else {
            const newList = [...menuItems, { name: name.trim(), weight: 0 }];
            const updated = redistributeWeights(newList);
            setMenuItems(updated);
            if (role === 'owner') await syncService.setMenuItems(updated);
        }
        setName('');
    };

    const removeParticipant = async (index) => {
        if (activeTab === 'people') {
            const removedItem = participants[index];
            if (removedItem.name === mySelectedName) setMySelectedName(null);
            const newList = participants.filter((_, i) => i !== index);
            const updated = redistributeWeights(newList);
            setParticipants(updated);
            if (role === 'owner') await syncService.setParticipants(updated);
        } else {
            const newList = menuItems.filter((_, i) => i !== index);
            const updated = redistributeWeights(newList);
            setMenuItems(updated);
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

    const startRoulette = async (target = 'people') => {
        if (target === 'people') {
            if (participants.length < 2) {
                setAlertConfig({
                    visible: true,
                    title: 'ALERT',
                    message: 'At least 2 participants required!'
                });
                return;
            }
            // Validate total weight with small tolerance for floating point precision
            const totalWeight = participants.reduce((sum, p) => sum + (p.weight || 0), 0);
            if (Math.abs(totalWeight - 100) > 0.01) {
                setAlertConfig({
                    visible: true,
                    title: 'ALERT',
                    message: `Total ratio must be 100.0% (Current: ${totalWeight.toFixed(1)}%)`
                });
                return;
            }
        } else {
            if (menuItems.length < 2) {
                setAlertConfig({
                    visible: true,
                    title: 'ALERT',
                    message: 'At least 2 menu items required!'
                });
                return;
            }
        }

        // Clear previous session data when starting fresh
        if (role === 'owner') {
            try {
                console.log(`NameInputScreen: Owner initializing fresh session for ${target} in room:`, roomId);
                await syncService.setSpinTarget(target);
                await syncService.setRoomPhase('roulette'); // Signal participants to move
                await syncService.clearVotes();
                await syncService.clearSpinState();
                await syncService.clearFinalResults();
            } catch (e) {
                console.error('NameInputScreen: Failed to clear previous session:', e);
            }

            navigation.navigate('Roulette', {
                participants,
                menuItems,
                mySelectedName,
                roomId,
                role,
                category: activeCategory
            });
        }
    };

    const activeMenuColor = activeCategory === 'coffee' ? Colors.neonPink :
        activeCategory === 'meal' ? Colors.success :
            Colors.accent;

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
                            <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>#ROOM: {roomId.toUpperCase()}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 6 }}>
                                <ListChecks color={Colors.success} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('History')} style={{ padding: 6 }}>
                                <History color={Colors.primary} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Welcome')}
                                style={{ padding: 6 }}
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
                                            {(activeCategory || '').toUpperCase()}
                                        </Text>
                                    </View>
                                );
                            })()}
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>{(role || '').toUpperCase()}</Text>
                            </View>
                        </View>
                        <NeonText className="text-4xl">{activeTab === 'people' ? 'PARTICIPANTS' : 'MENU ITEMS'}</NeonText>
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
                            <Text style={{ color: activeTab === 'people' ? Colors.primary : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>PEOPLE</Text>
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
                            <Text style={{ color: activeTab === 'menu' ? activeMenuColor : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>MENU</Text>
                        </TouchableOpacity>
                    </View>

                    {role === 'owner' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
                            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginRight: 10, overflow: 'hidden' }}>
                                <TextInput
                                    style={{ color: 'white', padding: 16, fontSize: 16 }}
                                    placeholder={activeTab === 'people' ? "참여자를 추가하세요..." : "메뉴를 추가하세요..."}
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={name}
                                    onChangeText={setName}
                                    onSubmitEditing={addParticipant}
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
                                                return <Utensils {...iconProps} />;
                                            case 'snack':
                                            default:
                                                return <Cookie {...iconProps} />;
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
                            const isPeopleTab = activeTab === 'people';
                            const isTakenByOther = isPeopleTab && onlineUsers.some(u => u.name === nameToCheck && u.id !== syncService.myId);
                            const isMe = isPeopleTab && mySelectedName === nameToCheck;
                            const activeThemeColor = isPeopleTab ? Colors.primary : activeMenuColor;

                            return (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: isMe ? `${Colors.primary}15` : (isTakenByOther ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)'),
                                    padding: 12,
                                    borderRadius: 12,
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderColor: isMe ? Colors.primary : (isTakenByOther ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'),
                                    opacity: isTakenByOther && !isMe ? 0.5 : 1
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        {isPeopleTab && (
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
                                                onPress={() => !isTakenByOther && role === 'owner' ? startEditing(index) : (isPeopleTab && !isTakenByOther ? toggleMe(nameToCheck) : null)}
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
                                                }}>{item.name}{isMe ? ' (ME)' : ''}</Text>

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
                                                        <Text style={{ color: Colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>HOST</Text>
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
                                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 'bold' }}>SELECTED</Text>
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
                                                            minWidth: 50,
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
                                                        <Text style={{
                                                            color: Colors.secondary,
                                                            fontSize: 16,
                                                            fontWeight: 'bold',
                                                            minWidth: 65,
                                                            textAlign: 'right'
                                                        }}>{typeof item.weight === 'number' ? item.weight.toFixed(1) : item.weight}%</Text>
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
                                                {typeof item.weight === 'number' ? item.weight.toFixed(1) : item.weight}%
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListFooterComponent={activeTab === 'people' && participants.length > 0 ? (
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                paddingHorizontal: 12,
                                marginTop: 5,
                                marginBottom: 15
                            }}>
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginRight: 10 }}>TOTAL_RATIO:</Text>
                                <Text style={{
                                    color: Math.abs(participants.reduce((sum, p) => sum + (p.weight || 0), 0) - 100) < 0.01 ? Colors.secondary : Colors.error,
                                    fontSize: 14,
                                    fontWeight: 'bold'
                                }}>
                                    {participants.reduce((sum, p) => sum + (p.weight || 0), 0).toFixed(1)}%
                                </Text>
                            </View>
                        ) : null}
                        ListEmptyComponent={
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 50 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>
                                    {role === 'owner' ? '참여자를 추가해주세요' : '방장이 참여자를 설정 중입니다...'}
                                </Text>
                            </View>
                        }
                    />

                    {role === 'owner' ? (
                        <View style={{ marginTop: 10 }}>
                            <NeonText className="text-sm mb-2 opacity-70" style={{ marginLeft: 5 }}>SELECT_ROULETTE_TARGET</NeonText>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => startRoulette('people')}
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
                                    <ListChecks color={Colors.primary} size={20} style={{ marginRight: 8 }} />
                                    <NeonText className="text-lg" style={{ color: Colors.primary }}>PEOPLE</NeonText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => startRoulette('menu')}
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
                                        borderColor: Colors.secondary,
                                        shadowColor: Colors.secondary,
                                        shadowOpacity: 0.3,
                                        shadowRadius: 15,
                                        elevation: 8
                                    }}
                                >
                                    <View style={{ marginRight: 8 }}>
                                        {activeCategory === 'coffee' ? (
                                            <Coffee color={Colors.secondary} size={20} />
                                        ) : activeCategory === 'meal' ? (
                                            <Utensils color={Colors.secondary} size={20} />
                                        ) : (
                                            <Cookie color={Colors.secondary} size={20} />
                                        )}
                                    </View>
                                    <NeonText className="text-lg" color={Colors.secondary}>MENU</NeonText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={{
                            paddingVertical: 18,
                            borderRadius: 16,
                            alignItems: 'center',
                            marginTop: 10,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        }}>
                            <Loader color={Colors.primary} size={20} style={{ marginBottom: 8 }} />
                            <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: 'bold', letterSpacing: 2 }}>
                                {finalResults
                                    ? 'GAME FINISHED! CHECK RESULTS...'
                                    : (roomPhase === 'roulette' || votes.length > 0 || remoteSpinState?.isSpinning)
                                        ? (mySelectedName ? 'GAME IN PROGRESS...' : 'SELECT YOUR NAME TO JOIN!')
                                        : (mySelectedName ? 'WAITING FOR OWNER TO START...' : 'PLEASE SELECT YOUR NAME ABOVE')
                                }
                            </Text>
                        </View>
                    )}
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
                                <NeonText className="text-2xl">ACTIVE NODES</NeonText>
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
                                }}>VOTER</Text>
                                <Text style={{
                                    color: Colors.primary,
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    letterSpacing: 1.5,
                                    textTransform: 'uppercase'
                                }}>WINNER</Text>
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
                                                    {user.name} {user.id === syncService.myId ? '(ME)' : ''}
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
                                                    {userVote ? userVote.votedFor : 'SPINNING...'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </CyberBackground>
    );
}
