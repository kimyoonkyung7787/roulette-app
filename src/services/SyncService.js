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
    // Try to get fallback app, but don't crash if it fails
    try {
        app = getApp();
    } catch (err) {
        console.error('SyncService: No Firebase app found after failure:', err);
    }
}

// Only initialize DB if app was successfully found or created
const db = app ? getDatabase(app) : null;

class SyncService {
    constructor() {
        this.myId = null;
        this.myName = null;
        this.roomId = null;
        this.roomPath = null;
        this.isInitialized = false;
        this._connectedUnsubscribe = null; // Track the .info/connected listener
    }

    async init(userName = null, roomId = 'default', role = 'participant') {
        const roomChanged = this.roomId !== roomId;
        console.log(`SyncService: Initializing for Room ID: ${roomId} as ${role}${roomChanged ? ' (NEW ROOM)' : ''}...`);

        this.roomId = roomId;
        this.role = role;
        this.roomPath = `rooms/${roomId}`;
        this.isInitialized = true;

        // Load or update personal identity
        try {
            if (!this.myId) {
                this.myId = await AsyncStorage.getItem('my_user_id');
                if (!this.myId) {
                    this.myId = Math.random().toString(36).substring(7);
                    await AsyncStorage.setItem('my_user_id', this.myId);
                }
            }

            if (userName) {
                this.myName = userName;
                await AsyncStorage.setItem('my_display_name', userName);
            } else if (!this.myName) {
                this.myName = await AsyncStorage.getItem('my_display_name');
            }

            console.log(`SyncService: Identity - ID: ${this.myId}, Name: ${this.myName}`);

            if (!db) {
                console.warn('SyncService: DB not available, skipping Firebase presence');
                return;
            }

            // Setup presence - Always re-verify presence when init is called to be safe
            const myPresenceRef = ref(db, `${this.roomPath}/presence/${this.myId}`);
            const connectedRef = ref(db, '.info/connected');

            // Clean up previous connected listener to avoid duplicate presence writes
            if (this._connectedUnsubscribe) {
                this._connectedUnsubscribe();
                this._connectedUnsubscribe = null;
            }

            // Listen for connection once and maintain presence
            this._connectedUnsubscribe = onValue(connectedRef, (snapshot) => {
                const connected = snapshot.val();
                if (connected === true) {
                    console.log(`SyncService: Writing presence for ${this.myName} in room ${this.roomId}`);

                    onDisconnect(myPresenceRef).remove().then(() => {
                        set(myPresenceRef, {
                            name: this.myName || 'Unknown User',
                            role: this.role || 'participant',
                            id: this.myId, // Explicitly include ID for mapping
                            lastActive: serverTimestamp()
                        });
                    });

                    // [REMOVED App Close/Kill Scenario] 
                    // We no longer delete the entire room strictly on host socket disconnect. 
                    // Brief network interruptions or backgrounding the app on mobile caused 
                    // 'onDisconnect' to fire and instantly kick out all participants with a 
                    // "Host ended room" alert, despite the host still actively playing.
                    // Instead, we rely on the host's explicit "handleExit" -> syncService.removeRoom()

                    // [NEW] 5-Minute Grace Period
                    // When the host disconnects, set a timestamp. 
                    if (this.role === 'owner') {
                        const hostDisconnectedRef = ref(db, `${this.roomPath}/hostDisconnectedAt`);
                        // Set the generic server time of disconnect
                        onDisconnect(hostDisconnectedRef).set(serverTimestamp()).catch(e => console.warn('SyncService: Failed to attach hostDisconnected', e));
                        // Clear the disconnect timestamp immediately returning from background
                        set(hostDisconnectedRef, null);
                    }
                }
            });
        } catch (err) {
            console.error('SyncService: Initialization failed:', err);
        }
    }

    async setIdentity(name) {
        try {
            this.myName = name;
            await AsyncStorage.setItem('my_display_name', name);
            if (db && this.myId && this.roomId) {
                await update(ref(db, `${this.roomPath}/presence/${this.myId}`), { name });
            }
        } catch (e) {
            console.error('SyncService: Failed to set identity:', e);
        }
    }

