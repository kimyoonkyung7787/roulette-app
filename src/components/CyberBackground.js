import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

export const CyberBackground = ({ children }) => {
    return (
        <View style={styles.container}>
            {/* Base Grid */}
            <View style={styles.gridContainer}>
                {[...Array(20)].map((_, i) => (
                    <View key={`v-${i}`} style={[styles.vLine, { left: (width / 20) * i }]} />
                ))}
                {[...Array(40)].map((_, i) => (
                    <View key={`h-${i}`} style={[styles.hLine, { top: (height / 40) * i }]} />
                ))}
            </View>

            {/* Scanlines Effect */}
            <View style={styles.scanlines} pointerEvents="none" />

            {/* Overlay Gradientish Glow */}
            <View style={styles.glow} pointerEvents="none" />

            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    gridContainer: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.15,
    },
    vLine: {
        position: 'absolute',
        width: 1,
        height: '100%',
        backgroundColor: Colors.primary,
    },
    hLine: {
        position: 'absolute',
        width: '100%',
        height: 1,
        backgroundColor: Colors.primary,
    },
    scanlines: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
        backgroundSize: '100% 4px, 3px 100%',
        zIndex: 100,
        opacity: 0.1,
    },
    glow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        // Note: Radial gradients are tricky in RN without extra libs, 
        // using a subtle semi-transparent overlay for now
        backgroundColor: 'rgba(0, 255, 255, 0.02)',
    }
});
