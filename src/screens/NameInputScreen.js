import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { CyberBackground } from '../components/CyberBackground';
import { NeonText } from '../components/NeonText';
import { UserPlus, Trash2, Play, History, CheckCircle2, Users, X, Loader, LogOut, Crown } from 'lucide-react-native';
import { syncService } from '../services/SyncService';
import { participantService } from '../services/ParticipantService';

export default function NameInputScreen({ route, navigation }) {
    const { category = 'coffee', role = 'owner', roomId = 'default' } = route.params || {};
    const [name, setName] = useState('');
    const [participants, setParticipants] = useState([]);
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
    const participantsRef = useRef(participants);

    useEffect(() => {
        participantsRef.current = participants;
    }, [participants]);

    useEffect(() => {
        const loadInitialData = async () => {
            console.log('NameInputScreen: Initializing room:', roomId);
            await syncService.init(null, roomId, role);

            if (syncService.myName) {
                setMySelectedName(syncService.myName);
            }

            // Sync room state based on role
            if (role === 'owner') {
                await syncService.setRoomCategory(category);
                let savedParticipants = await participantService.getParticipants();

                // Ensure at least 2 participants exist for owner's initial screen
                if (!savedParticipants || savedParticipants.length < 2) {
                    savedParticipants = [
                        { name: '참여자 1', weight: 50 },
                        { name: '참여자 2', weight: 50 }
                    ];
                } else if (typeof savedParticipants[0] === 'string') {
                    // Migration: if they are strings, convert to objects
                    const weight = Math.floor(100 / savedParticipants.length);
                    savedParticipants = savedParticipants.map((p, i) => ({
                        name: p,
                        weight: i === savedParticipants.length - 1 ? 100 - (weight * (savedParticipants.length - 1)) : weight
                    }));
                }

                setParticipants(savedParticipants);
                // Also sync to remote immediately so participants can see them
                await syncService.setParticipants(savedParticipants);

                // CRITICAL: Clear any leftover state when owner enters/re-enters to prevent 
                // participants from auto-navigating to stale sessions.
                await syncService.clearSpinState();
                await syncService.clearVotes();
                await syncService.clearFinalResults();
            }

            // --- Subscriptions MUST happen after init (when roomPath is set) ---

            // If participant, subscribe to room state
            if (role === 'participant') {
                syncService.subscribeToCategory(cat => {
                    setActiveCategory(cat);
                });

                syncService.subscribeToParticipants(list => {
                    console.log('NameInputScreen: Received participants update:', list.length, 'items');
                    setParticipants(list);
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
                // Only follow if owner started spinning AND I have selected a name
                if (state?.isSpinning && role === 'participant' && syncService.myName) {
                    console.log('NameInputScreen: Spin started by owner, navigating to Roulette');
                    navigation.navigate('Roulette', {
                        participants: participantsRef.current,
                        mySelectedName: syncService.myName,
                        roomId,
                        role: 'participant'
                    });
                }
            });

            setIsLoaded(true);
        };
        loadInitialData();
    }, []);

    // Save participants whenever they change
    useEffect(() => {
        if (role === 'owner' && isLoaded && participants.length > 0) {
            participantService.saveParticipants(participants);
            syncService.setParticipants(participants);
        }
    }, [participants, isLoaded]);

    const redistributeWeights = (list) => {
        if (list.length === 0) return [];
        const baseWeight = Math.floor(100 / list.length);
        const remainder = 100 % list.length;

        return list.map((p, i) => ({
            ...p,
            weight: baseWeight + (i < remainder ? 1 : 0)
        }));
    };

    const addParticipant = () => {
        if (name.trim()) {
            const newList = [...participants, { name: name.trim(), weight: 0 }];
            setParticipants(redistributeWeights(newList));
            setName('');
        }
    };

    const removeParticipant = (index) => {
        const removedItem = participants[index];
        if (removedItem.name === mySelectedName) {
            setMySelectedName(null);
        }
        const newList = participants.filter((_, i) => i !== index);
        setParticipants(redistributeWeights(newList));
    };

    const startEditing = (index) => {
        setEditingIndex(index);
        setEditingValue(participants[index].name);
    };

    const startEditingWeight = (index) => {
        setEditingWeightIndex(index);
        setEditingWeightValue(participants[index].weight.toString());
    };

    const saveEdit = () => {
        if (editingValue.trim()) {
            const oldName = participants[editingIndex].name;
            const newName = editingValue.trim();
            const newParticipants = [...participants];
            newParticipants[editingIndex] = { ...newParticipants[editingIndex], name: newName };
            setParticipants(newParticipants);

            if (oldName === mySelectedName) {
                toggleMe(newName);
            }
        }
        setEditingIndex(null);
    };

    const saveWeightEdit = () => {
        const val = parseInt(editingWeightValue);
        if (!isNaN(val) && val >= 0) {
            const newParticipants = [...participants];
            newParticipants[editingWeightIndex] = { ...newParticipants[editingWeightIndex], weight: val };
            setParticipants(newParticipants);
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

    const startRoulette = async () => {
        if (participants.length >= 2) {
            // Validate total weight
            const totalWeight = participants.reduce((sum, p) => sum + (p.weight || 0), 0);
            if (totalWeight !== 100) {
                alert(`전체 비율의 합이 100%이어야 합니다. (현재: ${totalWeight}%)`);
                return;
            }

            // Clear previous session data when starting fresh
            if (role === 'owner') {
                try {
                    console.log('NameInputScreen: Owner initializing fresh session for room:', roomId);
                    await syncService.clearVotes();
                    await syncService.clearSpinState();
                    await syncService.clearFinalResults(); // Ensure old results are gone
                } catch (e) {
                    console.error('NameInputScreen: Failed to clear previous session:', e);
                }
            }

            navigation.navigate('Roulette', {
                participants,
                mySelectedName,
                roomId,
                role
            });
        } else {
            alert('최소 2명 이상의 참여자가 필요합니다!');
        }
    };

    return (
        <CyberBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 20 }}>
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

                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setShowUsersModal(true)} style={{ padding: 8 }}>
                                <Users color={Colors.success} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('History')} style={{ padding: 8 }}>
                                <History color={Colors.primary} size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Welcome')}
                                style={{ padding: 8 }}
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
                                            {activeCategory.toUpperCase()}
                                        </Text>
                                    </View>
                                );
                            })()}
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>{role.toUpperCase()}</Text>
                            </View>
                        </View>
                        <NeonText className="text-4xl">PARTICIPANTS</NeonText>
                        <View style={{ height: 2, width: 100, backgroundColor: Colors.primary, marginTop: 10, shadowColor: Colors.primary, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 }} />
                    </View>

                    {role === 'owner' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
                            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginRight: 10, overflow: 'hidden' }}>
                                <TextInput
                                    style={{ color: 'white', padding: 16, fontSize: 16 }}
                                    placeholder="참여자를 추가하세요..."
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={name}
                                    onChangeText={setName}
                                    onSubmitEditing={addParticipant}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={addParticipant}
                                style={{ backgroundColor: Colors.primary, padding: 16, borderRadius: 12, shadowColor: Colors.primary, shadowOpacity: 0.5, shadowRadius: 15, elevation: 8 }}
                            >
                                <UserPlus color="black" size={24} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <FlatList
                        data={participants}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item, index }) => (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: mySelectedName === (item.name || item) ? 'rgba(0, 255, 255, 0.08)' : 'rgba(255,255,255,0.03)',
                                padding: 12,
                                borderRadius: 12,
                                marginBottom: 12,
                                borderWidth: 1,
                                borderColor: editingIndex === index ? Colors.primary : (mySelectedName === (item.name || item) ? Colors.primary : 'rgba(255,255,255,0.08)')
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <TouchableOpacity
                                        onPress={() => toggleMe(item.name || item)}
                                        style={{ marginRight: 12 }}
                                    >
                                        <CheckCircle2
                                            color={mySelectedName === (item.name || item) ? Colors.primary : 'rgba(255,255,255,0.2)'}
                                            size={22}
                                            fill={mySelectedName === (item.name || item) ? 'rgba(78, 205, 196, 0.2)' : 'transparent'}
                                        />
                                    </TouchableOpacity>

                                    {editingIndex === index && role === 'owner' ? (
                                        <TextInput
                                            autoFocus
                                            style={{ color: Colors.primary, fontSize: 18, fontWeight: '500', flex: 1, padding: 0 }}
                                            value={editingValue}
                                            onChangeText={setEditingValue}
                                            onBlur={saveEdit}
                                            onSubmitEditing={saveEdit}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => role === 'owner' ? startEditing(index) : null}
                                            activeOpacity={role === 'owner' ? 0.7 : 1}
                                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                                        >
                                            <Text style={{
                                                color: Colors.primary,
                                                fontSize: 18,
                                                fontWeight: '500',
                                                letterSpacing: 1,
                                                opacity: mySelectedName === item.name ? 1 : 0.8
                                            }}>{item.name}{mySelectedName === item.name ? ' (나)' : ''}</Text>

                                            {/* Show Crown if this name is taken by an owner */}
                                            {onlineUsers.some(u => u.name === item.name && u.role === 'owner') && (
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
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {role === 'owner' && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {editingWeightIndex === index ? (
                                            <TextInput
                                                autoFocus
                                                keyboardType="number-pad"
                                                style={{
                                                    color: Colors.secondary,
                                                    fontSize: 16,
                                                    fontWeight: 'bold',
                                                    width: 40,
                                                    textAlign: 'right',
                                                    marginRight: 2
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
                                                    width: 45,
                                                    textAlign: 'right'
                                                }}>{item.weight}%</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity onPress={() => removeParticipant(index)} style={{ marginLeft: 20 }}>
                                            <Trash2 color={Colors.textSecondary} size={18} opacity={0.6} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {role === 'participant' && (
                                    <Text style={{ color: Colors.secondary, fontSize: 16, fontWeight: 'bold', marginRight: 10 }}>{item.weight}%</Text>
                                )}
                            </View>
                        )}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListFooterComponent={participants.length > 0 ? (
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
                                    color: participants.reduce((sum, p) => sum + (p.weight || 0), 0) === 100 ? Colors.secondary : Colors.error,
                                    fontSize: 14,
                                    fontWeight: 'bold'
                                }}>
                                    {participants.reduce((sum, p) => sum + (p.weight || 0), 0)}%
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
                        <TouchableOpacity
                            onPress={startRoulette}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: 'transparent',
                                paddingVertical: 18,
                                borderRadius: 16,
                                alignItems: 'center',
                                marginTop: 10,
                                borderWidth: 2,
                                borderColor: Colors.primary,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                shadowColor: Colors.primary,
                                shadowOpacity: 0.3,
                                shadowRadius: 20,
                                elevation: 10
                            }}
                        >
                            <Play color={Colors.primary} size={24} fill={Colors.primary} style={{ marginRight: 10 }} />
                            <NeonText className="text-2xl" style={{ color: Colors.primary }}>START ROULETTE</NeonText>
                        </TouchableOpacity>
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
                                {mySelectedName ? 'WAITING FOR OWNER TO START...' : 'PLEASE SELECT YOUR NAME ABOVE'}
                            </Text>
                        </View>
                    )}
                </View>

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
                                }}>투표자</Text>
                                <Text style={{
                                    color: Colors.primary,
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    letterSpacing: 1.5,
                                    textTransform: 'uppercase'
                                }}>당첨자</Text>
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
