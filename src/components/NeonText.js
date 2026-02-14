import React from 'react';
import { Text } from 'react-native';

export const NeonText = ({ children, className, ...props }) => {
    return (
        <Text
            className={`text-primary font-bold ${className}`}
            style={{
                textShadowColor: 'rgba(0, 255, 255, 0.8)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
            }}
            {...props}
        >
            {children}
        </Text>
    );
};
