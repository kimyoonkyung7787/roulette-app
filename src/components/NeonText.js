import React, { useMemo } from 'react';
import { Text, Platform } from 'react-native';
import { MotiView } from 'moti';

export const NeonText = ({ children, className, style, ...props }) => {
    const isWeb = Platform.OS === 'web';
    const baseColor = props.color || '#00ffff'; // Default neon blue
    const glowColor = props.color ? `${props.color}CC` : 'rgba(0, 255, 255, 0.8)';

    // Random delay/duration for slight unique flicker feel if multiple texts are present
    const flickerConfig = useMemo(() => ({
        from: {
            opacity: 0.95,
            ...(isWeb ? { textShadow: `0 0 8px ${glowColor}` } : { textShadowRadius: 8 })
        },
        animate: {
            opacity: 1,
            ...(isWeb ? { textShadow: `0 0 12px ${glowColor}` } : { textShadowRadius: 12 })
        },
        transition: {
            type: 'timing',
            duration: 1500,
            loop: true,
            repeatReverse: true,
        },
    }), [isWeb, glowColor]);

    const textStyle = isWeb ? {
        color: props.color || undefined,
        textShadow: `0 0 10px ${glowColor}`,
    } : {
        color: props.color || undefined,
        textShadowColor: glowColor,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    };

    return (
        <MotiView
            from={flickerConfig.from}
            animate={flickerConfig.animate}
            transition={flickerConfig.transition}
        >
            <Text
                className={`${!props.color ? 'text-primary' : ''} font-bold ${className || ''}`}
                style={[textStyle, style]}
                {...props}
            >
                {children}
            </Text>
        </MotiView>
    );
};
