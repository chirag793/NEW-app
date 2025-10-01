import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { User } from '@/types/study';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
// Removed DEMO_ACCOUNTS import to avoid circular dependency

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEYS = {
  USER: 'user_data',
  AUTH_TOKEN: 'auth_token',
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  
  // Removed studyContext to avoid circular dependency
  
  const safeJsonParse = (data: string | null | undefined, fallback: any = null) => {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    
    try {
      const dataStr = typeof data === 'string' ? data : String(data);
      const trimmed = dataStr.trim();
      
      if (trimmed === '') return fallback;
      
      // Enhanced corruption detection patterns - comprehensive list
      const corruptionPatterns = [
        /^object$/i,                    // Just "object"
        /^object\s/i,                  // "object " (with space)
        /^object Object$/i,            // "object Object"
        /^\[object Object\]$/i,       // "[object Object]"
        /^\[object\s+\w+\]$/i,         // "[object Something]"
        /^NaN$/i,                      // "NaN"
        /^undefined$/i,                // "undefined"
        /^function/i,                  // Function strings
        /^\w+\s+object/i,              // "something object"
        /object\s*Object/i,            // Various "object Object" patterns
        /^[a-zA-Z]+\s+[a-zA-Z]+$/,     // Two words (likely corrupted)
        /^o$/,                         // Single "o" character (exact match)
        /^ob$/,                        // "ob" (exact match)
        /^obj$/,                       // "obj" (exact match)
        /^obje$/,                      // "obje" (exact match)
        /^objec$/,                     // "objec" (exact match)
        /^\s*o\s*$/,                  // "o" with whitespace
        /^\s*ob\s*$/,                 // "ob" with whitespace
        /^\s*obj\s*$/,                // "obj" with whitespace
        /^\s*obje\s*$/,               // "obje" with whitespace
        /^\s*objec\s*$/,              // "objec" with whitespace
        /^\s*object\s*$/,             // "object" with whitespace
        /^[a-zA-Z]{1,10}$/,           // Single words that aren't valid JSON (moved after specific patterns)
        // Additional specific corruption patterns that cause JSON parse errors
        /^\s*[a-zA-Z]\s*$/,           // Single letter with optional whitespace
        /^\s*[a-zA-Z]{2}\s*$/,        // Two letters with optional whitespace
        /^\s*[a-zA-Z]{3}\s*$/,        // Three letters with optional whitespace
        /^\s*[a-zA-Z]{4}\s*$/,        // Four letters with optional whitespace
        /^\s*[a-zA-Z]{5}\s*$/,        // Five letters with optional whitespace
      ];
      
      const isCorrupted = corruptionPatterns.some(pattern => pattern.test(trimmed));
      
      if (isCorrupted) {
        console.warn('Detected corrupted user data, returning fallback:', trimmed.substring(0, 50));
        return fallback;
      }
      
      // Check if it looks like valid JSON structure
      const startsWithValidJson = trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"');
      const isValidPrimitive = ['true', 'false', 'null'].includes(trimmed.toLowerCase()) || /^-?\d*\.?\d+$/.test(trimmed);
      
      if (!startsWithValidJson && !isValidPrimitive) {
        console.warn('User data does not look like valid JSON, returning fallback:', trimmed.substring(0, 50));
        return fallback;
      }
      
      // Try to parse JSON with enhanced error handling
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (parseError) {
        // Log the specific error for debugging
        if (typeof parseError === 'object' && parseError !== null && 'message' in parseError) {
          const errorMessage = (parseError as Error).message;
          console.warn('JSON parse error in auth context:', errorMessage, 'Data preview:', trimmed.substring(0, 100));
          
          // Return fallback for any JSON syntax errors - be more aggressive
          console.warn('Returning fallback due to JSON parse error in auth');
          return fallback;
        }
        console.warn('Unknown parse error in auth, returning fallback');
        return fallback;
      }
      
      if (parsed === null || parsed === undefined) {
        return fallback;
      }
      
      return parsed;
    } catch (error) {
      console.warn('Critical error in auth safeJsonParse, returning fallback. Error:', error, 'Data preview:', data?.toString().substring(0, 50));
      return fallback;
    }
  };

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const parsedUser = safeJsonParse(userData, null);
      
      // Validate that the parsed data has required fields
      if (parsedUser && typeof parsedUser === 'object' && parsedUser.id && parsedUser.email) {
        console.log('User loaded successfully:', parsedUser.email);
        setUser(parsedUser);
      } else if (userData) {
        // Invalid user data structure, clear it
        console.warn('Invalid user data structure, clearing');
        await AsyncStorage.removeItem(STORAGE_KEYS.USER);
        await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
    } catch (error) {
      console.error('Error loading user data, clearing storage');
      // Clear potentially corrupted data
      try {
        await AsyncStorage.removeItem(STORAGE_KEYS.USER);
        await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      } catch (clearError) {
        console.error('Error clearing data:', clearError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const signOut = useCallback(async () => {
    try {
      // Clear user data from storage first
      await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.AUTH_TOKEN]);
      
      // Also clear the user_data key to ensure study context detects logout
      await AsyncStorage.removeItem('user_data');
      
      // Set user to null
      setUser(null);
      
      // Clear any web browser auth sessions
      if (Platform.OS !== 'web') {
        await WebBrowser.coolDownAsync();
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const syncDataWithBackend = useCallback(async (userId: string, token: string) => {
    if (!userId || !token || !token.trim()) {
      throw new Error('Invalid user ID or token');
    }
    
    try {
      setIsSyncing(true);
      
      // Get all local data for future backend sync
      // Currently storing locally only
      // When backend is enabled, implement sync logic here
      
      // Update last synced time
      const updatedUser = { ...user!, lastSyncedAt: new Date().toISOString() };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser)); // For study context compatibility
      setUser(updatedUser);
      
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const syncData = useCallback(async () => {
    if (!user) return;
    
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      await syncDataWithBackend(user.id, token);
    }
  }, [user, syncDataWithBackend]);

  const signInWithApple = useCallback(async () => {
    try {
      // Check if we're on iOS and Apple Authentication is available
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (isAvailable) {
          setIsLoading(true);
          
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          if (credential.user) {
            const newUser: User = {
              id: credential.user,
              email: credential.email || `${credential.user}@privaterelay.appleid.com`,
              name: credential.fullName 
                ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() 
                : 'Apple User',
              photoUrl: undefined, // Apple doesn't provide profile photos
              createdAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString(),
            };

            // Save user data to both keys for compatibility
            await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
            await AsyncStorage.setItem('user_data', JSON.stringify(newUser)); // For study context compatibility
            await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, `apple_token_${credential.user}`);
            
            setUser(newUser);
            
            // Study context integration handled in _layout.tsx
            
            return { type: 'success' };
          } else {
            return { type: 'error' as const, error: 'No user data received from Apple' };
          }
        }
      }
      
      // Fallback to demo Apple account for non-iOS platforms or when Apple Sign-In is not available
      console.log('Using demo Apple account');
      setIsLoading(true);
      
      const demoAppleUser = {
        id: 'apple_demo_user',
        email: 'apple.user@icloud.com',
        name: 'Apple User',
        photoUrl: undefined,
      };
      
      const newUser: User = {
        id: demoAppleUser.id,
        email: demoAppleUser.email,
        name: demoAppleUser.name,
        photoUrl: demoAppleUser.photoUrl,
        createdAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      };
      
      // Save user data to both keys for compatibility
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem('user_data', JSON.stringify(newUser)); // For study context compatibility
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, `apple_demo_token_${demoAppleUser.id}`);
      
      setUser(newUser);
      
      return { type: 'success' };
    } catch (error: any) {
      console.error('Apple sign in error:', error);
      
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return { type: 'cancel' };
      }
      
      return { type: 'error' as const, error: error.message || 'Apple Sign-In failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);

      // IMPORTANT: Replace the placeholder client IDs with your actual Google OAuth client IDs
      // For native apps you will typically use iOS/Android client IDs. For web, use the web client ID.
      const clientId = Platform.select({
        ios: process.env.GOOGLE_IOS_CLIENT_ID || 'GOOGLE_IOS_CLIENT_ID',
        android: process.env.GOOGLE_ANDROID_CLIENT_ID || 'GOOGLE_ANDROID_CLIENT_ID',
        web: process.env.GOOGLE_WEB_CLIENT_ID || 'GOOGLE_WEB_CLIENT_ID',
      }) as string;

      if (!clientId || clientId.startsWith('GOOGLE_')) {
        console.warn('Google client ID is not configured. Set GOOGLE_IOS_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID / GOOGLE_WEB_CLIENT_ID.');
      }

      // makeRedirectUri typing can vary between SDKs; cast to any to avoid TS complaints in this repo
  const redirectUri = (AuthSession.makeRedirectUri() as any) || '';

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `response_type=token%20id_token&` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent('openid profile email')}`;

      // Use openAuthSessionAsync which is available across Expo SDKs
      const result = await (AuthSession as any).openAuthSessionAsync(authUrl, redirectUri);

      // result: { type: 'success', params: { access_token, id_token, expires_in, ... } }
      if (!result) {
        return { type: 'error' as const, error: 'No response from Google' };
      }

      if ((result as any).type === 'success') {
        const params = (result as any).params || {};
        const accessToken = params.access_token;

        // Fetch user info
        let profile: any = { email: '', name: '', picture: '' };
        if (accessToken) {
          try {
            const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            profile = await res.json();
          } catch (err) {
            console.warn('Failed to fetch Google profile:', err);
          }
        }

        const newUser: User = {
          id: profile.id || params.id_token || `google_${Date.now()}`,
          email: profile.email || params.email || `unknown_${Date.now()}@example.com`,
          name: profile.name || profile.given_name || 'Google User',
          photoUrl: profile.picture || undefined,
          createdAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        };

        // Persist user and token
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
        await AsyncStorage.setItem('user_data', JSON.stringify(newUser));
        if (accessToken) {
          await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, `google_token_${accessToken}`);
        }

        setUser(newUser);

        return { type: 'success' as const };
      }

      if ((result as any).type === 'cancel' || (result as any).type === 'dismiss') {
        return { type: 'cancel' as const };
      }

      return { type: 'error' as const, error: 'Google sign-in failed' };
    } catch (error: any) {
      console.error('Google sign in error:', error);
      if (error?.message === 'The operation was canceled') {
        return { type: 'cancel' as const };
      }

      return { type: 'error' as const, error: error?.message || 'Google Sign-In failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check Apple sign-in availability on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS === 'ios') {
          const available = await AppleAuthentication.isAvailableAsync();
          if (mounted) setAppleAvailable(Boolean(available));
        } else {
          if (mounted) setAppleAvailable(false);
        }
      } catch (error) {
        if (mounted) setAppleAvailable(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    isSyncing,
    signInWithApple,
    signInWithGoogle,
    signOut,
    syncData,
    isAuthenticated: !!user,
    isAppleSignInAvailable: appleAvailable,
  }), [user, isLoading, isSyncing, signInWithApple, signInWithGoogle, signOut, syncData, appleAvailable]);

  return contextValue;
});