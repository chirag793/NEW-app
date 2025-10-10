export const AUTH_CONFIG = {
  // Google OAuth Configuration
  GOOGLE: {
    // Get these from Google Cloud Console
    IOS_CLIENT_ID: 'YOUR_IOS_CLIENT_ID',
    ANDROID_CLIENT_ID: 'YOUR_ANDROID_CLIENT_ID',
    WEB_CLIENT_ID: 'YOUR_WEB_CLIENT_ID',
    SCOPES: ['profile', 'email']
  },
  
  // Apple Sign In Configuration
  APPLE: {
    SERVICES: ['iCloud', 'AppleID']
  }
};
