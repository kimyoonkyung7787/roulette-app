import React, { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';

// 웹: AdSense, 네이티브: AdMob
const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

// AdSense (adsense.google.com에서 발급 후 교체)
const ADSENSE_CLIENT_ID = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ADSENSE_CLIENT_ID
    ? process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID
    : 'ca-pub-1704066118536203';
const ADSENSE_SLOT = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ADSENSE_SLOT
    ? process.env.EXPO_PUBLIC_ADSENSE_SLOT
    : '0000000000';

let BannerAd = null;
let BannerAdSize = null;
let TestIds = null;
let mobileAds = null;

if (isNative) {
    try {
        const admob = require('react-native-google-mobile-ads');
        BannerAd = admob.BannerAd;
        BannerAdSize = admob.BannerAdSize;
        TestIds = admob.TestIds;
        mobileAds = admob.default;
    } catch (e) {
        console.warn('AdBanner: AdMob not available', e?.message);
    }
}

// AdMob 앱 ID
const BANNER_UNIT_ID = __DEV__ && TestIds
    ? TestIds.BANNER
    : Platform.select({
          android: 'ca-app-pub-3940256099942544/6300978111',
          ios: 'ca-app-pub-3940256099942544/2934735716',
      });

export function AdBanner({ style }) {
    const webAdRef = useRef(null);

    useEffect(() => {
        if (isNative && mobileAds) {
            mobileAds().initialize();
        }
    }, []);

    // 웹: AdSense 배너
    useEffect(() => {
        if (!isWeb || !webAdRef.current || ADSENSE_CLIENT_ID.includes('0000000000000000')) return;
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
    }, [isWeb]);

    if (isWeb) {
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

    if (!isNative || !BannerAd || !BannerAdSize) {
        return null;
    }

    return (
        <View style={[{ alignItems: 'center', paddingVertical: 8 }, style]}>
            <BannerAd
                unitId={BANNER_UNIT_ID}
                size={BannerAdSize.BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: false,
                }}
            />
        </View>
    );
}
