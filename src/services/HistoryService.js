import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@roulette_history';

class HistoryService {
    async addWinner(name, type, details = []) {
        try {
            console.log('HistoryService: Adding winner to history:', name, type);
            const history = await this.getHistory();
            const newEntry = {
                id: Date.now().toString(),
                name,
                type: type || 'people',
                details,
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
