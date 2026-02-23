import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';
import { MotiView } from 'moti';

const { width, height } = Dimensions.get('window');

export const CyberBackground = ({ children }) => {
    return (
        <View style={styles.container}>
            {/* Base Grid with Pulse */}
            <MotiView
                from={{ opacity: 0.1 }}
                animate={{ opacity: 0.2 }}
                transition={{
                    type: 'timing',
                    duration: 3000,
                    loop: true,
                    repeatReverse: true,
                }}
                style={styles.gridContainer}
            >
                {[...Array(20)].map((_, i) => (
                    <View key={`v-${i}`} style={[styles.vLine, { left: (width / 20) * i }]} />
                ))}
                {[...Array(40)].map((_, i) => (
                    <View key={`h-${i}`} style={[styles.hLine, { top: (height / 40) * i }]} />
                ))}
            </MotiView>

            {/* Moving Scanline Overlay */}
            <MotiView
                from={{ translateY: -height }}
                animate={{ translateY: height }}
                transition={{
                    type: 'timing',
                    duration: 10000,
                    loop: true,
                    repeatReverse: false,
                    easing: (t) => t, // Linear
                }}
                style={[styles.movingScanline, { pointerEvents: 'none' }]}
            />

            {/* Fixed Scanlines Effect */}
            <View style={[styles.scanlines, { pointerEvents: 'none' }]} />

            {/* Overlay Gradientish Glow */}
            <View style={[styles.glow, { pointerEvents: 'none' }]} />

            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        overflow: 'hidden',
    },
    gridContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    vLine: {
        position: 'absolute',
        width: 1,
        height: '100%',
        backgroundColor: Colors.primary,
        opacity: 0.15,
    },
    hLine: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: Colors.primary,
        opacity: 0.15,
    },
    movingScanline: {
        position: 'absolute',
        width: '100%',
        height: 100,
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
        zIndex: 5,
    },
    scanlines: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        zIndex: 100,
        opacity: 0.1,
    },
    glow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        backgroundColor: 'rgba(0, 255, 255, 0.02)',
    }
});
