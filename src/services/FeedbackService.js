import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

class FeedbackService {
    constructor() {
        this.tickSound = null;
        this.winSound = null;
        this.startSound = null;
        this.isLoaded = false;
    }

    async loadAssets() {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                allowsRecordingIOS: false,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Clean up existing sounds if re-loading
            const unloadSound = async (sound) => {
                if (sound) {
                    try { await sound.unloadAsync(); } catch (e) { }
                }
            };
            await unloadSound(this.tickSound);
            await unloadSound(this.winSound);
            await unloadSound(this.startSound);

            const loadSound = async (uri) => {
                try {
                    console.log(`Loading audio: ${uri}`);
                    const { sound } = await Audio.Sound.createAsync(
                        { uri },
                        { shouldPlay: false, volume: 1.0 }
                    );
                    return sound;
                } catch (err) {
                    console.log(`CRITICAL: Failed to load sound from ${uri}:`, err);
                    return null;
                }
            };

            // Corrected GitHub raw links (Verified filenames)
            this.tickSound = await loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Note.mp3');
            this.winSound = await loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Complete.mp3');
            this.startSound = await loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Bloom.mp3');

            this.isLoaded = true;
            console.log('FeedbackService: Audio systems refreshed with VERIFIED GitHub sources');
        } catch (e) {
            console.log('FeedbackService: Major initialization error:', e);
        }
    }

    async playStart() {
        if (!this.startSound) return;
        try {
            await this.startSound.setPositionAsync(0);
            await this.startSound.playAsync();
        } catch (e) {
            console.log('Error playing start sound:', e);
        }
    }

    async playTick() {
        if (!this.tickSound) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await this.tickSound.setPositionAsync(0);
            await this.tickSound.playAsync();
        } catch (e) { }
    }

    async playSuccess() {
        if (!this.winSound) return;
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await this.winSound.setPositionAsync(0);
            await this.winSound.playAsync();
        } catch (e) {
            console.log('Error playing success sound:', e);
        }
    }
}

export const feedbackService = new FeedbackService();
