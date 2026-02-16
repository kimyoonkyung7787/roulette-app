import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

class FeedbackService {
    constructor() {
        this.tickSound = null;
        this.winSound = null;
        this.startSound = null;
        this.fanfareSound = null;
        this.isLoaded = false;
    }

    async loadAssets() {
        try {
            console.log('🎵 FeedbackService: Starting loadAssets...');

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
            await unloadSound(this.fanfareSound);

            const loadSound = async (uri) => {
                try {
                    console.log(`🎵 Loading audio: ${uri}`);
                    const { sound } = await Audio.Sound.createAsync(
                        { uri },
                        { shouldPlay: false, volume: 1.0 }
                    );
                    console.log(`✅ Successfully loaded: ${uri}`);
                    return sound;
                } catch (err) {
                    console.error(`❌ CRITICAL: Failed to load sound from ${uri}:`, err);
                    return null;
                }
            };

            // Try multiple fanfare sources for reliability
            const fanfareSources = [
                'https://cdn.freesound.org/previews/536/536108_11861866-lq.mp3',
                'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg',
                'https://actions.google.com/sounds/v1/cartoon/trumpet_fanfare.ogg'
            ];

            // Try loading fanfare from multiple sources
            for (const source of fanfareSources) {
                console.log(`🎺 Attempting to load fanfare from: ${source}`);
                this.fanfareSound = await loadSound(source);
                if (this.fanfareSound) {
                    console.log(`✅ Fanfare loaded successfully from: ${source}`);
                    break;
                }
            }

            // Load other sounds with original macOS system sounds
            this.tickSound = await loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Note.mp3');
            this.winSound = await loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Complete.mp3');
            this.startSound = await loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Bloom.mp3');

            // Only set isLoaded to true if fanfareSound loaded successfully
            if (this.fanfareSound) {
                this.isLoaded = true;
                console.log('✅ FeedbackService: Audio systems loaded successfully');
                console.log('✅ fanfareSound loaded:', !!this.fanfareSound);
            } else {
                this.isLoaded = false;
                console.error('❌ FeedbackService: Failed to load fanfareSound from all sources!');
            }
        } catch (e) {
            this.isLoaded = false;
            console.error('❌ FeedbackService: Major initialization error:', e);
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

    async playFanfare() {
        console.log('🎺 FeedbackService.playFanfare called');
        console.log('🎺 fanfareSound exists:', !!this.fanfareSound);
        console.log('🎺 isLoaded:', this.isLoaded);

        if (!this.fanfareSound) {
            console.warn('🎺 WARNING: fanfareSound is null! Using vibration fallback.');
            // Fallback to strong vibration if sound not loaded
            try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                await new Promise(resolve => setTimeout(resolve, 100));
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                await new Promise(resolve => setTimeout(resolve, 100));
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                console.log('🎺 Vibration fallback completed');
            } catch (e) {
                console.error('🎺 Even vibration failed:', e);
            }
            return; // Don't throw error, just return
        }

        try {
            console.log('🎺 Playing haptic feedback...');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            console.log('🎺 Resetting audio position...');
            await this.fanfareSound.setPositionAsync(0);

            console.log('🎺 Starting playback...');
            await this.fanfareSound.playAsync();

            console.log('🎺 Fanfare playback started successfully!');
        } catch (e) {
            console.error('🎺 Error playing fanfare sound:', e);
            // Fallback to vibration on playback error
            console.log('🎺 Using vibration fallback due to playback error');
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
    }
}

export const feedbackService = new FeedbackService();
