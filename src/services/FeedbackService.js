import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

function playWebFanfare() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        const ctx = new AudioContext();

        const playNote = (freq, startTime, duration, gain = 0.12) => {
            const harmonics = [1, 2, 3, 4, 5];
            const gains = [1.0, 0.6, 0.3, 0.15, 0.08];

            harmonics.forEach((h, i) => {
                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = i === 0 ? 'sawtooth' : 'square';
                osc.frequency.setValueAtTime(freq * h, startTime);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(3200, startTime);
                filter.Q.setValueAtTime(1.8, startTime);

                const noteGain = gain * gains[i];
                env.gain.setValueAtTime(0, startTime);
                env.gain.linearRampToValueAtTime(noteGain, startTime + 0.04);
                env.gain.setValueAtTime(noteGain, startTime + duration * 0.75);
                env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                osc.connect(filter);
                filter.connect(env);
                env.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + duration);
            });
        };

        // Classic "빵빠레" fanfare: Ta-ta-ta-ta-DAAAA! (C major triumphant brass)
        const t = ctx.currentTime + 0.08;
        // Pickup phrase - bright and punchy
        playNote(523.25, t, 0.18, 0.11);         // C5
        playNote(659.25, t + 0.20, 0.18, 0.11);   // E5
        playNote(783.99, t + 0.40, 0.18, 0.12);  // G5
        playNote(659.25, t + 0.60, 0.12, 0.09);  // E5 (quick)
        // Grand triumphant finale
        playNote(1046.50, t + 0.78, 1.1, 0.16);  // C6 (long, majestic!)

        // Lower octave for depth
        playNote(261.63, t, 0.18, 0.065);
        playNote(329.63, t + 0.20, 0.18, 0.065);
        playNote(392.00, t + 0.40, 0.18, 0.07);
        playNote(523.25, t + 0.78, 1.1, 0.09);

        // Timpani roll + boom on finale
        const timpani = ctx.createOscillator();
        const timpEnv = ctx.createGain();
        timpani.type = 'sine';
        timpani.frequency.setValueAtTime(146.83, t + 0.74);
        timpani.frequency.exponentialRampToValueAtTime(73.42, t + 2.0);
        timpEnv.gain.setValueAtTime(0, t + 0.74);
        timpEnv.gain.linearRampToValueAtTime(0.22, t + 0.82);
        timpEnv.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
        timpani.connect(timpEnv);
        timpEnv.connect(ctx.destination);
        timpani.start(t + 0.74);
        timpani.stop(t + 2.0);

        // Cymbal crash + shimmer
        const bufferSize = ctx.sampleRate * 1.5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(6000, t + 0.74);
        const noiseEnv = ctx.createGain();
        noiseEnv.gain.setValueAtTime(0, t + 0.74);
        noiseEnv.gain.linearRampToValueAtTime(0.05, t + 0.80);
        noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);
        noiseEnv.connect(ctx.destination);
        noise.start(t + 0.74);
        noise.stop(t + 2.2);

        setTimeout(() => ctx.close(), 3500);
        return true;
    } catch (e) {
        console.warn('Web fanfare synthesis failed:', e);
        return false;
    }
}

const FANFARE_URL = 'https://www.orangefreesounds.com/wp-content/uploads/2017/01/Fanfare-sound.mp3';

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

            const [tick, win, start, fanfare] = await Promise.all([
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Note.mp3', 'tick'),
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Complete.mp3', 'win'),
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Bloom.mp3', 'start'),
                loadSound(FANFARE_URL, 'fanfare'),
            ]);

            this.tickSound = tick;
            this.winSound = win;
            this.startSound = start;
            this.fanfareSound = fanfare;

            this.isLoaded = true;
            console.log('✅ FeedbackService: All sounds loaded');
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

    playClick() {
        try {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) { }
    }

    async playFanfare() {
        try {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) { }

        if (playWebFanfare()) return;

        if (this.fanfareSound) {
            try {
                await this.fanfareSound.stopAsync();
                await this.fanfareSound.setPositionAsync(0);
                await this.fanfareSound.playAsync();
                return;
            } catch (e) {
                console.warn('Fanfare play failed, falling back to win sound:', e);
            }
        }

        await this.playSuccess();
    }
}

export const feedbackService = new FeedbackService();
