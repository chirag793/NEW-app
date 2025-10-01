import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/hooks/auth-context';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple, isLoading, isAppleSignInAvailable } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = React.useState(false);
  const [appleSigningIn, setAppleSigningIn] = React.useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      const result = await signInWithGoogle();
      
      if (result && typeof result === 'object' && 'type' in result) {
        if (result.type === 'success') {
          // Success - navigate back
          router.back();
        } else if (result.type === 'cancel') {
          // User cancelled - do nothing
          console.log('Sign in cancelled by user');
        } else if (result.type === 'error') {
          // Error occurred
          const errorMessage = 'Failed to sign in. Please try again.';
          if (Platform.OS === 'web') {
            alert(errorMessage);
          } else {
            Alert.alert('Sign In Error', errorMessage);
          }
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Sign In Error', errorMessage);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setAppleSigningIn(true);
      const result = await signInWithApple();
      
      if (result && typeof result === 'object' && 'type' in result) {
        if (result.type === 'success') {
          // Success - navigate back
          router.back();
        } else if (result.type === 'cancel') {
          // User cancelled - do nothing
          console.log('Apple sign in cancelled by user');
        } else if (result.type === 'error') {
          // Error occurred
          const errorMessage = result.error || 'Failed to sign in with Apple. Please try again.';
          Alert.alert('Sign In Error', errorMessage);
        }
      }
    } catch (error) {
      console.error('Apple sign in error:', error);
      Alert.alert('Sign In Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setAppleSigningIn(false);
    }
  };

  const handleSkip = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>📚</Text>
              </View>
            </View>
            <Text style={styles.title}>INICET & NEET PG</Text>
            <Text style={styles.subtitle}>Study Tracker</Text>
            <Text style={styles.description}>
              Sign in to sync your progress across devices and never lose your study data
            </Text>
          </View>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>☁️</Text>
              <Text style={styles.featureText}>Cloud Sync</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📊</Text>
              <Text style={styles.featureText}>Progress Tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎯</Text>
              <Text style={styles.featureText}>Performance Analytics</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={signingIn || appleSigningIn}
            >
              {signingIn ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>🔐</Text>
                  <Text style={styles.googleButtonText}>Continue with Demo Account</Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            ) : (
              <TouchableOpacity
                style={[styles.googleButton, styles.appleButtonFallback]}
                onPress={handleAppleSignIn}
                disabled={signingIn || appleSigningIn}
              >
                {appleSigningIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.appleIcon}>🍎</Text>
                    <Text style={styles.appleButtonText}>Sign in with iCloud</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500' as const,
  },
  appleButton: {
    height: 50,
    marginBottom: 16,
  },
  appleButtonFallback: {
    backgroundColor: '#000000',
  },
  appleIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },

});