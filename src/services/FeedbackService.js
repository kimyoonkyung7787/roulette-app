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
            // Brass-like tone: fundamental + harmonics
            const harmonics = [1, 2, 3, 4, 5];
            const gains = [1.0, 0.6, 0.3, 0.15, 0.08];

            harmonics.forEach((h, i) => {
                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = i === 0 ? 'sawtooth' : 'square';
                osc.frequency.setValueAtTime(freq * h, startTime);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(3000, startTime);
                filter.Q.setValueAtTime(1.5, startTime);

                const noteGain = gain * gains[i];
                env.gain.setValueAtTime(0, startTime);
                env.gain.linearRampToValueAtTime(noteGain, startTime + 0.03);
                env.gain.setValueAtTime(noteGain, startTime + duration * 0.7);
                env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                osc.connect(filter);
                filter.connect(env);
                env.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + duration);
            });
        };

        // Classic fanfare: "Ta-da-da-DAAAA!" (C major brass fanfare)
        const t = ctx.currentTime + 0.05;
        // Short pickup notes
        playNote(523.25, t, 0.15, 0.10);         // C5 (short)
        playNote(659.25, t + 0.15, 0.15, 0.10);  // E5 (short)
        playNote(783.99, t + 0.30, 0.15, 0.12);  // G5 (short)
        // Grand sustained note
        playNote(1046.50, t + 0.48, 0.8, 0.15);  // C6 (long, triumphant!)

        // Supportive lower octave (depth)
        playNote(261.63, t, 0.15, 0.06);          // C4
        playNote(329.63, t + 0.15, 0.15, 0.06);   // E4
        playNote(392.00, t + 0.30, 0.15, 0.07);   // G4
        playNote(523.25, t + 0.48, 0.8, 0.08);    // C5

        // Timpani-like boom on the final note
        const timpani = ctx.createOscillator();
        const timpEnv = ctx.createGain();
        timpani.type = 'sine';
        timpani.frequency.setValueAtTime(130.81, t + 0.46);
        timpani.frequency.exponentialRampToValueAtTime(65, t + 1.3);
        timpEnv.gain.setValueAtTime(0, t + 0.46);
        timpEnv.gain.linearRampToValueAtTime(0.2, t + 0.50);
        timpEnv.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
        timpani.connect(timpEnv);
        timpEnv.connect(ctx.destination);
        timpani.start(t + 0.46);
        timpani.stop(t + 1.3);

        // Cymbal shimmer
        const bufferSize = ctx.sampleRate * 1.2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(8000, t + 0.46);
        const noiseEnv = ctx.createGain();
        noiseEnv.gain.setValueAtTime(0, t + 0.46);
        noiseEnv.gain.linearRampToValueAtTime(0.04, t + 0.50);
        noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);
        noiseEnv.connect(ctx.destination);
        noise.start(t + 0.46);
        noise.stop(t + 1.5);

        setTimeout(() => ctx.close(), 2500);
        return true;
    } catch (e) {
        console.warn('Web fanfare synthesis failed:', e);
        return false;
    }
}

class FeedbackService {
    constructor() {
        this.tickSound = null;
        this.winSound = null;
        this.startSound = null;
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

            const [tick, win, start] = await Promise.all([
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Note.mp3', 'tick'),
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Complete.mp3', 'win'),
                loadSound('https://raw.githubusercontent.com/extratone/macOSsystemsounds/main/mp3/Bloom.mp3', 'start'),
            ]);

            this.tickSound = tick;
            this.winSound = win;
            this.startSound = start;

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

        await this.playSuccess();
    }
}

export const feedbackService = new FeedbackService();
