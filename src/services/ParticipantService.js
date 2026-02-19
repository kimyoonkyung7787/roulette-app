import AsyncStorage from '@react-native-async-storage/async-storage';

const PARTICIPANTS_KEY = '@roulette_participants';

class ParticipantService {
    async saveParticipants(participants) {
        try {
            await AsyncStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants));
        } catch (e) {
            console.error('Error saving participants:', e);
        }
    }

    async getParticipants() {
        try {
            const jsonValue = await AsyncStorage.getItem(PARTICIPANTS_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : [{ name: '참여자 1', weight: 1 }, { name: '참여자 2', weight: 1 }];
        } catch (e) {
            console.error('Error getting participants:', e);
            return [{ name: '참여자 1', weight: 1 }, { name: '참여자 2', weight: 1 }];
        }
    }
}

export const participantService = new ParticipantService();
