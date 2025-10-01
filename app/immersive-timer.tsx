import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  useWindowDimensions,
  Alert,
  AppState,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStudy } from '@/hooks/study-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { backgroundTimer } from '@/utils/background-timer';
import * as Haptics from 'expo-haptics';
// Audio notifications are handled via Web Audio API for web and console logs for mobile


type TimerParams = {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  mode: 'pomodoro' | 'countup';
  workTime: string;
  shortBreakTime?: string;
  longBreakTime?: string;
  sessionsBeforeLongBreak?: string;
  sessionType: 'work' | 'shortBreak' | 'longBreak';
  initialTime: string;
  totalTime: string;
  completedSessions: string;
  totalSessions: string;
};

export default function ImmersiveTimerScreen() {
  console.log('ImmersiveTimer - Raw params:', useLocalSearchParams());
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<TimerParams>();
  const { activeSession, startStudySession, pauseStudySession, resumeStudySession, endStudySession } = useStudy();
  
  // Parse params - decode URI components for proper string handling
  const subjectName = params.subjectName ? decodeURIComponent(params.subjectName as string) : '';
  const subjectColor = params.subjectColor ? decodeURIComponent(params.subjectColor as string) : '#4ECDC4';
  
  console.log('ImmersiveTimer - Parsed subject:', { subjectName, subjectColor });
  const mode = params.mode || 'pomodoro';
  const sessionType = params.sessionType || 'work';
  const initialTime = parseInt(params.initialTime || '0');
  const completedSessions = parseInt(params.completedSessions || '0');
  const totalSessions = parseInt(params.totalSessions || '1');
  
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Auto-start timer (for both work and break sessions)
  const [isRunning, setIsRunning] = useState(true);
  const [distractionCount, setDistractionCount] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundTime = useRef<Date | null>(null);
  const actualElapsedTime = useRef<number>(0);
  const hasCompletedSession = useRef(false);

  
  // Play notification sound and vibration
  const playNotificationSound = useCallback(async (isBreak: boolean = false) => {
    // Add vibration for mobile devices
    if (Platform.OS !== 'web') {
      try {
        if (isBreak) {
          // Strong vibration pattern for break completion
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }, 200);
          setTimeout(async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }, 400);
        } else {
          // Very strong vibration pattern for work session completion
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }, 150);
          setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }, 300);
          setTimeout(async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }, 450);
          setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }, 600);
        }
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
    
    if (Platform.OS === 'web') {
      // Use Web Audio API for web - different tones for work vs break
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        if (isBreak) {
          // Gentle chime for break completion (lower frequency)
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.8);
        } else {
          // Alert sound for work session completion (triple beep)
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
              oscillator.type = 'sine';
              
              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
              
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.3);
            }, i * 400);
          }
        }
      } catch (error) {
        console.log('Web audio not available:', error);
      }
    } else {
      // Use expo-audio for mobile devices
      try {
        // For mobile devices, just use console notification for now
        // expo-audio requires hooks and would need significant refactoring
        console.log(`🔔 ${isBreak ? 'Break' : 'Session'} completed!`);
      } catch (error) {
        console.log('Audio notification not available:', error);
        // Fallback to console notification
        console.log(`🔔 Notification: ${isBreak ? 'Break' : 'Session'} completed!`);
      }
    }
  }, []);

  // Reset hasCompletedSession when sessionType changes and start study session for work
  useEffect(() => {
    hasCompletedSession.current = false;
    console.log('Immersive - Reset hasCompletedSession for sessionType:', sessionType);
    
    // Start a new study session ONLY when transitioning to work (not for breaks)
    const startWorkSession = async () => {
      if (sessionType === 'work' && params.subjectId) {
        // Always start a new session for work, even if one exists (it might be from a previous work session)
        console.log('Immersive - Starting study session for work');
        try {
          await startStudySession(params.subjectId);
        } catch (error) {
          console.error('Error starting study session:', error);
        }
      }
    };
    
    startWorkSession();
  }, [sessionType, params.subjectId, startStudySession]);
  
  // Calculate dimensions for the large timer display
  const TIMER_SIZE = Math.min(screenWidth * 0.8, screenHeight * 0.4);
  const DISTRACTION_SIZE = Math.min(screenWidth * 0.5, 200);
  
  // Format time for display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (mode === 'countup' && hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get display time based on mode
  const getDisplayTime = () => {
    if (mode === 'pomodoro') {
      // For pomodoro, format as MM:SS
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      // For count-up, format as HH:MM:SS if over an hour
      return formatTime(elapsedTime);
    }
  };
  
  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    
    if (!showControls) {
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // Auto-hide after 5 seconds
      hideControlsTimer.current = setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 5000);
    } else {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    }
  }, [showControls, controlsOpacity]);
  
  // Handle distraction tap
  const handleDistraction = () => {
    if (mode === 'pomodoro' && sessionType === 'work') {
      setDistractionCount(prev => prev + 1);
      // Visual feedback could be added here
    }
  };
  
  // Handle pause/resume
  const handlePauseResume = async () => {
    try {
      if (isRunning) {
        setIsRunning(false);
        if (activeSession) {
          await pauseStudySession();
        }
      } else {
        setIsRunning(true);
        if (activeSession?.isPaused) {
          await resumeStudySession();
        }
      }
    } catch (error) {
      console.error('Error toggling pause:', error);
    }
  };
  
  // Handle skip break
  const handleSkipBreak = async () => {
    if (sessionType !== 'work') {
      console.log('Immersive - Skipping break, starting next work session');
      
      // Play notification sound
      await playNotificationSound(true);
      
      // Stop the timer
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Mark session as completed to prevent duplicate handling
      hasCompletedSession.current = true;
      
      // Navigate directly to next work session
      const workDuration = parseInt(params.workTime || '25') * 60;
      
      router.replace({
        pathname: '/immersive-timer',
        params: {
          subjectId: params.subjectId,
          subjectName: params.subjectName,
          subjectColor: params.subjectColor,
          mode: 'pomodoro',
          workTime: params.workTime,
          shortBreakTime: params.shortBreakTime,
          longBreakTime: params.longBreakTime,
          sessionType: 'work',
          initialTime: workDuration.toString(),
          totalTime: workDuration.toString(),
          completedSessions: completedSessions.toString(),
          totalSessions: params.totalSessions,
        }
      });
    }
  };
  
  // Handle stop and return
  const handleStop = async () => {
    if (Platform.OS === 'web') {
      // For web, use confirm instead of Alert
      const confirmed = window.confirm('Are you sure you want to stop the timer?');
      if (confirmed) {
        try {
          setIsRunning(false);
          
          // Only end study session if it's a work session, not a break
          if (activeSession && sessionType === 'work') {
            const actualMinutes = Math.round(actualElapsedTime.current / 60);
            const notes = mode === 'pomodoro'
              ? `Pomodoro session (${actualMinutes} min) with ${distractionCount} distractions`
              : `Focus session (${actualMinutes} min)`;
            
            await endStudySession(notes);
          }
          
          router.back();
        } catch (error) {
          console.error('Error stopping session:', error);
          router.back();
        }
      }
    } else {
      Alert.alert(
        'Stop Timer',
        'Are you sure you want to stop the timer?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsRunning(false);
                
                // Only end study session if it's a work session, not a break
                if (activeSession && sessionType === 'work') {
                  const actualMinutes = Math.round(actualElapsedTime.current / 60);
                  const notes = mode === 'pomodoro'
                    ? `Pomodoro session (${actualMinutes} min) with ${distractionCount} distractions`
                    : `Focus session (${actualMinutes} min)`;
                  
                  await endStudySession(notes);
                }
                
                router.back();
              } catch (error) {
                console.error('Error stopping session:', error);
                router.back();
              }
            },
          },
        ]
      );
    }
  };
  
  // Handle session complete - use useCallback with proper dependencies
  const handleSessionComplete = useCallback(async () => {
    // Prevent multiple calls
    if (hasCompletedSession.current) {
      console.log('Immersive - Session already completed, skipping');
      return;
    }
    hasCompletedSession.current = true;
    
    console.log('Immersive - handleSessionComplete called - sessionType:', sessionType, 'completedSessions:', completedSessions, 'totalSessions:', totalSessions);
    setIsRunning(false);
    
    // Clear interval immediately to prevent further ticks
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Play notification sound for all session completions
    await playNotificationSound(sessionType !== 'work');
    
    if (sessionType === 'work') {
      // Work session complete - ONLY save to history for work sessions
      try {
        if (activeSession) {
          const actualMinutes = Math.round(actualElapsedTime.current / 60);
          const notes = `Pomodoro work session completed (${actualMinutes} min) with ${distractionCount} distractions`;
          console.log('Ending work session with notes:', notes);
          await endStudySession(notes);
        }
        
        // Check if there are more work sessions to complete
        const nextCompletedSessions = completedSessions + 1;
        console.log('Immersive - Work session complete. Next completed sessions:', nextCompletedSessions, 'of', totalSessions);
        
        if (nextCompletedSessions >= totalSessions) {
          // All work sessions complete - show completion and return to timer
          console.log('Immersive - All work sessions complete, returning to timer');
          
          // Calculate total study time for the completion message
          const totalMinutes = Math.round(actualElapsedTime.current / 60);
          const completionMessage = `🎉 Congratulations! You completed ${totalSessions} sessions! Last session: ${Math.round(actualElapsedTime.current / 60)} minutes.`;
          
          // Show completion notification
          if (Platform.OS === 'web') {
            alert(completionMessage);
          } else {
            Alert.alert('All Sessions Complete!', completionMessage);
          }
          router.replace({
            pathname: '/(tabs)/timer',
            params: { action: 'reset' }
          });
        } else {
          // More sessions to go, start break
          // Determine break type based on completed sessions
          // Use sessionsBeforeLongBreak setting (default 4, but we're using 2 for testing)
          const sessionsBeforeLongBreak = parseInt(params.sessionsBeforeLongBreak || '2');
          const isLongBreak = nextCompletedSessions % sessionsBeforeLongBreak === 0 && nextCompletedSessions > 0;
          const breakType = isLongBreak ? 'longBreak' : 'shortBreak';
          const breakDuration = isLongBreak 
            ? parseInt(params.longBreakTime || '15') * 60 
            : parseInt(params.shortBreakTime || '5') * 60;
          
          console.log('Immersive - Starting break - type:', breakType, 'duration:', breakDuration, 'after session:', nextCompletedSessions, 'of', totalSessions);
          
          // Navigate to break session
          router.replace({
            pathname: '/immersive-timer',
            params: {
              subjectId: params.subjectId,
              subjectName: params.subjectName,
              subjectColor: params.subjectColor,
              mode: 'pomodoro',
              workTime: params.workTime,
              shortBreakTime: params.shortBreakTime,
              longBreakTime: params.longBreakTime,
              sessionType: breakType,
              initialTime: breakDuration.toString(),
              totalTime: breakDuration.toString(),
              completedSessions: nextCompletedSessions.toString(), // Pass updated count
              totalSessions: params.totalSessions,
              sessionsBeforeLongBreak: params.sessionsBeforeLongBreak,
            }
          });
        }
      } catch (error) {
        console.error('Error ending work session:', error);
        router.replace('/(tabs)/timer');
      }
    } else {
      // Break complete - NEVER record break sessions in study history
      console.log('Immersive - Break complete (NOT saving to history). Completed work sessions so far:', completedSessions, 'of', totalSessions, 'total');
      
      // After a break, check if we still have work sessions remaining
      // completedSessions represents work sessions already finished
      // We should only continue if completedSessions < totalSessions
      
      if (completedSessions >= totalSessions) {
        // This should never happen - breaks should only occur between work sessions
        console.error('Immersive - ERROR: Break completed but no more work sessions remaining!');
        router.replace('/(tabs)/timer');
        return;
      }
      
      console.log('Immersive - Break completed, starting work session', completedSessions + 1, 'of', totalSessions);
      
      // Start next work session
      const workDuration = parseInt(params.workTime || '25') * 60;
      
      // Navigate to next work session
      router.replace({
        pathname: '/immersive-timer',
        params: {
          subjectId: params.subjectId,
          subjectName: params.subjectName,
          subjectColor: params.subjectColor,
          mode: 'pomodoro',
          workTime: params.workTime,
          shortBreakTime: params.shortBreakTime,
          longBreakTime: params.longBreakTime,
          sessionType: 'work',
          initialTime: workDuration.toString(),
          totalTime: workDuration.toString(),
          completedSessions: completedSessions.toString(), // Keep same count - will be incremented after this work session completes
          totalSessions: params.totalSessions,
        }
      });
    }
  }, [sessionType, completedSessions, totalSessions, activeSession, distractionCount, endStudySession, router, playNotificationSound, params]);
  
  // Watch for timer completion
  useEffect(() => {
    if (mode === 'pomodoro' && timeRemaining === 0 && !hasCompletedSession.current && isRunning) {
      console.log('Immersive - Timer reached 0, triggering completion');
      // Use a small delay to ensure state is properly updated
      setTimeout(() => {
        if (!hasCompletedSession.current) {
          handleSessionComplete();
        }
      }, 100);
    }
  }, [timeRemaining, mode, isRunning, handleSessionComplete]);
  
  // Timer effect - improved for iOS reliability
  useEffect(() => {
    console.log('Immersive - Timer effect, isRunning:', isRunning, 'mode:', mode, 'sessionType:', sessionType);
    
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        // Only track actual elapsed time for work sessions
        if (sessionType === 'work') {
          actualElapsedTime.current += 1;
        }
        
        if (mode === 'pomodoro') {
          setTimeRemaining((prev) => {
            const newTime = Math.max(0, prev - 1);
            console.log('Immersive - Countdown:', newTime, 'from:', prev);
            return newTime;
          });
        } else {
          setElapsedTime(prev => prev + 1);
          actualElapsedTime.current += 1;
        }
      }, 1000);
      
      console.log('Immersive - Interval started with ID:', intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('Immersive - Interval cleaned up in effect cleanup');
      }
    };
  }, [isRunning, mode, sessionType]);
  
  // Handle app state changes - improved with background timer
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      console.log('Immersive - App state changed to:', nextAppState, 'isRunning:', isRunning);
      
      if (nextAppState === 'background' && isRunning) {
        // App going to background while timer is running - start background timer
        backgroundTime.current = new Date();
        console.log('Immersive - App went to background at:', backgroundTime.current.toISOString());
        
        // Start background timer with current state
        try {
          await backgroundTimer.startBackgroundTimer({
            isRunning: true,
            startTime: Date.now() - (actualElapsedTime.current * 1000),
            pausedTime: 0,
            totalTime: mode === 'pomodoro' ? initialTime : 0,
            sessionType,
            mode,
            subjectId: params.subjectId || '',
            completedSessions,
            totalSessions,
            distractionCount,
          });
          console.log('Immersive - Background timer started successfully');
        } catch (error) {
          console.error('Error starting background timer:', error);
        }
      } else if (nextAppState === 'active') {
        // App coming back to foreground - check background timer progress
        try {
          const progress = await backgroundTimer.getTimerProgress();
          
          if (progress && backgroundTime.current) {
            const now = new Date();
            const backgroundDuration = Math.floor((now.getTime() - backgroundTime.current.getTime()) / 1000);
            console.log('Immersive - App returned from background after:', backgroundDuration, 'seconds');
            
            // Update elapsed time and timer state from background timer
            // Only track elapsed time for work sessions, not breaks
            if (sessionType === 'work') {
              actualElapsedTime.current = progress.elapsedTime;
            }
            
            if (mode === 'pomodoro') {
              setTimeRemaining(progress.timeRemaining);
              
              if (progress.isCompleted && !hasCompletedSession.current) {
                // Timer completed while in background
                console.log('Immersive - Timer completed in background, triggering completion');
                await backgroundTimer.stopBackgroundTimer();
                hasCompletedSession.current = false;
                setTimeout(() => {
                  if (!hasCompletedSession.current) {
                    handleSessionComplete();
                  }
                }, 100);
              }
            } else {
              setElapsedTime(progress.elapsedTime);
            }
            
            backgroundTime.current = null;
          }
          
          // Stop background timer when app becomes active
          await backgroundTimer.stopBackgroundTimer();
        } catch (error) {
          console.error('Error handling background timer on app active:', error);
          
          // Fallback to original logic if background timer fails
          if (backgroundTime.current && isRunning) {
            const now = new Date();
            const backgroundDuration = Math.floor((now.getTime() - backgroundTime.current.getTime()) / 1000);
            console.log('Immersive - Fallback: App returned from background after:', backgroundDuration, 'seconds');
            
            // Only track elapsed time for work sessions, not breaks
            if (sessionType === 'work') {
              actualElapsedTime.current += backgroundDuration;
            }
            
            if (mode === 'pomodoro') {
              setTimeRemaining(prev => {
                const newTime = Math.max(0, prev - backgroundDuration);
                console.log('Immersive - Fallback: Updated time after background:', newTime, 'was:', prev);
                
                if (newTime === 0 && prev > 0) {
                  hasCompletedSession.current = false;
                  setTimeout(() => {
                    if (!hasCompletedSession.current) {
                      handleSessionComplete();
                    }
                  }, 100);
                }
                return newTime;
              });
            } else {
              setElapsedTime(prev => prev + backgroundDuration);
            }
            
            backgroundTime.current = null;
          }
        }
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isRunning, mode, sessionType, handleSessionComplete, initialTime, params.subjectId, completedSessions, totalSessions, distractionCount]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      // No cleanup needed for console notifications
    };
  }, []);
  
  return (
    <View style={styles.container}>
      <StatusBar hidden={true} backgroundColor="#000000" barStyle="light-content" />
      
      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.mainContent}>
          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <Text style={[styles.timerText, { fontSize: TIMER_SIZE / 3 }]}>
              {getDisplayTime()}
            </Text>
            
            {/* Session info for Pomodoro */}
            {mode === 'pomodoro' && (
              <View style={styles.sessionInfoContainer}>
                <Text style={[styles.sessionInfo, sessionType !== 'work' && styles.breakSessionInfo]}>
                  {sessionType === 'work' 
                    ? `Work Session ${completedSessions + 1} of ${totalSessions}`
                    : sessionType === 'shortBreak' 
                      ? `☕ SHORT BREAK`
                      : `🛋️ LONG BREAK`
                  }
                </Text>
                {sessionType !== 'work' && (
                  <>
                    <Text style={styles.breakSubtext}>
                      {sessionType === 'shortBreak' 
                        ? 'Take a quick rest' 
                        : 'Enjoy your extended break'}
                    </Text>
                    <Text style={styles.breakProgress}>
                      After session {completedSessions} of {totalSessions}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
          
          {/* Distraction Button (Pomodoro Work Sessions Only) */}
          {mode === 'pomodoro' && sessionType === 'work' && (
            <TouchableOpacity
              style={[
                styles.distractionButton,
                {
                  width: DISTRACTION_SIZE,
                  height: DISTRACTION_SIZE,
                  borderRadius: DISTRACTION_SIZE / 2,
                }
              ]}
              onPress={handleDistraction}
              activeOpacity={0.8}
            >
              <Text style={styles.distractionCount}>{distractionCount}</Text>
              <Text style={styles.distractionLabel}>Tap when{`\n`}distracted</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableWithoutFeedback>
      
      {/* Controls Overlay */}
      {showControls && (
        <Animated.View
          style={[
            styles.controlsOverlay,
            {
              opacity: controlsOpacity,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
            },
          ]}
          pointerEvents="box-none"
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleStop}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.subjectInfo}>
              <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
              <Text style={styles.subjectName}>{subjectName || 'No Subject'}</Text>
            </View>
            
            <View style={styles.spacer} />
          </View>
          
          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            {/* Skip Break Button - Show for all breaks */}
            {sessionType !== 'work' && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipBreak}
              >
                <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
                <Text style={styles.skipButtonText}>
                  Skip {sessionType === 'shortBreak' ? 'Short' : 'Long'} Break
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handlePauseResume}
            >
              {isRunning ? (
                <Ionicons name="pause" size={32} color="#FFFFFF" />
              ) : (
                <Ionicons name="play" size={32} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 0,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  timerText: {
    color: '#FFFFFF',
    fontWeight: '200' as const,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  sessionInfoContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  sessionInfo: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '300' as const,
    textAlign: 'center',
  },
  breakSessionInfo: {
    color: '#FFA500',
    fontWeight: '600' as const,
    fontSize: 20,
  },
  breakSubtext: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  breakProgress: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  distractionButton: {
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#333333',
  },
  distractionCount: {
    fontSize: 48,
    fontWeight: '200' as const,
    color: '#FFFFFF',
  },
  distractionLabel: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  subjectName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  controlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  spacer: {
    width: 40,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500' as const,
    marginLeft: 8,
  },
});