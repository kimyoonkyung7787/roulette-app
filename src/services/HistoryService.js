import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@roulette_history';

class HistoryService {
    async addWinner(name, type, details = [], originalList = [], roomId = '', category = '') {
        try {
            console.log('HistoryService: Adding winner to history:', name, type, roomId);
            const history = await this.getHistory();
            const newEntry = {
                id: Date.now().toString(),
                name,
                type: type || 'people',
                details,
                originalList,
                roomId,
                category,
                timestamp: new Date().toISOString(),
            };
            const updatedHistory = [newEntry, ...history].slice(0, 50); // Keep last 50
            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
            console.log('HistoryService: Winner saved successfully. Total entries:', updatedHistory.length);
            return updatedHistory;
        } catch (e) {
            console.log('Error adding winner to history:', e);
            return [];
        }
    }

    async getEntryById(id) {
        try {
            const history = await this.getHistory();
            if (!Array.isArray(history)) return undefined;
            return history.find(entry => entry && entry.id === id);
        } catch (e) {
            console.log('Error getting entry by id:', e);
            return undefined;
        }
    }

    async getHistory() {
        try {
            const jsonValue = await AsyncStorage.getItem(HISTORY_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.log('Error getting history:', e);
            return [];
        }
    }

    async clearHistory() {
        try {
            await AsyncStorage.removeItem(HISTORY_KEY);
        } catch (e) {
            console.log('Error clearing history:', e);
        }
    }
}

export const historyService = new HistoryService();