    subscribeToOnlineCount(callback) {
        if (!db) {
            callback(0);
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/presence`), (snapshot) => {
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
        if (!db) {
            callback([]);
            return () => { };
        }
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
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/category`), category);
            console.log(`SyncService: Category updated to ${category} in room ${this.roomId}`);
        } catch (e) {
            console.error('Failed to set category:', e);
        }
    }

    async setHostName(name) {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/hostName`), name);
            console.log(`SyncService: Host name set to ${name} in room ${this.roomId}`);
        } catch (e) {
            console.error('Failed to set hostName:', e);
        }
    }

    subscribeToRoomDeleted(callback) {
        if (!db || !this.roomPath) {
            return () => { };
        }

        let fired = false;
        let initialLoad = true; // Skip the very first snapshot (initial data load)

        const fireOnce = () => {
            if (fired) return;
            fired = true;
            callback();
        };

        // 1. Explicit Removal: Listen specifically to hostName to avoid downloading the entire room on every change
        const unsubscribeName = onValue(ref(db, `${this.roomPath}/hostName`), (snapshot) => {
            if (initialLoad) {
                // On initial load, just record whether hostName exists - don't fire
                initialLoad = false;
                return;
            }
            if (!snapshot.exists()) {
                console.log(`SyncService: Room ${this.roomId} has been deleted (hostName missing).`);
                fireOnce();
            }
        });

        // 2. Grace Period Timeout: 5-minute margin when host disconnects unexpectedly
        let disconnectTimeout = null;
        const unsubscribeDisconnect = onValue(ref(db, `${this.roomPath}/hostDisconnectedAt`), (snapshot) => {
            const disconnectedAt = snapshot.val();
            if (disconnectedAt) {
                // If there's an active timer, don't restart it repeatedly
                if (disconnectTimeout) return;

                const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
                console.log('SyncService: Host disconnected. Starting 5-minute grace period timer...');

                disconnectTimeout = setTimeout(() => {
                    console.log(`SyncService: Host has been disconnected for 5 minutes. Treating room as deleted.`);
                    fireOnce();
                }, gracePeriodMs);
            } else {
                // Host has reconnected (timestamp deleted)
                if (disconnectTimeout) {
                    console.log('SyncService: Host reconnected. 5-minute grace period cancelled.');
                    clearTimeout(disconnectTimeout);
                    disconnectTimeout = null;
                }
            }
        });

        return () => {
            unsubscribeName();
            unsubscribeDisconnect();
            if (disconnectTimeout) clearTimeout(disconnectTimeout);
        };
    }

    subscribeToCategory(callback) {
        if (!db) {
            callback('coffee');
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/category`), (snapshot) => {
            const category = snapshot.val() || 'coffee';
            console.log(`SyncService: Category update received: ${category}`);
            callback(category);
        });
    }

    subscribeToHostName(callback) {
        if (!db) {
            callback(null);
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/hostName`), (snapshot) => {
            const hostName = snapshot.val();
            console.log(`SyncService: Host name update received: ${hostName}`);
            callback(hostName);
        });
    }

    async getRoomCategory() {
        if (!db) return 'coffee';
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/category`));
            return snapshot.val() || 'coffee';
        } catch (e) {
            console.error('SyncService: Failed to get category:', e);
            return 'coffee';
        }
    }

    async setRoomPhase(phase) {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/phase`), phase);
            console.log(`SyncService: Room phase updated to ${phase}`);
        } catch (e) {
            console.error('Failed to set room phase:', e);
        }
    }

    async getRoomPhase() {
        if (!db || !this.roomPath) return null;
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/phase`));
            return snapshot.exists() ? snapshot.val() : null;
        } catch (e) {
            return null;
        }
    }

    subscribeToRoomPhase(callback) {
        if (!db) {
            callback('waiting');
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/phase`), (snapshot) => {
            const phase = snapshot.val() || 'waiting';
            callback(phase);
        });
    }

    _normalizeArray(data) {
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
    }

    async setParticipants(participants) {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/participants`), participants);
            console.log(`SyncService: Participants list updated (${participants.length} items) in room ${this.roomId}`);
        } catch (e) {
            console.error('Failed to set participants:', e);
        }
    }

    subscribeToParticipants(callback) {
        if (!db) {
            callback([]);
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/participants`), (snapshot) => {
            const participants = this._normalizeArray(snapshot.val());
            console.log(`SyncService: Participants update received (${participants.length} items)`);
            callback(participants);
        });
    }

    async setMenuItems(menuItems) {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/menu_items`), menuItems);
            console.log(`SyncService: Menu items list updated (${menuItems.length} items) in room ${this.roomId}`);
        } catch (e) {
            console.error('Failed to set menu items:', e);
        }
    }

    async setMenuByCategory(category, menuItems) {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/menus/${category}`), menuItems);
            // Also update the active legacy path for backwards compatibility with participants
            await this.setMenuItems(menuItems);
            console.log(`SyncService: Menu for ${category} updated (${menuItems.length} items)`);
        } catch (e) {
            console.error('Failed to set menu by category:', e);
        }
    }

    subscribeToMenuItems(callback) {
        if (!db) {
            callback([]);
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/menu_items`), (snapshot) => {
            const menuItems = this._normalizeArray(snapshot.val());
            console.log(`SyncService: Menu items update received (${menuItems.length} items)`);
            callback(menuItems);
        });
    }

    async getParticipants() {
        if (!db) return [];
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/participants`));
            return this._normalizeArray(snapshot.val());
        } catch (e) {
            console.error('SyncService: Failed to get participants:', e);
            return [];
        }
    }

    async getMenuItems() {
        if (!db) return [];
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/menu_items`));
            return this._normalizeArray(snapshot.val());
        } catch (e) {
            console.error('SyncService: Failed to get menu items:', e);
            return [];
        }
    }

    async getMenuByCategory(category) {
        if (!db) return null;
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/menus/${category}`));
            const raw = snapshot.val();
            if (!raw) return null;
            return this._normalizeArray(raw);
        } catch (e) {
            console.error('SyncService: Failed to get menu by category:', e);
            return null;
        }
    }

    /** Clear a single category in menus/ (does not touch menu_items) - used when restoring from history to prevent stale/duplicate data */
    async clearMenuCategory(category) {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/menus/${category}`), null);
            console.log(`SyncService: Cleared menu category ${category}`);
        } catch (e) {
            console.error('SyncService: Failed to clear menu category:', e);
        }
    }

    /**
     * Atomic restore: set one category's menu and clear all others in a single write.
     * Prevents race conditions that cause 2+ tabs to show the same value.
     */
    async restoreMenuFromHistory(category, menuItems) {
        if (!db) return;
        try {
            const baseRef = ref(db, this.roomPath);
            const updates = {
                'menu_items': menuItems,
                'category': category,
                [`menus/${category}`]: menuItems,
            };
            ['coffee', 'meal', 'snack', 'etc'].forEach(c => {
                if (c !== category) updates[`menus/${c}`] = null;
            });
            await update(baseRef, updates);
            console.log(`SyncService: Restored menu for ${category} (atomic), cleared others`);
        } catch (e) {
            console.error('SyncService: restoreMenuFromHistory failed:', e);
        }
    }

    async getSpinTarget() {
        if (!db) return 'people';
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/spin_target`));
            return snapshot.val() || 'people';
        } catch (e) {
            console.error('SyncService: Failed to get spin target:', e);
            return 'people';
        }
    }

    async setSpinTarget(target) {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/spin_target`), target);
            console.log(`SyncService: Spin target updated to ${target}`);
        } catch (e) {
            console.error('Failed to set spin target:', e);
        }
    }

    subscribeToSpinTarget(callback) {
        if (!db) {
            callback('people');
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/spin_target`), (snapshot) => {
            const target = snapshot.val() || 'people';
            console.log(`SyncService: Spin target update received: ${target}`);
            callback(target);
        });
    }

    subscribeToSpinState(callback) {
        if (!db) {
            callback(null);
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/spin_state`), (snapshot) => {
            callback(snapshot.val());
        });
    }

    async startSpin(userName, winnerIndex = null, role = 'participant') {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/spin_state`), {
                isSpinning: true,
                starter: userName,
                starterRole: role,
                winnerIndex: winnerIndex,
                startTime: serverTimestamp()
            });
        } catch (e) {
            console.error('Failed to start spin sync:', e);
        }
    }

    async finishSpin(result) {
        if (!db) return;
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
        if (!this.myId || !db) return;
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

    async removeMyVote() {
        if (!this.myId || !db) return;
        try {
            await set(ref(db, `${this.roomPath}/votes/${this.myId}`), null);
            console.log(`SyncService: Vote removed for user ${this.myId}`);
        } catch (e) {
            console.error('SyncService: Failed to remove vote:', e);
        }
    }

    subscribeToVotes(callback) {
        if (!db) {
            callback([]);
            return () => { };
        }
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
        if (!db) return [];
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
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/votes`), null);
            console.log('SyncService: All votes cleared');
        } catch (e) {
            console.error('SyncService: Failed to clear votes:', e);
        }
    }

    async clearSpinState() {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/spin_state`), null);
            console.log('SyncService: Spin state cleared');
        } catch (e) {
            console.error('SyncService: Failed to clear spin state:', e);
        }
    }

    async finalizeGame(resultData) {
        if (!db) return;
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
        if (!db) {
            callback(null);
            return () => { };
        }
        return onValue(ref(db, `${this.roomPath}/final_results`), (snapshot) => {
            callback(snapshot.val());
        });
    }

    async getFinalResults() {
        if (!db) return null;
        try {
            const snapshot = await get(ref(db, `${this.roomPath}/final_results`));
            return snapshot.exists() ? snapshot.val() : null;
        } catch (e) {
            console.error('SyncService: Failed to get final results:', e);
            return null;
        }
    }

    async clearFinalResults() {
        if (!db) return;
        try {
            await set(ref(db, `${this.roomPath}/final_results`), null);
        } catch (e) {
            console.error('SyncService: Failed to clear final results:', e);
        }
    }

    async checkRoomExists(roomId) {
        if (!db) return false;
        try {
            const snapshot = await get(ref(db, `rooms/${roomId}`));
            return snapshot.exists();
        } catch (e) {
            console.error('SyncService: Failed to check room existence:', e);
            return false;
        }
    }

    async getRoomData(roomId) {
        if (!db) return null;
        try {
            const snapshot = await get(ref(db, `rooms/${roomId}`));
            return snapshot.exists() ? snapshot.val() : null;
        } catch (e) {
            console.error('SyncService: Failed to get room data:', e);
            return null;
        }
    }

    async removeRoom(roomId) {
        if (!db || !roomId) return;
        try {
            await set(ref(db, `rooms/${roomId}`), null);
            console.log(`SyncService: Completely removed room ${roomId}`);
        } catch (e) {
            console.error('SyncService: Failed to remove room:', e);
        }
    }

    async preInitRoom(roomId, data) {
        if (!db) return;
        try {
            await update(ref(db, `rooms/${roomId}`), data);
            console.log(`SyncService: Pre-initialized room ${roomId} with data`, data);
        } catch (e) {
            console.error('SyncService: Failed to pre-init room:', e);
        }
    }

    async setRoomHostPremium(roomId, isPremium) {
        if (!db || !roomId) return;
        try {
            await update(ref(db, `rooms/${roomId}`), { hostIsPremium: !!isPremium });
            console.log(`SyncService: Room ${roomId} hostIsPremium set to ${isPremium}`);
        } catch (e) {
            console.error('SyncService: Failed to set room hostIsPremium', e);
        }
    }

    async clearPresence() {
        if (this.myId && this.roomId && db) {
            try {
                console.log(`SyncService: Manually clearing presence for ${this.myName || this.myId} in room ${this.roomId}`);

                // 0. Stop the .info/connected listener FIRST to prevent it from re-writing presence
                if (this._connectedUnsubscribe) {
                    this._connectedUnsubscribe();
                    this._connectedUnsubscribe = null;
                }

                // 1. Cancel any pending onDisconnect to avoid ghost writes
                const presenceRef = ref(db, `${this.roomPath}/presence/${this.myId}`);
                try {
                    await onDisconnect(presenceRef).cancel();
                } catch (e) {
                    console.warn('SyncService: Failed to cancel onDisconnect:', e);
                }

                // 2. Remove from Firebase presence immediately
                await set(presenceRef, null);

                // 3. Clear local memory state
                this.myName = null;

                // 4. Clear persisted display name so they re-pick next time
                // Keep the my_user_id though, as that's their unique device ID
                await AsyncStorage.removeItem('my_display_name');

                return true;
            } catch (err) {
                console.error('SyncService: Failed to clear presence:', err);
                return false;
            }
        }
        return false;
    }

    /**
     * Clean up stale/ghost presence entries that don't match any participant in the room.
     * Should be called by the host when entering the room.
     * @param {string[]} participantNames - The list of valid participant names
     */
    async cleanupStalePresence(participantNames) {
        if (!db || !this.roomPath) return;
        try {
            const presenceSnapshot = await get(ref(db, `${this.roomPath}/presence`));
            if (!presenceSnapshot.exists()) return;

            const nameLookup = new Set((participantNames || []).map(n => (n || '').trim().toLowerCase()));
            const removePromises = [];

            presenceSnapshot.forEach(child => {
                const userData = child.val();
                const userName = (userData?.name || '').trim().toLowerCase();
                const userId = child.key;

                // Skip our own presence
                if (userId === this.myId) return;

                // If this user's name is not in the participants list, remove their presence
                if (!nameLookup.has(userName) || userName === 'unknown user' || userName === '') {
                    console.log(`SyncService: Removing stale presence: "${userData?.name}" (id: ${userId})`);
                    removePromises.push(set(ref(db, `${this.roomPath}/presence/${userId}`), null));
                }
            });

            if (removePromises.length > 0) {
                await Promise.all(removePromises);
                console.log(`SyncService: Cleaned up ${removePromises.length} stale presence entries`);
            }
        } catch (e) {
            console.error('SyncService: Failed to cleanup stale presence:', e);
        }
    }
}

export const syncService = new SyncService();
