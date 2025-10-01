// AdMob configuration
export const admobConfig = {
  appId: process.env.EXPO_PUBLIC_ADMOB_APP_ID,
  banner: {
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
  },
  interstitial: {
    ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
  },
  rewarded: {
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
  }
};
