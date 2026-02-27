import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'premium_subscription';
const FREE_MAX_PARTICIPANTS = 4;
const PREMIUM_MAX_PARTICIPANTS = 10;

class SubscriptionService {
    constructor() {
        this._isPremium = null;
    }

    async isPremium() {
        if (this._isPremium !== null) return this._isPremium;
        try {
            const val = await AsyncStorage.getItem(STORAGE_KEY);
            this._isPremium = val === 'true';
            return this._isPremium;
        } catch (e) {
            console.warn('SubscriptionService: Failed to read premium status', e);
            return false;
        }
    }

    async setPremium(value) {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
            this._isPremium = !!value;
        } catch (e) {
            console.error('SubscriptionService: Failed to set premium status', e);
        }
    }

    getMaxParticipants(isPremium) {
        return isPremium ? PREMIUM_MAX_PARTICIPANTS : FREE_MAX_PARTICIPANTS;
    }

    getFreeMax() {
        return FREE_MAX_PARTICIPANTS;
    }

    getPremiumMax() {
        return PREMIUM_MAX_PARTICIPANTS;
    }

    /** 개발/테스트용: 프리미엄 토글 */
    async togglePremiumForDev() {
        const current = await this.isPremium();
        await this.setPremium(!current);
        return !current;
    }
}

export const subscriptionService = new SubscriptionService();
export { FREE_MAX_PARTICIPANTS, PREMIUM_MAX_PARTICIPANTS };
