import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, Platform, StyleSheet, Animated } from 'react-native';
import { Colors } from '../theme/colors';
import { ChevronRight, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.85)';
const SPOTLIGHT_PADDING = 8;
const TOOLTIP_MARGIN = 16;
const MAX_SPOTLIGHT_HEIGHT = 200;
const USE_NATIVE = Platform.OS !== 'web';

export const CoachMark = ({ steps, visible, onComplete, onSkip }) => {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);
    const [targetLayout, setTargetLayout] = useState(null);
    const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const tooltipAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const sub = Dimensions.addEventListener('change', ({ window }) => {
            setScreenDimensions(window);
        });
        return () => sub?.remove();
    }, []);

    useEffect(() => {
        if (!visible) {
            setCurrentStep(0);
            setTargetLayout(null);
            fadeAnim.setValue(0);
            return;
        }
        Animated.timing(fadeAnim, {
            toValue: 1, duration: 300, useNativeDriver: USE_NATIVE
        }).start();
    }, [visible]);

    const [arrowLayout, setArrowLayout] = useState(null);

    useEffect(() => {
        if (!visible || !steps || steps.length === 0) return;
        tooltipAnim.setValue(0);
        setArrowLayout(null);
        measureTarget();
        startPulse();
    }, [currentStep, visible, steps]);

    const startPulse = () => {
        pulseAnim.setValue(0);
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: USE_NATIVE }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: USE_NATIVE }),
            ])
        ).start();
    };

    const measureElement = useCallback((el, callback) => {
        if (Platform.OS === 'web') {
            requestAnimationFrame(() => {
                try {
                    let node = el;
                    if (el._nativeTag || el.getNode) {
                        node = el.getNode ? el.getNode() : el;
                    }
                    if (node.getBoundingClientRect) {
                        const rect = node.getBoundingClientRect();
                        callback({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
                        return;
                    }
                } catch (e) { /* fallback below */ }
                if (el.measureInWindow) {
                    el.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
                }
            });
        } else {
            setTimeout(() => {
                el.measureInWindow?.((x, y, width, height) => callback({ x, y, width, height }));
            }, 100);
        }
    }, []);

    const measureTarget = useCallback(() => {
        const step = steps[currentStep];
        if (!step?.ref?.current) {
            setTargetLayout(null);
            animateTooltipIn();
            return;
        }

        measureElement(step.ref.current, (layout) => {
            if (layout.height > MAX_SPOTLIGHT_HEIGHT) {
                layout = { ...layout, height: MAX_SPOTLIGHT_HEIGHT };
            }
            setTargetLayout(layout);
            animateTooltipIn();
        });

        if (step.arrowRef?.current) {
            measureElement(step.arrowRef.current, (layout) => {
                setArrowLayout(layout);
            });
        }
    }, [currentStep, steps, measureElement]);

    const animateTooltipIn = () => {
        Animated.spring(tooltipAnim, {
            toValue: 1, friction: 8, tension: 80, useNativeDriver: USE_NATIVE
        }).start();
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            tooltipAnim.setValue(0);
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        Animated.timing(fadeAnim, {
            toValue: 0, duration: 200, useNativeDriver: USE_NATIVE
        }).start(() => {
            setCurrentStep(0);
            setTargetLayout(null);
            onComplete?.();
        });
    };

    const handleSkip = () => {
        Animated.timing(fadeAnim, {
            toValue: 0, duration: 200, useNativeDriver: USE_NATIVE
        }).start(() => {
            setCurrentStep(0);
            setTargetLayout(null);
            onSkip?.();
        });
    };

    if (!visible || !steps || steps.length === 0) return null;

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;
    const { width: sw, height: sh } = screenDimensions;

    const getTooltipPosition = () => {
        if (!targetLayout) return { top: sh / 2 - 60, left: 24, right: 24 };

        const spotBottom = targetLayout.y + targetLayout.height + SPOTLIGHT_PADDING;
        const spotTop = targetLayout.y - SPOTLIGHT_PADDING;
        const spaceBelow = sh - spotBottom;
        const spaceAbove = spotTop;
        const tooltipHeight = 140;

        if (spaceBelow > tooltipHeight + TOOLTIP_MARGIN) {
            return { top: spotBottom + TOOLTIP_MARGIN, left: 24, right: 24, arrow: 'up' };
        } else if (spaceAbove > tooltipHeight + TOOLTIP_MARGIN) {
            return { bottom: sh - spotTop + TOOLTIP_MARGIN, left: 24, right: 24, arrow: 'down' };
        }
        return { top: sh / 2 - 60, left: 24, right: 24, arrow: 'none' };
    };

    const tooltipPos = getTooltipPosition();

    const renderSpotlight = () => {
        if (!targetLayout) return null;

        const spot = {
            left: targetLayout.x - SPOTLIGHT_PADDING,
            top: targetLayout.y - SPOTLIGHT_PADDING,
            width: targetLayout.width + SPOTLIGHT_PADDING * 2,
            height: targetLayout.height + SPOTLIGHT_PADDING * 2,
        };

        if (Platform.OS === 'web') {
            return (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: spot.left,
                        top: spot.top,
                        width: spot.width,
                        height: spot.height,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: Colors.primary,
                        boxShadow: `0 0 0 9999px ${OVERLAY_COLOR}, 0 0 20px ${Colors.primary}88`,
                        zIndex: 1,
                    }}
                />
            );
        }

        return (
            <>
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
                    <View style={{ height: spot.top, backgroundColor: OVERLAY_COLOR }} />
                    <View style={{ flexDirection: 'row', height: spot.height }}>
                        <View style={{ width: spot.left, backgroundColor: OVERLAY_COLOR }} />
                        <Animated.View style={{
                            width: spot.width,
                            height: spot.height,
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: Colors.primary,
                        }} />
                        <View style={{ flex: 1, backgroundColor: OVERLAY_COLOR }} />
                    </View>
                    <View style={{ flex: 1, backgroundColor: OVERLAY_COLOR }} />
                </View>
            </>
        );
    };

    const renderArrow = () => {
        if (!targetLayout || tooltipPos.arrow === 'none') return null;

        const arrowSource = arrowLayout || targetLayout;
        const arrowLeft = Math.min(
            Math.max(arrowSource.x + arrowSource.width / 2 - 8, 32),
            sw - 56
        );

        if (tooltipPos.arrow === 'up') {
            return (
                <View style={{
                    position: 'absolute',
                    top: tooltipPos.top - 8,
                    left: arrowLeft,
                    width: 0, height: 0,
                    borderLeftWidth: 8, borderLeftColor: 'transparent',
                    borderRightWidth: 8, borderRightColor: 'transparent',
                    borderBottomWidth: 8, borderBottomColor: Colors.primary,
                    zIndex: 3,
                }} />
            );
        }
        return null;
    };

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
                <TouchableOpacity
                    activeOpacity={1}
                    style={StyleSheet.absoluteFill}
                    onPress={handleNext}
                >
                    {Platform.OS !== 'web' && !targetLayout && (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: OVERLAY_COLOR }]} />
                    )}

                    {renderSpotlight()}

                    {/* Skip button */}
                    <TouchableOpacity
                        onPress={handleSkip}
                        style={styles.skipButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X color="rgba(255,255,255,0.6)" size={16} />
                        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
                    </TouchableOpacity>

                    {renderArrow()}

                    {/* Tooltip */}
                    <Animated.View style={[
                        styles.tooltipContainer,
                        {
                            top: tooltipPos.top,
                            bottom: tooltipPos.bottom,
                            left: tooltipPos.left,
                            right: tooltipPos.right,
                            opacity: tooltipAnim,
                            transform: [{
                                translateY: tooltipAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [tooltipPos.arrow === 'down' ? -15 : 15, 0]
                                })
                            }]
                        }
                    ]}>
                        <View style={styles.tooltipCard}>
                            {step.icon && (
                                <View style={styles.tooltipIconRow}>
                                    <Text style={styles.tooltipEmoji}>{step.icon}</Text>
                                </View>
                            )}

                            <Text style={styles.tooltipTitle}>{step.title}</Text>
                            <Text style={styles.tooltipMessage}>{step.message}</Text>

                            <View style={styles.tooltipFooter}>
                                {/* Dot indicators */}
                                <View style={styles.dotsContainer}>
                                    {steps.map((_, i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.dot,
                                                i === currentStep ? styles.dotActive : styles.dotInactive,
                                            ]}
                                        />
                                    ))}
                                </View>

                                {/* Next / Done button */}
                                <TouchableOpacity
                                    onPress={handleNext}
                                    style={styles.nextButton}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.nextButtonText}>
                                        {isLastStep ? t('onboarding.done') : t('onboarding.next')}
                                    </Text>
                                    {!isLastStep && (
                                        <ChevronRight color={Colors.background} size={16} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Tap hint */}
                    <View style={styles.tapHint}>
                        <Text style={styles.tapHintText}>{t('onboarding.tap_hint')}</Text>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    skipButton: {
        position: 'absolute',
        top: Platform.OS === 'web' ? 16 : 50,
        right: 20,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 4,
    },
    skipText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '600',
    },
    tooltipContainer: {
        position: 'absolute',
        zIndex: 5,
        maxWidth: 500,
        alignSelf: 'center',
    },
    tooltipCard: {
        backgroundColor: '#0d1117',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        padding: 20,
        ...(Platform.OS === 'web'
            ? { boxShadow: `0 0 25px ${Colors.primary}44, 0 4px 20px rgba(0,0,0,0.5)` }
            : { shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 }
        ),
    },
    tooltipIconRow: {
        alignItems: 'center',
        marginBottom: 8,
    },
    tooltipEmoji: {
        fontSize: 28,
    },
    tooltipTitle: {
        color: Colors.primary,
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 8,
        textAlign: 'center',
    },
    tooltipMessage: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 16,
    },
    tooltipFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotActive: {
        backgroundColor: Colors.primary,
        ...(Platform.OS === 'web'
            ? { boxShadow: `0 0 6px ${Colors.primary}` }
            : { shadowColor: Colors.primary, shadowOpacity: 0.8, shadowRadius: 4 }
        ),
    },
    dotInactive: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 2,
    },
    nextButtonText: {
        color: Colors.background,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    tapHint: {
        position: 'absolute',
        bottom: Platform.OS === 'web' ? 24 : 40,
        alignSelf: 'center',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 5,
    },
    tapHintText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
    },
});
