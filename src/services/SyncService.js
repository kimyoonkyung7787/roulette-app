import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, get, set, update, onDisconnect, serverTimestamp } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration (Firebase JS SDK does not use GoogleService-Info.plist in Expo Go automatically)
// Using standard web config pattern
const firebaseConfig = {
    apiKey: "AIzaSyC5nPw4ABjUOmWmL1ZDJcf0-8YwQCqtbFo",
    authDomain: "screenshot-pro-profit.firebaseapp.com",
    projectId: "screenshot-pro-profit",
    storageBucket: "screenshot-pro-profit.firebasestorage.app",
    messagingSenderId: "285608994135",
    appId: "1:285608994135:web:4ff35ac18fb9682752ca12",
    // DB URL usually follows this pattern once created
    databaseURL: "https://screenshot-pro-profit-default-rtdb.firebaseio.com"
};

let app;
try {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        console.log('SyncService: Firebase initialized with new config');
    } else {
        app = getApp();
        console.log('SyncService: Reusing existing Firebase app');
    }
} catch (e) {
    console.warn('SyncService: Firebase initialization warning:', e);
    app = getApp();
}

const db = getDatabase(app);

class SyncService {
    constructor() {
        this.myId = null;
        this.myName = null;
        this.roomId = null;
        this.roomPath = null;
        this.isInitialized = false;
    }

    async init(userName = null, roomId = 'default', role = 'participant') {
        // If already initialized with same roomId, skip
        if (this.isInitialized && this.roomId === roomId) return;

        console.log(`SyncService: Initializing for Room ID: ${roomId} as ${role}...`);
        this.roomId = roomId;
        this.role = role;
        this.roomPath = `rooms/${roomId}`;
        this.isInitialized = true;

        // Load personal identity
        try {
            this.myId = await AsyncStorage.getItem('my_user_id');
            if (!this.myId) {
                this.myId = Math.random().toString(36).substring(7);
                await AsyncStorage.setItem('my_user_id', this.myId);
            }

            // Use provided userName or fallback to AsyncStorage
            if (userName) {
                this.myName = userName;
                await AsyncStorage.setItem('my_display_name', userName);
            } else {
                this.myName = await AsyncStorage.getItem('my_display_name');
            }

            console.log(`SyncService: Identity loaded - ID: ${this.myId}, Name: ${this.myName}`);

            // Setup presence in this specific room
            const myPresenceRef = ref(db, `${this.roomPath}/presence/${this.myId}`);
            const connectedRef = ref(db, '.info/connected');

            console.log('SyncService: Listening for connection status...');

            onValue(connectedRef, (snapshot) => {
                const connected = snapshot.val();
                console.log(`SyncService: Connection status changed: ${connected}`);

                if (connected === true) {
                    console.log('SyncService: Connected to Firebase RTDB!');

                    // Test write to check rules
                    set(ref(db, 'test_connection'), {
                        status: 'checking',
                        timestamp: serverTimestamp()
                    }).then(() => console.log('SyncService: Test write SUCCESS (Rules are OK)'))
                        .catch(e => console.error('SyncService: Test write FAILED (Check Rules!):', e));

                    onDisconnect(myPresenceRef).remove().then(() => {
                        console.log('SyncService: onDisconnect set up');
                        set(myPresenceRef, {
                            name: this.myName || 'Unknown User',
                            role: this.role || 'participant',
                            lastActive: serverTimestamp()
                        }).then(() => {
                            console.log('SyncService: My presence written to DB');
                        }).catch(err => {
                            console.error('SyncService: Presence write FAILED:', err);
                        });
                    });
                } else if (connected === false) {
                    console.log('SyncService: Disconnected from Firebase RTDB');
                }
            });
        } catch (err) {
            console.error('SyncService: Initialization failed:', err);
        }
    }

    async setIdentity(name) {
        this.myName = name;
        await AsyncStorage.setItem('my_display_name', name);
        if (this.myId && this.roomId) {
            update(ref(db, `${this.roomPath}/presence/${this.myId}`), { name });
        }
    }

    subscribeToOnlineCount(callback) {
        onValue(ref(db, `${this.roomPath}/presence`), (snapshot) => {
            if (!snapshot || typeof snapshot.numChildren !== 'function') {
                callback(0);
                return;
            }
            const count = snapshot.numChildren() || 0;
            console.log(`SyncService: Online count update for room ${this.roomId}: ${count}`);
            callback(count);
        });
    }

