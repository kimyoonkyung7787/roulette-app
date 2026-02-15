import React from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Colors } from '../theme/colors';
import { NeonText } from './NeonText';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react-native';

export const CyberAlert = ({
    visible,
    title = 'ALERT',
    message,
    onConfirm,
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
            onRequestClose={onConfirm}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { borderColor: themeColor, shadowColor: themeColor }]}>
                    <View style={styles.header}>
                        <Icon color={themeColor} size={20} style={{ marginRight: 10 }} />
                        <NeonText className="text-xl" style={{ color: themeColor }}>{title}</NeonText>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.content}>
                        <Text style={styles.message}>{message}</Text>
                    </View>

                    <TouchableOpacity
                        onPress={onConfirm}
                        style={[styles.button, { backgroundColor: `${themeColor}15`, borderColor: themeColor }]}
                    >
                        <Text style={[styles.buttonText, { color: themeColor }]}>CONFIRM</Text>
                    </TouchableOpacity>
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
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
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
    button: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
    }
});
