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
            return jsonValue != null ? JSON.parse(jsonValue) : [{ name: 'Participant 1', weight: 1 }, { name: 'Participant 2', weight: 1 }];
        } catch (e) {
            console.error('Error getting participants:', e);
            return [{ name: 'Participant 1', weight: 1 }, { name: 'Participant 2', weight: 1 }];
        }
    }
}

export const participantService = new ParticipantService();
