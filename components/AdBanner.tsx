import React, { useState, useEffect, memo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

interface AdBannerProps {
  size?: 'small' | 'medium' | 'large';
  position?: 'top' | 'bottom';
  onClose?: () => void;
  closeable?: boolean;
  /** Optional ad unit id — prefer build-time ENV injection (EXPO_PUBLIC_*) */
  adUnitId?: string;
}

const AD_CONTENT = [
  {
    title: "Boost Your Study Performance",
    description: "Get premium study tools and analytics",
    cta: "Upgrade Now",
    color: "#4F46E5",
    url: "https://example.com/premium"
  },
  {
    title: "NEET Preparation Course",
    description: "Join thousands of successful students",
    cta: "Learn More",
    color: "#059669",
    url: "https://example.com/neet-course"
  },
  {
    title: "Study Timer Pro",
    description: "Advanced focus techniques & analytics",
    cta: "Try Free",
    color: "#DC2626",
    url: "https://example.com/timer-pro"
  },
  {
    title: "Medical Entrance Prep",
    description: "Expert guidance for INICET success",
    cta: "Start Now",
    color: "#7C3AED",
    url: "https://example.com/inicet-prep"
  }
];

const AdBanner = memo(function AdBanner({ 
  size = 'medium', 
  position = 'bottom',
  onClose,
  closeable = true 
  , adUnitId
}: AdBannerProps) {
  const [currentAd, setCurrentAd] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // Determine ad unit id from prop, environment, or expo constants (build-time injection)
  const env = Constants.expoConfig?.extra || {};
  const injectedAndroid = process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || (env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID as string) || '';
  const injectedIOS = process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || (env.EXPO_PUBLIC_ADMOB_BANNER_IOS as string) || '';
  const resolvedAdUnitId = adUnitId || (Platform.OS === 'android' ? injectedAndroid : injectedIOS) || '';

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set new interval
    intervalRef.current = setInterval(() => {
      setCurrentAd((prev) => (prev + 1) % AD_CONTENT.length);
    }, 8000); // Change ad every 8 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleAdClick = async () => {
    const ad = AD_CONTENT[currentAd];
    if (Platform.OS === 'web') {
      window.open(ad.url, '_blank');
    } else {
      await Linking.openURL(ad.url);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  const ad = AD_CONTENT[currentAd];
  const sizeStyles = getSizeStyles(size);

  // If a real ad unit id is present, render a lightweight placeholder so build-time
  // injected IDs are used and no hardcoded IDs exist in source. This avoids adding
  // an ad SDK here; when ready, swap in expo-ads-admob or similar.
  if (resolvedAdUnitId && Platform.OS !== 'web') {
    const masked = resolvedAdUnitId.replace(/(.{6}).+(.{6})/, '$1…$2');
    return (
      <View style={[styles.container, sizeStyles.container, position === 'top' && styles.topPosition]}>
        <TouchableOpacity
          style={[styles.adContent, { backgroundColor: '#222' }, sizeStyles.content]}
          onPress={handleAdClick}
          activeOpacity={0.8}
        >
          <View style={styles.textContainer}>
            <Text style={[styles.title, sizeStyles.title]}>AdMob Banner</Text>
            <Text style={[styles.description, sizeStyles.description]}>Unit: {masked}</Text>
          </View>
          <View style={styles.ctaContainer}>
            <Text style={[styles.cta, sizeStyles.cta]}>Sponsored</Text>
          </View>
        </TouchableOpacity>

        {closeable && (
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={16} color="#666" />
          </TouchableOpacity>
        )}

        <Text style={styles.adLabel}>Ad</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, sizeStyles.container, position === 'top' && styles.topPosition]}>
      <TouchableOpacity 
        style={[styles.adContent, { backgroundColor: ad.color }, sizeStyles.content]}
        onPress={handleAdClick}
        activeOpacity={0.8}
      >
        <View style={styles.textContainer}>
          <Text style={[styles.title, sizeStyles.title]} numberOfLines={1}>
            {ad.title}
          </Text>
          <Text style={[styles.description, sizeStyles.description]} numberOfLines={size === 'small' ? 1 : 2}>
            {ad.description}
          </Text>
        </View>
        <View style={styles.ctaContainer}>
          <Text style={[styles.cta, sizeStyles.cta]}>{ad.cta}</Text>
        </View>
      </TouchableOpacity>
      
      {closeable && (
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={16} color="#666" />
        </TouchableOpacity>
      )}
      
      <Text style={styles.adLabel}>Ad</Text>
    </View>
  );
});

function getSizeStyles(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return {
        container: { height: 60 },
        content: { paddingHorizontal: 12, paddingVertical: 8 },
        title: { fontSize: 12, fontWeight: '600' as const },
        description: { fontSize: 10 },
        cta: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 4 }
      };
    case 'large':
      return {
        container: { height: 120 },
        content: { paddingHorizontal: 20, paddingVertical: 16 },
        title: { fontSize: 18, fontWeight: '700' as const },
        description: { fontSize: 14 },
        cta: { fontSize: 14, paddingHorizontal: 16, paddingVertical: 8 }
      };
    default: // medium
      return {
        container: { height: 80 },
        content: { paddingHorizontal: 16, paddingVertical: 12 },
        title: { fontSize: 14, fontWeight: '600' as const },
        description: { fontSize: 12 },
        cta: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 6 }
      };
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    marginVertical: 8,
  },
  topPosition: {
    marginTop: 0,
    marginBottom: 16,
  },
  adContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#fff',
    marginBottom: 2,
  },
  description: {
    color: '#fff',
    opacity: 0.9,
  },
  ctaContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  cta: {
    color: '#fff',
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  closeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  adLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 8,
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
});

export default AdBanner;