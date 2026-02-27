import React, { useEffect, useRef } from 'react';

// 웹 전용: AdSense만 사용 (react-native-google-mobile-ads는 네이티브 전용)
const ADSENSE_CLIENT_ID = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ADSENSE_CLIENT_ID
    ? process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID
    : 'ca-pub-1704066118536203';
const ADSENSE_SLOT = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ADSENSE_SLOT
    ? process.env.EXPO_PUBLIC_ADSENSE_SLOT
    : '0000000000';

export function AdBanner({ style }) {
    const webAdRef = useRef(null);

    useEffect(() => {
        if (!webAdRef.current || ADSENSE_CLIENT_ID.includes('0000000000000000')) return;
        try {
            const ins = document.createElement('ins');
            ins.className = 'adsbygoogle';
            ins.style.display = 'block';
            ins.setAttribute('data-ad-client', ADSENSE_CLIENT_ID);
            ins.setAttribute('data-ad-slot', ADSENSE_SLOT);
            ins.setAttribute('data-ad-format', 'auto');
            ins.setAttribute('data-full-width-responsive', 'true');
            ins.setAttribute('data-adtest', __DEV__ ? 'on' : 'off');
            webAdRef.current.appendChild(ins);
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            return () => {
                if (ins.parentNode) ins.parentNode.removeChild(ins);
            };
        } catch (e) {
            console.warn('AdBanner: AdSense failed', e?.message);
        }
    }, []);

    if (ADSENSE_CLIENT_ID.includes('0000000000000000')) return null;

    return React.createElement('div', {
        ref: webAdRef,
        style: {
            minHeight: 90,
            textAlign: 'center',
            padding: 8,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            ...(style || {}),
        },
    });
}
