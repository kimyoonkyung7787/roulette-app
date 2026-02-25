import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withDelay,
    withSequence,
    Easing,
    cancelAnimation
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const CONFETTI_COUNT = 30;
const COLORS = ['#ff6b6b', '#ffd93d', '#6bcbff', '#6bffb8', '#ff6bff', '#00ffff'];

const ConfettiPiece = ({ index }) => {
    const translateY = useSharedValue(-20);
    const translateX = useSharedValue(Math.random() * width);
    const rotate = useSharedValue(0);
    const opacity = useSharedValue(1);

    // Choose a random color
    const color = useMemo(() => COLORS[Math.floor(Math.random() * COLORS.length)], []);
    const size = useMemo(() => Math.random() * 8 + 6, []);
    const shape = useMemo(() => Math.random() > 0.5 ? 'square' : 'circle', []);

    useEffect(() => {
        const duration = Math.random() * 3000 + 2000;
        const delay = Math.random() * 3000;

        translateY.value = withDelay(
            delay,
            withSequence(
                withTiming(height + 50, {
                    duration,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
                }),
                withTiming(-20, { duration: 0 }) // Reset back to top
            )
        );

        rotate.value = withDelay(
            delay,
            withRepeat(
                withTiming(360 * 2, { duration: duration / 2, easing: Easing.linear }),
                5,
                false
            )
        );

        return () => {
            cancelAnimation(translateY);
            cancelAnimation(rotate);
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { translateX: translateX.value },
            { rotate: `${rotate.value}deg` }
        ],
        opacity: opacity.value
    }));

    return (
        <Animated.View
            style={[
                styles.confetti,
                animatedStyle,
                {
                    backgroundColor: color,
                    width: size,
                    height: shape === 'square' ? size : size,
                    borderRadius: shape === 'circle' ? size / 2 : 2,
                }
            ]}
        />
    );
};

export const Confetti = ({ active }) => {
    if (!active) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
            {[...Array(CONFETTI_COUNT)].map((_, i) => (
                <ConfettiPiece key={i} index={i} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    confetti: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1000,
    }
});
