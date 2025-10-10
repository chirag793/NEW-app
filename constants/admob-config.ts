// AdMob configuration
import Constants from 'expo-constants';

const envExtra = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};

function envVar(name: string) {
  // Prefer process.env (set during local dev or CI), then expoConfig.extra (set by EAS build-time injection)
  return process.env[name as keyof NodeJS.ProcessEnv] || (envExtra[name] as string) || '';
}

export const admobConfig = {
  appId: envVar('EXPO_PUBLIC_ADMOB_APP_ID'),
  banner: {
    ios: envVar('EXPO_PUBLIC_ADMOB_BANNER_IOS'),
    android: envVar('EXPO_PUBLIC_ADMOB_BANNER_ANDROID'),
  },
  interstitial: {
    ios: envVar('EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS'),
    android: envVar('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID'),
  },
  rewarded: {
    ios: envVar('EXPO_PUBLIC_ADMOB_REWARDED_IOS'),
    android: envVar('EXPO_PUBLIC_ADMOB_REWARDED_ANDROID'),
  }
};
