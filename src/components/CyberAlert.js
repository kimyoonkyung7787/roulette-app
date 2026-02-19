import React, { useMemo } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { NeonText } from './NeonText';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react-native';

export const CyberAlert = ({
    visible,
    title = 'ALERT',
    message,
    onConfirm,
    onCancel,
    confirmText = 'CONFIRM',
    cancelText = 'CANCEL',
    type = 'info' // 'info' | 'error' | 'success'
}) => {
    // Making it feel like a guidance/info window by default or using a softer warning color
    const themeColor = type === 'error' ? '#FFD700' : // Gold/Soft Yellow for warning instead of red
        type === 'success' ? Colors.success :
            Colors.primary; // Neon Blue for guidance

    const Icon = type === 'error' ? AlertTriangle :
        type === 'success' ? CheckCircle2 :
            Info;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onCancel || onConfirm}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, {
                    borderColor: themeColor,
                    ...(Platform.OS === 'web' ? { boxShadow: `0 0 15px ${themeColor}66` } : { shadowColor: themeColor })
                }]}>
                    <View style={styles.header}>
                        <Icon color={themeColor} size={20} style={{ marginRight: 10, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <NeonText className="text-xl" style={{ color: themeColor }}>{title}</NeonText>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.content}>
                        <Text style={styles.message}>{message}</Text>
                    </View>

                    <View style={onCancel ? styles.buttonRow : styles.buttonContainer}>
                        {onCancel && (
                            <TouchableOpacity
                                onPress={onCancel}
                                style={[styles.button, onCancel ? styles.sideButton : null, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)' }]}
                            >
                                <Text style={[styles.buttonText, { color: 'rgba(255,255,255,0.6)' }]}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={onConfirm}
                            style={[styles.button, onCancel ? styles.sideButton : null, { backgroundColor: `${themeColor}15`, borderColor: themeColor }]}
                        >
                            <Text style={[styles.buttonText, { color: themeColor }]}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    container: {
        width: '100%',
        maxWidth: 350,
        backgroundColor: '#0a0a0f',
        borderRadius: 16,
        padding: 24,
        borderWidth: 2,
        ...(Platform.OS === 'web' ? { boxShadow: '0 0 10px rgba(0,0,0,0.5)' } : {
            shadowOpacity: 0.3,
            shadowRadius: 10,
        }),
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 20,
    },
    content: {
        marginBottom: 25,
    },
    message: {
        color: 'white',
        fontSize: 15,
        lineHeight: 22,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    buttonContainer: {
        width: '100%',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sideButton: {
        flex: 1,
    },
    buttonText: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 1,
        textAlign: 'center',
        lineHeight: 18,
    }
});