    subscribeToOnlineUsers(callback) {
        return onValue(ref(db, `${this.roomPath}/presence`), (snapshot) => {
            const users = [];
            if (snapshot && typeof snapshot.forEach === 'function') {
                snapshot.forEach(child => {
                    users.push({ id: child.key, ...child.val() });
                });
            }
            console.log(`SyncService: Found ${users.length} online users in room ${this.roomId}`);
            callback(users);
        });
    }

    async setRoomCategory(category) {
        try {
            await set(ref(db, `${this.roomPath}/category`), category);
            console.log(`SyncService: Category updated to ${category} in room ${this.roomId}`);
        } catch (e) {
            console.error('Failed to set category:', e);
        }
    }

    subscribeToCategory(callback) {
        return onValue(ref(db, `${this.roomPath}/category`), (snapshot) => {
            const category = snapshot.val() || 'coffee';
            console.log(`SyncService: Category update received: ${category}`);
            callback(category);
        });
    }

    async setParticipants(participants) {
        try {
            await set(ref(db, `${this.roomPath}/participants`), participants);
            console.log(`SyncService: Participants list updated (${participants.length} items) in room ${this.roomId}`);
        } catch (e) {
            console.error('Failed to set participants:', e);
        }
    }

    subscribeToParticipants(callback) {
        return onValue(ref(db, `${this.roomPath}/participants`), (snapshot) => {
            const participants = snapshot.val() || [];
            console.log(`SyncService: Participants update received (${participants.length} items)`);
            callback(participants);
        });
    }

    subscribeToSpinState(callback) {
        return onValue(ref(db, `${this.roomPath}/spin_state`), (snapshot) => {
            callback(snapshot.val());
        });
    }

    async startSpin(userName) {
        try {
            await set(ref(db, `${this.roomPath}/spin_state`), {
                isSpinning: true,
                starter: userName,
                startTime: serverTimestamp()
            });
        } catch (e) {
            console.error('Failed to start spin sync:', e);
        }
    }

    async finishSpin(result) {
        try {
            await set(ref(db, `${this.roomPath}/spin_state`), {
                isSpinning: false,
                lastResult: result,
                finishedAt: serverTimestamp()
            });
        } catch (e) {
            console.error('Failed to finish spin sync:', e);
        }
    }

    // --- Tournament Methods ---

    async submitVote(votedForName) {
        if (!this.myId) return;
        try {
            await set(ref(db, `${this.roomPath}/votes/${this.myId}`), {
                userId: this.myId,
                userName: this.myName || 'Unknown',
                votedFor: votedForName,
                timestamp: serverTimestamp()
            });
            console.log(`SyncService: Vote submitted for ${votedForName}`);
        } catch (e) {
            console.error('SyncService: Failed to submit vote:', e);
        }
    }

    subscribeToVotes(callback) {
        return onValue(ref(db, `${this.roomPath}/votes`), (snapshot) => {
            const votes = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    votes.push(child.val());
                });
            }
            callback(votes);
        });
    }

    async getVotes() {
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/votes`));
            const votes = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    votes.push(child.val());
                });
            }
            return votes;
        } catch (e) {
            console.error('SyncService: Failed to get votes:', e);
            return [];
        }
    }

    async clearVotes() {
        try {
            await set(ref(db, `${this.roomPath}/votes`), null);
            console.log('SyncService: All votes cleared');
        } catch (e) {
            console.error('SyncService: Failed to clear votes:', e);
        }
    }

    async clearSpinState() {
        try {
            await set(ref(db, `${this.roomPath}/spin_state`), null);
            console.log('SyncService: Spin state cleared');
        } catch (e) {
            console.error('SyncService: Failed to clear spin state:', e);
        }
    }

    async finalizeGame(resultData) {
        try {
            await set(ref(db, `${this.roomPath}/final_results`), {
                ...resultData,
                timestamp: serverTimestamp()
            });
            console.log('SyncService: Game finalized');
        } catch (e) {
            console.error('SyncService: Failed to finalize game:', e);
        }
    }

    subscribeToFinalResults(callback) {
        return onValue(ref(db, `${this.roomPath}/final_results`), (snapshot) => {
            callback(snapshot.val());
        });
    }

    async clearFinalResults() {
        try {
            await set(ref(db, `${this.roomPath}/final_results`), null);
        } catch (e) {
            console.error('SyncService: Failed to clear final results:', e);
        }
    }
}

export const syncService = new SyncService();
