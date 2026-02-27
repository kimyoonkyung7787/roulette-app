import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { NeonText } from './NeonText';
import { Crown, X, Zap } from 'lucide-react-native';

const API_BASE = Platform.OS === 'web'
    ? (typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
        ? 'https://roulette-app-two.vercel.app'
        : (typeof window !== 'undefined' ? window.location.origin : ''))
    : 'https://roulette-app-two.vercel.app';

export const PaywallModal = ({
    visible,
    onClose,
    onSuccess,
    context = 'host', // 'host' | 'participant'
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [payError, setPayError] = useState(null);

    const handlePayWithPayPal = async () => {
        setLoading(true);
        setPayError(null);
        try {
            const baseUrl = API_BASE || 'https://roulette-app-two.vercel.app';
            const returnUrl = `${baseUrl}/paypal-return.html`;
            const cancelUrl = baseUrl + '/';

            const resp = await fetch(`${baseUrl}/api/create-paypal-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: '4.99',
                    currency: 'USD',
                    returnUrl,
                    cancelUrl,
                    baseUrl,
                }),
            });

            const data = await resp.json().catch(() => ({}));
            if (data.approveUrl) {
                const canOpen = await Linking.canOpenURL(data.approveUrl);
                if (canOpen) {
                    await Linking.openURL(data.approveUrl);
                } else {
                    console.warn('PaywallModal: Cannot open PayPal URL');
                }
            } else {
                const errMsg = !resp.ok
                    ? `API 오류 (${resp.status})`
                    : (data.error || '결제 URL을 받지 못했습니다');
                console.error('PaywallModal:', errMsg, data);
                setPayError(errMsg);
            }
        } catch (e) {
            console.error('PaywallModal: PayPal open failed', e);
            setPayError(e.message || '네트워크 오류');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => { setPayError(null); onClose(); }}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <TouchableOpacity
                        onPress={() => { setPayError(null); onClose(); }}
                        style={styles.closeBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <X color="#94a3b8" size={24} />
                    </TouchableOpacity>

                    <View style={styles.iconBox}>
                        <Crown color={Colors.accent} size={48} fill={`${Colors.accent}33`} />
                    </View>

                    <NeonText style={styles.title}>
                        {t('paywall.title')}
                    </NeonText>

                    <Text style={styles.subtitle}>
                        {context === 'host'
                            ? t('paywall.subtitle_host')
                            : t('paywall.subtitle_participant')}
                    </Text>

                    {payError ? (
                        <Text style={styles.errorText}>{payError}</Text>
                    ) : null}
                    <View style={styles.featureList}>
                        <View style={styles.featureRow}>
                            <Zap color={Colors.primary} size={18} />
                            <Text style={styles.featureText}>{t('paywall.feature_1')}</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <Zap color={Colors.primary} size={18} />
                            <Text style={styles.featureText}>{t('paywall.feature_2')}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handlePayWithPayPal}
                        disabled={loading}
                        style={[styles.payButton, loading && styles.payButtonDisabled]}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.payButtonText}>{t('paywall.pay_with_paypal')}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { setPayError(null); onClose(); }} style={styles.cancelBtn}>
                        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#2a2a38',
        borderRadius: 24,
        padding: 28,
        borderWidth: 2,
        borderColor: Colors.primary,
        ...(Platform.OS === 'web' ? { boxShadow: `0 0 25px ${Colors.primary}40` } : {
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 10,
        }),
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1,
    },
    iconBox: {
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        color: Colors.primary,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    featureList: {
        marginBottom: 24,
        gap: 10,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    featureText: {
        color: '#ffffff',
        fontSize: 15,
        flex: 1,
    },
    payButton: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    payButtonDisabled: {
        opacity: 0.7,
    },
    payButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    cancelText: {
        color: '#94a3b8',
        fontSize: 14,
    },
});
