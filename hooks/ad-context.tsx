import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';

interface AdManagerState {
  showBannerAds: boolean;
  showInterstitialAds: boolean;
  interstitialAdVisible: boolean;
  sessionCount: number;
  lastInterstitialTime: number;
}

const AD_CONFIG = {
  SESSIONS_BETWEEN_INTERSTITIALS: 3, // Show interstitial every 3 app sessions
  MIN_TIME_BETWEEN_INTERSTITIALS: 5 * 60 * 1000, // 5 minutes minimum between interstitials
  BANNER_AD_FREQUENCY: 0.8, // 80% chance to show banner ads
};

export const [AdProvider, useAdManager] = createContextHook(() => {
  const [adState, setAdState] = useState<AdManagerState>({
    showBannerAds: true,
    showInterstitialAds: true, // Enable by default
    interstitialAdVisible: false,
    sessionCount: 0,
    lastInterstitialTime: 0,
  });

  const updateAdState = useCallback((updates: Partial<AdManagerState>) => {
    setAdState(prev => {
      const newState = { ...prev, ...updates };
      // Save to AsyncStorage asynchronously without blocking
      AsyncStorage.setItem('adManagerState', JSON.stringify(newState)).catch(error => {
        console.log('Error saving ad state:', error);
      });
      return newState;
    });
  }, []);

  // Load state only once on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadAdState = async () => {
      try {
        const stored = await AsyncStorage.getItem('adManagerState');
        if (!isMounted) return;
        
        if (stored && stored.trim()) {
          try {
            const parsedState = JSON.parse(stored);
            if (isMounted) {
              setAdState(prev => ({
                ...prev,
                ...parsedState,
                interstitialAdVisible: false, // Never restore visible state
                sessionCount: (parsedState.sessionCount || 0) + 1, // Increment session count
              }));
            }
          } catch (parseError) {
            console.log('JSON parse error, clearing corrupted data:', parseError);
            await AsyncStorage.removeItem('adManagerState');
            if (isMounted) {
              setAdState(prev => ({ ...prev, sessionCount: 1 }));
            }
          }
        } else {
          // First session or empty data
          if (isMounted) {
            setAdState(prev => ({ ...prev, sessionCount: 1 }));
          }
        }
      } catch (error) {
        console.log('Error loading ad state:', error);
        if (isMounted) {
          setAdState(prev => ({ ...prev, sessionCount: 1 }));
        }
      }
    };
    
    loadAdState();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once

  const shouldShowBannerAd = useCallback((): boolean => {
    return adState.showBannerAds;
  }, [adState.showBannerAds]);

  const shouldShowInterstitialAd = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastAd = now - adState.lastInterstitialTime;
    const sessionThresholdMet = adState.sessionCount % AD_CONFIG.SESSIONS_BETWEEN_INTERSTITIALS === 0;
    const timeThresholdMet = timeSinceLastAd > AD_CONFIG.MIN_TIME_BETWEEN_INTERSTITIALS;
    
    return adState.showInterstitialAds && sessionThresholdMet && timeThresholdMet && adState.sessionCount > 0;
  }, [adState.showInterstitialAds, adState.sessionCount, adState.lastInterstitialTime]);

  const showInterstitialAd = useCallback(() => {
    setAdState(prev => {
      if (shouldShowInterstitialAd() && !prev.interstitialAdVisible) {
        const newState = { 
          ...prev,
          interstitialAdVisible: true,
          lastInterstitialTime: Date.now()
        };
        AsyncStorage.setItem('adManagerState', JSON.stringify(newState)).catch(error => {
          console.log('Error saving ad state:', error);
        });
        return newState;
      }
      return prev;
    });
  }, [shouldShowInterstitialAd]);

  const hideInterstitialAd = useCallback(() => {
    updateAdState({ interstitialAdVisible: false });
  }, [updateAdState]);

  const disableBannerAds = useCallback(() => {
    updateAdState({ showBannerAds: false });
  }, [updateAdState]);

  const enableBannerAds = useCallback(() => {
    updateAdState({ showBannerAds: true });
  }, [updateAdState]);

  const disableInterstitialAds = useCallback(() => {
    updateAdState({ showInterstitialAds: false });
  }, [updateAdState]);

  const enableInterstitialAds = useCallback(() => {
    updateAdState({ showInterstitialAds: true });
  }, [updateAdState]);

  // Trigger interstitial ads on certain actions
  const triggerInterstitialOnAction = useCallback((action: 'timer_complete' | 'test_complete' | 'session_start') => {
    console.log(`Ad trigger: ${action}`);
    
    // Different triggers for different actions
    switch (action) {
      case 'timer_complete':
      case 'test_complete':
        // Show ad after completing activities
        setTimeout(() => {
          showInterstitialAd();
        }, 1000);
        break;
      case 'session_start':
        // Show ad at session start (with delay)
        setTimeout(() => {
          showInterstitialAd();
        }, 3000);
        break;
    }
  }, [showInterstitialAd]);

  return useMemo(() => ({
    // State
    showBannerAds: adState.showBannerAds,
    showInterstitialAds: adState.showInterstitialAds,
    interstitialAdVisible: adState.interstitialAdVisible,
    sessionCount: adState.sessionCount,
    
    // Methods
    shouldShowBannerAd,
    shouldShowInterstitialAd,
    showInterstitialAd,
    hideInterstitialAd,
    disableBannerAds,
    enableBannerAds,
    disableInterstitialAds,
    enableInterstitialAds,
    triggerInterstitialOnAction,
  }), [
    adState.showBannerAds,
    adState.showInterstitialAds,
    adState.interstitialAdVisible,
    adState.sessionCount,
    shouldShowBannerAd,
    shouldShowInterstitialAd,
    showInterstitialAd,
    hideInterstitialAd,
    disableBannerAds,
    enableBannerAds,
    disableInterstitialAds,
    enableInterstitialAds,
    triggerInterstitialOnAction,
  ]);
});