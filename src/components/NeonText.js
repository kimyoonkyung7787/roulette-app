import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { MotiView } from 'moti';

export const NeonText = ({ children, className, style, ...props }) => {
    // Random delay/duration for slight unique flicker feel if multiple texts are present
    const flickerConfig = useMemo(() => ({
        from: { opacity: 0.95, textShadowRadius: 8 },
        animate: { opacity: 1, textShadowRadius: 12 },
        transition: {
            type: 'timing',
            duration: 1500,
            loop: true,
            repeatReverse: true,
        },
    }), []);

    const textStyle = {
        color: props.color || undefined,
        textShadowColor: props.color ? `${props.color}CC` : 'rgba(0, 255, 255, 0.8)',
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
