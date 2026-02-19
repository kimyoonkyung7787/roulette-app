import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

class FeedbackService {
    constructor() {
        this.tickSound = null;
        this.winSound = null;
        this.startSound = null;
        this.fanfareSound = null;
        this.isLoaded = false;
        this._lastTickTime = 0;
        this._lastDrumTime = 0;
    }

    async loadAssets() {
        if (this.isLoaded) return;

        try {
            console.log('🎵 FeedbackService: Starting loadAssets...');

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });

            const loadSound = async (uri, name) => {
                try {
                    const { sound } = await Audio.Sound.createAsync(
                        { uri },
                        { shouldPlay: false, volume: 1.0 }
                    );
                    console.log(`✅ ${name} loaded successfully`);
                    return sound;
                } catch (err) {
                    console.warn(`⚠️ Failed to load ${name}: ${uri}`);
                    return null;
                }
            };

            // Using original reliable GitHub sources (extratone repository)
            const [tick, win, start, fanfare] = await Promise.all([
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Note.mp3', 'tick'),
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Complete.mp3', 'win'),
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Bloom.mp3', 'start'),
                loadSound('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3', 'fanfare')
            ]);

            this.tickSound = tick;
            this.winSound = win;
            this.startSound = start;
            this.fanfareSound = fanfare;

            this.isLoaded = true;
            console.log('✅ FeedbackService: All original sounds restored');
        } catch (e) {
            console.error('❌ FeedbackService: Major initialization error:', e);
        }
    }

    async playStart() {
        if (!this.startSound) return;
        try {
            await this.startSound.setPositionAsync(0);
            await this.startSound.playAsync();
        } catch (e) { }
    }

    async playTick() {
        if (!this.tickSound) return;
        const now = Date.now();
        if (now - this._lastTickTime < 50) return;
        this._lastTickTime = now;

        try {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await this.tickSound.stopAsync();
            await this.tickSound.setPositionAsync(0);
            await this.tickSound.playAsync();
        } catch (e) { }
    }

    async playDrum() {
        // Fallback to tick sound for drum beats to ensure it works
        if (!this.tickSound) return;
        const now = Date.now();
        if (now - this._lastDrumTime < 300) return;
        this._lastDrumTime = now;

        try {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await this.tickSound.stopAsync();
            await this.tickSound.setPositionAsync(0);
            await this.tickSound.playAsync();
        } catch (e) { }
    }

    async playSuccess() {
        if (!this.winSound) return;
        try {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await this.winSound.stopAsync();
            await this.winSound.setPositionAsync(0);
            await this.winSound.playAsync();
        } catch (e) { }
    }

    async playFanfare() {
        if (this.fanfareSound) {
            try {
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await this.fanfareSound.stopAsync();
                await this.fanfareSound.setPositionAsync(0);
                await this.fanfareSound.playAsync();
                return;
            } catch (e) { }
        }
        this.playSuccess();
    }
}

export const feedbackService = new FeedbackService();
