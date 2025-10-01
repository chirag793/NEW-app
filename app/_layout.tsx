
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, Component, ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StudyProvider, useStudy } from "@/hooks/study-context";
import { AuthProvider, useAuth } from "@/hooks/auth-context";
import { AdProvider } from "@/hooks/ad-context";
import { trpc, trpcClient } from "@/lib/trpc";
import { clearAllCorruptedData } from "@/utils/background-timer";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  // Use a safe console wrapper because some devtools patching can make console or its
  // methods undefined which then throws when we try to call them from an error boundary.
  static safeConsole = {
    error: (...args: any[]) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c: any = (globalThis as any).console;
        if (c && typeof c.error === 'function') {
          c.error(...args);
        }
      } catch (e) {
        // swallow - we can't do much here
      }
    },
    log: (...args: any[]) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c: any = (globalThis as any).console;
        if (c && typeof c.log === 'function') {
          c.log(...args);
        }
      } catch (e) {
        // swallow
      }
    }
  };

  static getDerivedStateFromError(error: Error) {
    ErrorBoundary.safeConsole.error('ErrorBoundary caught an error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    ErrorBoundary.safeConsole.error('ErrorBoundary componentDidCatch:', error, errorInfo);
    // If it's a JSON parse error, try to clear corrupted storage
    if (error.message?.includes('JSON') || 
        error.message?.includes('Unexpected character') ||
        error.message?.includes('Unexpected token') ||
        error.message?.includes('Unexpected end of JSON') ||
        error.message?.includes('Unexpected string in JSON')) {
      ErrorBoundary.safeConsole.log('Detected JSON parse error, attempting to clear corrupted data');
      try {
        this.clearCorruptedStorage();
      } catch (e) {
        ErrorBoundary.safeConsole.error('Error while attempting to clear corrupted storage from componentDidCatch:', e);
      }
    }
  }

  clearCorruptedStorage = async () => {
    try {
      // This is a simplified version - the full cleanup is in study-context
      ErrorBoundary.safeConsole.log('ErrorBoundary: Attempting to clear potentially corrupted storage');
      // We can't import AsyncStorage here due to linting rules, but the study context will handle it
    } catch (error) {
      ErrorBoundary.safeConsole.error('Error clearing storage from ErrorBoundary:', error);
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message?.includes('JSON') || this.state.error?.message?.includes('Unexpected character')
              ? 'Data corruption detected. The app will attempt to recover.'
              : 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Component to handle auth-study integration
function AuthStudyIntegration({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentUser } = useStudy();
  // You can add any integration logic here if needed, but handleUserLogin/Logout do not exist in context.
  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthStudyIntegration>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-test" options={{ 
          title: "Add Test Score",
          presentation: "modal" 
        }} />
        <Stack.Screen name="study-planner" options={{ 
          title: "Study Planner",
          presentation: "modal" 
        }} />
        <Stack.Screen name="login" options={{ 
          title: "Sign In",
          presentation: "modal",
          headerShown: false
        }} />
        <Stack.Screen name="immersive-timer" options={{ 
          headerShown: false
        }} />
      </Stack>
    </AuthStudyIntegration>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Clear any corrupted AsyncStorage data on app startup
    const initializeApp = async () => {
        try {
        await clearAllCorruptedData();
        ErrorBoundary.safeConsole.log('App initialization: Corrupted data cleanup completed');
      } catch (error) {
        ErrorBoundary.safeConsole.error('App initialization: Error during cleanup:', error);
      } finally {
        try {
          SplashScreen.hideAsync();
        } catch (e) {
          // ignore splash screen hide errors
        }
      }
    };
    initializeApp();
  }, []);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <AuthProvider>
              <StudyProvider>
                <AdProvider>
                  <RootLayoutNav />
                </AdProvider>
              </StudyProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
