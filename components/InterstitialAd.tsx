import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  Linking, 
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InterstitialAdProps {
  visible: boolean;
  onClose: () => void;
  onAdClick?: () => void;
}

const INTERSTITIAL_ADS = [
  {
    title: "Unlock Premium Features",
    subtitle: "Take your studies to the next level",
    description: "Get advanced analytics, unlimited timers, cloud sync, and exclusive study materials designed for NEET and INICET success.",
    cta: "Start Free Trial",
    backgroundColor: "#4F46E5",
    url: "https://example.com/premium-trial"
  },
  {
    title: "Master Medical Entrance",
    subtitle: "Join 50,000+ successful students",
    description: "Access expert-curated question banks, personalized study plans, and AI-powered performance insights.",
    cta: "Explore Courses",
    backgroundColor: "#059669",
    url: "https://example.com/medical-courses"
  },
  {
    title: "Study Smarter, Not Harder",
    subtitle: "Science-backed learning techniques",
    description: "Discover proven methods like spaced repetition, active recall, and the Pomodoro technique to maximize retention.",
    cta: "Learn More",
    backgroundColor: "#DC2626",
    url: "https://example.com/study-methods"
  }
];

export default function InterstitialAd({ visible, onClose, onAdClick }: InterstitialAdProps) {
  const [currentAd, setCurrentAd] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentAd(Math.floor(Math.random() * INTERSTITIAL_ADS.length));
      setCountdown(5);
      setCanClose(false);
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanClose(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [visible]);

  const handleAdClick = async () => {
    const ad = INTERSTITIAL_ADS[currentAd];
    onAdClick?.();
    
    if (Platform.OS === 'web') {
      window.open(ad.url, '_blank');
    } else {
      await Linking.openURL(ad.url);
    }
  };

  const handleClose = () => {
    if (canClose) {
      onClose();
    }
  };

  if (!visible) return null;

  const ad = INTERSTITIAL_ADS[currentAd];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: ad.backgroundColor }]}>
          {/* Close button */}
          <TouchableOpacity 
            style={[styles.closeButton, !canClose && styles.closeButtonDisabled]} 
            onPress={handleClose}
            disabled={!canClose}
          >
            {canClose ? (
              <Ionicons name="close" size={24} color="#fff" />
            ) : (
              <Text style={styles.countdownText}>{countdown}</Text>
            )}
          </TouchableOpacity>

          {/* Ad content */}
          <View style={styles.content}>
            <Text style={styles.title}>{ad.title}</Text>
            <Text style={styles.subtitle}>{ad.subtitle}</Text>
            <Text style={styles.description}>{ad.description}</Text>
            
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={handleAdClick}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaText}>{ad.cta}</Text>
            </TouchableOpacity>
          </View>

          {/* Ad label */}
          <Text style={styles.adLabel}>Advertisement</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  countdownText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  ctaButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  adLabel: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    fontSize: 10,
    color: '#fff',
    opacity: 0.6,
  },
});