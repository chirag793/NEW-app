import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  TextInput,
  Platform,
  AppState,
} from 'react-native';

import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudy } from '@/hooks/study-context';
import { useAdManager } from '@/hooks/ad-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { DEFAULT_SUBJECTS } from '@/constants/subjects';
import { Subject } from '@/types/study';
import { backgroundTimer } from '@/utils/background-timer';
import AdBanner from '@/components/AdBanner';
import InterstitialAd from '@/components/InterstitialAd';
import * as Haptics from 'expo-haptics';
// Audio notifications handled via Web Audio API for web and console logs for mobile

// Default Pomodoro settings
const DEFAULT_WORK_TIME = 25; // 25 minutes
const DEFAULT_SHORT_BREAK = 5; // 5 minutes
const DEFAULT_LONG_BREAK = 15; // 15 minutes
const DEFAULT_SESSIONS_BEFORE_LONG_BREAK = 4;

// For testing - uncomment to use shorter durations
// const DEFAULT_WORK_TIME = 1; // 1 minute for testing
// const DEFAULT_SHORT_BREAK = 1; // 1 minute for testing
// const DEFAULT_LONG_BREAK = 1; // 1 minute for testing

type SessionType = 'work' | 'shortBreak' | 'longBreak';

export default function TimerScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { subjects, activeSession, startStudySession, endStudySession, pauseStudySession, resumeStudySession, isLoading } = useStudy();
  const { shouldShowBannerAd, interstitialAdVisible, hideInterstitialAd, triggerInterstitialOnAction } = useAdManager();
  
  const CIRCLE_SIZE = Math.min(screenWidth * 0.75, screenHeight * 0.35);
  const STROKE_WIDTH = 8;
  const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  
  // Always ensure we have subjects to display - use defaults if none loaded
  const displaySubjects = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;
  
  // Log for debugging (removed excessive logging)
  const [isRunning, setIsRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'pomodoro' | 'countup'>('pomodoro');
  const [showSubjectSelection, setShowSubjectSelection] = useState(true);
  
  // Timer settings
  const [workTime, setWorkTime] = useState(DEFAULT_WORK_TIME);
  const [shortBreakTime, setShortBreakTime] = useState(DEFAULT_SHORT_BREAK);
  const [longBreakTime, setLongBreakTime] = useState(DEFAULT_LONG_BREAK);
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(DEFAULT_SESSIONS_BEFORE_LONG_BREAK);
  const [totalSessions, setTotalSessions] = useState(1);
  
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_WORK_TIME * 60);
  const [elapsedTime, setElapsedTime] = useState(0); // For count-up mode
  const [sessionType, setSessionType] = useState<SessionType>('work');
  const [completedSessions, setCompletedSessions] = useState(0);
  const [distractionCount, setDistractionCount] = useState(0);
  const [totalTime, setTotalTime] = useState(DEFAULT_WORK_TIME * 60);
  const [motivationalText, setMotivationalText] = useState('Focus on your goals!');
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartTime = useRef<Date | null>(null);
  const backgroundTime = useRef<Date | null>(null);
  const actualElapsedTime = useRef<number>(0); // Track actual elapsed time in seconds
  
  const motivationalMessages = [
    'Stop dreaming!',
    'Focus on your goals!',
    'Stay focused!',
    'You can do this!',
    'Keep going!',
    'Almost there!',
    'Great progress!',
    'Stay strong!',
  ];

  // Handle navigation params from immersive timer
  const routeParams = useLocalSearchParams();
  
  // Track if we're processing an action to prevent loops
  const processingAction = useRef(false);
  
  useFocusEffect(
    useCallback(() => {
      const params = routeParams as any;
      
      // Prevent processing the same action multiple times
      if (params?.action && !processingAction.current) {
        processingAction.current = true;
        
        if (params.action === 'startBreak' && params.breakType) {
          // Start break after work session - NO STUDY SESSION FOR BREAKS
          const breakType = params.breakType as 'shortBreak' | 'longBreak';
          const nextCompletedSessions = parseInt(params.nextCompletedSessions || '0');
          
          setCompletedSessions(nextCompletedSessions);
          setSessionType(breakType);
          const duration = breakType === 'longBreak' ? longBreakTime * 60 : shortBreakTime * 60;
          
          setTotalTime(duration);
          setTimeRemaining(duration);
          setDistractionCount(0);
          actualElapsedTime.current = 0;
          
          // Start the break timer immediately
          setIsRunning(true);
          setShowSubjectSelection(false);
          
          // Clear params after processing
          setTimeout(() => {
            router.setParams({ action: undefined, breakType: undefined, nextCompletedSessions: undefined });
            processingAction.current = false;
          }, 100);
        } else if (params.action === 'startWorkAfterBreak') {
          // Start a new work session after break completes
          
          // Update completed sessions if provided
          if (params.completedSessions) {
            const updatedSessions = parseInt(params.completedSessions);
            setCompletedSessions(updatedSessions);
          }
          
          // Reset to work session
          const duration = workTime * 60;
          setSessionType('work');
          setTotalTime(duration);
          setTimeRemaining(duration);
          setDistractionCount(0);
          actualElapsedTime.current = 0;
          
          // Clear params immediately to prevent loops
          router.setParams({ action: undefined, completedSessions: undefined });
          processingAction.current = false;
          
          // Check if we have more sessions to complete
          const currentCompletedSessions = params.completedSessions ? parseInt(params.completedSessions) : completedSessions;
          if (currentCompletedSessions < totalSessions && selectedSubject) {
            // Auto-start the next work session
            setTimeout(async () => {
              try {
                await startStudySession(selectedSubject);
                sessionStartTime.current = new Date();
                actualElapsedTime.current = 0;
                setIsRunning(true);
                setShowSubjectSelection(false);
              } catch (error) {
                console.error('Error auto-starting next work session:', error);
                // Show subject selection if auto-start fails
                setShowSubjectSelection(true);
                setIsRunning(false);
              }
            }, 500);
          } else {
            // All sessions complete or no subject selected - show subject selection
            setShowSubjectSelection(true);
            setIsRunning(false);
          }
        } else if (params.action === 'reset') {
          // Reset timer after all sessions complete
          setSessionType('work');
          setTotalTime(workTime * 60);
          setTimeRemaining(workTime * 60);
          setCompletedSessions(0);
          setDistractionCount(0);
          setIsRunning(false);
          setShowSubjectSelection(true);
          actualElapsedTime.current = 0;
          
          // Clear the params
          setTimeout(() => {
            router.setParams({ action: undefined });
            processingAction.current = false;
          }, 100);
        } else {
          processingAction.current = false;
        }
      }
    }, [routeParams, router, subjects, selectedSubject, workTime, shortBreakTime, longBreakTime, completedSessions, totalSessions, startStudySession, displaySubjects])
  );

  useEffect(() => {
    if (activeSession) {
      setSelectedSubject(activeSession.subjectId);
      
      // Only set running if not paused
      if (!activeSession.isPaused) {
        setIsRunning(true);
        setShowSubjectSelection(false);
        
        // Calculate elapsed time if in count-up mode
        if (timerMode === 'countup' && activeSession.startTime) {
          const start = new Date(activeSession.startTime).getTime();
          const now = new Date().getTime();
          const pausedTime = activeSession.pausedTime || 0;
          const elapsed = Math.floor((now - start - pausedTime) / 1000);
          setElapsedTime(elapsed);
        }
      } else {
        setIsRunning(false);
        // Keep subject selection visible when paused
        setShowSubjectSelection(true);
      }
    } else {
      setIsRunning(false);
      setShowSubjectSelection(true);
      // Reset selected subject if no active session
      setSelectedSubject('');
    }
  }, [activeSession, timerMode]);

  // Play notification sound and vibration
  const playNotificationSound = async (isBreak: boolean = false) => {
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
      // For mobile devices, just use console notification for now
      // expo-audio requires hooks and would need significant refactoring
      console.log(`🔔 ${isBreak ? 'Break' : 'Session'} completed!`);
    }
  };

  const handleSessionComplete = useCallback(async () => {
    setIsRunning(false);
    
    // Play notification sound
    await playNotificationSound(sessionType !== 'work');
    
    if (sessionType === 'work') {
      // End the current study session to record progress
      if (activeSession) {
        try {
          // Calculate actual elapsed time for the session
          const actualMinutes = Math.round(actualElapsedTime.current / 60);
          const notes = `Pomodoro work session completed (${actualMinutes} min) with ${distractionCount} distractions`;
          
          const session = await endStudySession(notes);
          
          // Trigger interstitial ad after timer completion
          triggerInterstitialOnAction('timer_complete');
          
          if (session && session.duration > 0) {
            // Session recorded successfully
          } else {
            console.warn('Timer - Session ended but duration is 0 or session is null');
          }
        } catch (error) {
          console.error('Error auto-ending work session:', error);
          Alert.alert('Error', 'Failed to save your study session. Please check your progress.');
        }
      }
      
      const newCompletedSessions = completedSessions + 1;
      setCompletedSessions(newCompletedSessions);
      
      // Check if all sessions are complete
      if (newCompletedSessions >= totalSessions) {
        const actualMinutes = Math.round(actualElapsedTime.current / 60);
        Alert.alert('All Sessions Complete!', `Congratulations! You completed ${totalSessions} session${totalSessions > 1 ? 's' : ''}! Last session: ${actualMinutes} minutes.`);
        // Reset for new cycle
        setCompletedSessions(0);
        const duration = workTime * 60;
        setSessionType('work');
        setTotalTime(duration);
        setTimeRemaining(duration);
        setIsRunning(false);
        setShowSubjectSelection(true);
        actualElapsedTime.current = 0;
        return;
      }
      
      // Only show breaks if there are multiple sessions
      if (totalSessions > 1) {
        // Determine next session type
        const isLongBreak = newCompletedSessions % sessionsBeforeLongBreak === 0;
        
        const breakDuration = isLongBreak ? longBreakTime * 60 : shortBreakTime * 60;
        const breakType = isLongBreak ? 'longBreak' : 'shortBreak';
        
        setSessionType(breakType);
        setTotalTime(breakDuration);
        setTimeRemaining(breakDuration);
        setDistractionCount(0);
        actualElapsedTime.current = 0;
        
        // Auto-start break timer - breaks don't need study sessions
        setIsRunning(true);
        setShowSubjectSelection(false);
      } else {
        // Single session - just complete
        const workSessionMinutes = Math.round(actualElapsedTime.current / 60);
        Alert.alert('Session Complete!', `Great job! You studied for ${workSessionMinutes} minutes!`);
        const duration = workTime * 60;
        setSessionType('work');
        setTotalTime(duration);
        setTimeRemaining(duration);
        setIsRunning(false);
        setShowSubjectSelection(true);
        actualElapsedTime.current = 0;
        return;
      }
    } else {
      // Break is complete, start a new study session for the next work period
      const duration = workTime * 60;
      setSessionType('work');
      setTotalTime(duration);
      setTimeRemaining(duration);
      actualElapsedTime.current = 0;
      
      // Start a new study session for the next work period
      if (selectedSubject && completedSessions < totalSessions) {
        try {
          await startStudySession(selectedSubject);
          sessionStartTime.current = new Date();
          
          // Auto-start work session after break
          setIsRunning(true);
          setShowSubjectSelection(false);
        } catch (error) {
          console.error('Error starting new work session after break:', error);
          Alert.alert('Error', 'Failed to start next work session. Please try again.');
          setShowSubjectSelection(true);
          setIsRunning(false);
        }
      } else {
        // No more sessions or no subject
        setShowSubjectSelection(true);
        setIsRunning(false);
      }
    }
  }, [sessionType, completedSessions, sessionsBeforeLongBreak, longBreakTime, shortBreakTime, workTime, activeSession, endStudySession, distractionCount, selectedSubject, startStudySession, totalSessions, triggerInterstitialOnAction]);

  // Update timer when settings change and not running
  useEffect(() => {
    if (!isRunning && sessionType === 'work') {
      const duration = workTime * 60;
      console.log('Timer - Updating work duration to:', duration, 'seconds (', workTime, 'minutes)');
      setTotalTime(duration);
      setTimeRemaining(duration);
    }
  }, [workTime, isRunning, sessionType]);
  
  // Initialize timer on mount and check for background timer recovery
  useEffect(() => {
    const duration = workTime * 60;
    setTotalTime(duration);
    setTimeRemaining(duration);
    // Reset actual elapsed time on mount
    actualElapsedTime.current = 0;
    // Ensure we start in work mode
    setSessionType('work');
    
    // Check for background timer recovery on app startup
    const checkBackgroundTimer = async () => {
      try {
        const progress = await backgroundTimer.getTimerProgress();
        if (progress && progress.state) {
          // Restore timer state from background
          setSelectedSubject(progress.state.subjectId);
          setTimerMode(progress.state.mode);
          setSessionType(progress.state.sessionType);
          setCompletedSessions(progress.state.completedSessions);
          setTotalSessions(progress.state.totalSessions);
          setDistractionCount(progress.state.distractionCount);
          
          if (progress.state.mode === 'pomodoro') {
            setTimeRemaining(progress.timeRemaining);
            setTotalTime(progress.state.totalTime);
            
            if (progress.isCompleted) {
              await backgroundTimer.stopBackgroundTimer();
              setTimeout(() => {
                handleSessionComplete();
              }, 500);
            } else {
              // Resume the timer
              setIsRunning(true);
              setShowSubjectSelection(false);
              actualElapsedTime.current = progress.elapsedTime;
            }
          } else {
            setElapsedTime(progress.elapsedTime);
            setIsRunning(true);
            setShowSubjectSelection(false);
            actualElapsedTime.current = progress.elapsedTime;
          }
          
          // Stop background timer since we're now active
          await backgroundTimer.stopBackgroundTimer();
        }
      } catch (error) {
        console.error('Error checking background timer on startup:', error);
      }
    };
    
    // Check after a short delay to ensure component is fully mounted
    setTimeout(checkBackgroundTimer, 1000);
  }, [workTime, handleSessionComplete]);

  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (timerMode === 'pomodoro') {
          setTimeRemaining((prev) => {
            const newTime = Math.max(0, prev - 1);
            
            // Track actual elapsed time
            actualElapsedTime.current += 1;
            
            // Check if timer just reached 0
            if (newTime === 0 && prev > 0) {
              // Clear interval immediately to prevent multiple calls
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              // Trigger completion immediately
              handleSessionComplete();
            }
            return newTime;
          });
        } else {
          // Count-up mode
          setElapsedTime(prev => prev + 1);
          actualElapsedTime.current += 1;
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, timerMode, sessionType, handleSessionComplete]);

  // Handle app state changes to keep timer running in background - improved with background timer
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      console.log('Timer - App state changed to:', nextAppState, 'isRunning:', isRunning);
      
      if (nextAppState === 'background' && isRunning) {
        // App going to background while timer is running - start background timer
        backgroundTime.current = new Date();
        console.log('Timer - App went to background at:', backgroundTime.current.toISOString());
        
        // Start background timer with current state
        try {
          await backgroundTimer.startBackgroundTimer({
            isRunning: true,
            startTime: Date.now() - (actualElapsedTime.current * 1000),
            pausedTime: 0,
            totalTime: timerMode === 'pomodoro' ? totalTime : 0,
            sessionType,
            mode: timerMode,
            subjectId: selectedSubject,
            completedSessions,
            totalSessions,
            distractionCount,
          });
          console.log('Timer - Background timer started successfully');
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
            console.log('Timer - App returned from background after:', backgroundDuration, 'seconds');
            
            // Update elapsed time and timer state from background timer
            actualElapsedTime.current = progress.elapsedTime;
            
            if (timerMode === 'pomodoro') {
              setTimeRemaining(progress.timeRemaining);
              
              if (progress.isCompleted) {
                // Timer completed while in background
                console.log('Timer - Timer completed in background, triggering completion');
                await backgroundTimer.stopBackgroundTimer();
                setTimeout(() => {
                  handleSessionComplete();
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
            console.log('Timer - Fallback: App returned from background after:', backgroundDuration, 'seconds');
            
            actualElapsedTime.current += backgroundDuration;
            
            if (timerMode === 'pomodoro') {
              setTimeRemaining(prev => {
                const newTime = Math.max(0, prev - backgroundDuration);
                console.log('Timer - Fallback: Updated time after background:', newTime, 'was:', prev);
                
                if (newTime === 0 && prev > 0) {
                  setTimeout(() => {
                    handleSessionComplete();
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
  }, [isRunning, timerMode, handleSessionComplete, totalTime, sessionType, selectedSubject, completedSessions, totalSessions, distractionCount]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDistraction = () => {
    setDistractionCount(prev => prev + 1);
    // Change motivational message
    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    setMotivationalText(randomMessage);
  };

  const getProgressOffset = () => {
    if (timerMode === 'pomodoro') {
      const progress = (totalTime - timeRemaining) / totalTime;
      return CIRCUMFERENCE - (progress * CIRCUMFERENCE);
    } else {
      // For count-up, show continuous progress (full circle every hour)
      const progress = (elapsedTime % 3600) / 3600;
      return CIRCUMFERENCE - (progress * CIRCUMFERENCE);
    }
  };

  const getSessionInfo = () => {
    const currentSession = completedSessions + 1;
    
    if (sessionType === 'work') {
      return `Session ${currentSession}/${totalSessions}`;
    } else if (sessionType === 'shortBreak') {
      return 'Short Break';
    } else {
      return 'Long Break';
    }
  };

  const getFinishTime = () => {
    const now = new Date();
    now.setSeconds(now.getSeconds() + timeRemaining);
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleStart = async () => {
    if (!selectedSubject) {
      Alert.alert('Select Subject', 'Please select a subject before starting the timer.');
      return;
    }
    
    console.log('Timer - handleStart called');
    console.log('Timer - selectedSubject:', selectedSubject);
    console.log('Timer - timerMode:', timerMode);
    console.log('Timer - sessionType:', sessionType);
    console.log('Timer - timeRemaining:', timeRemaining);
    console.log('Timer - activeSession:', activeSession);
    
    try {
      // Reset background time to prevent issues
      backgroundTime.current = null;
      
      // Only start study session for work sessions, not breaks
      if (sessionType === 'work') {
        if (!activeSession) {
          console.log('Timer - Starting new study session for subject:', selectedSubject);
          await startStudySession(selectedSubject);
          sessionStartTime.current = new Date();
          actualElapsedTime.current = 0;
        } else if (activeSession.isPaused) {
          console.log('Timer - Resuming paused session');
          await resumeStudySession();
        }
      } else {
        console.log('Timer - Starting break session (no study session needed)');
        actualElapsedTime.current = 0;
      }
      
      console.log('Timer - Setting isRunning to true');
      setIsRunning(true);
      setShowSubjectSelection(false);
      
      // Force a small delay to ensure state is updated before timer starts
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error starting session:', error);
      Alert.alert('Error', 'Failed to start timer. Please try again.');
    }
  };
  
  const handlePause = async () => {
    try {
      console.log('Timer - Pausing timer, sessionType:', sessionType);
      setIsRunning(false);
      
      // Only pause study session for work sessions
      if (activeSession && sessionType === 'work') {
        await pauseStudySession();
      }
    } catch (error) {
      console.error('Error pausing session:', error);
      Alert.alert('Error', 'Failed to pause timer. Please try again.');
    }
  };

  const handleStop = async () => {
    try {
      setIsRunning(false);
      
      if (activeSession) {
        const actualMinutes = Math.round(actualElapsedTime.current / 60);
        const notes = timerMode === 'pomodoro' 
          ? `Pomodoro session (${actualMinutes} min) with ${distractionCount} distractions`
          : `Focus session (${actualMinutes} min)`;
        
        console.log('Timer - Ending study session with notes:', notes);
        console.log('Timer - Actual elapsed time:', actualElapsedTime.current, 'seconds =', actualMinutes, 'minutes');
        const session = await endStudySession(notes);
        console.log('Timer - Session ended successfully:', session);
        console.log('Timer - Session duration:', session?.duration, 'minutes');
        console.log('Timer - Session date:', session?.date);
        
        if (session && session.duration > 0) {
          Alert.alert(
            'Session Complete',
            `You studied for ${session.duration} minutes${timerMode === 'pomodoro' ? ` with ${distractionCount} distractions` : ''}.`,
            [{ text: 'OK' }]
          );
        }
      }
      
      // Reset
      if (timerMode === 'pomodoro') {
        const duration = workTime * 60;
        setSessionType('work');
        setTotalTime(duration);
        setTimeRemaining(duration);
        setCompletedSessions(0);
      } else {
        setElapsedTime(0);
      }
      setDistractionCount(0);
      setShowSubjectSelection(true);
      sessionStartTime.current = null;
      actualElapsedTime.current = 0;
    } catch (error) {
      console.error('Error stopping session:', error);
      Alert.alert('Error', 'Failed to stop timer. Please try again.');
    }
  };

  const handleSkip = () => {
    setIsRunning(false);
    
    if (sessionType === 'work') {
      // Skip to break
      if ((completedSessions + 1) % sessionsBeforeLongBreak === 0) {
        const duration = longBreakTime * 60;
        setSessionType('longBreak');
        setTotalTime(duration);
        setTimeRemaining(duration);
      } else {
        const duration = shortBreakTime * 60;
        setSessionType('shortBreak');
        setTotalTime(duration);
        setTimeRemaining(duration);
      }
      setCompletedSessions(prev => prev + 1);
    } else {
      // Skip break, go to work - start a new study session
      const duration = workTime * 60;
      setSessionType('work');
      setTotalTime(duration);
      setTimeRemaining(duration);
      
      // Start a new study session for the next work period
      if (selectedSubject) {
        startStudySession(selectedSubject).then(() => {
          sessionStartTime.current = new Date();
          actualElapsedTime.current = 0;
          setIsRunning(true);
        }).catch(error => {
          console.error('Error starting new work session after skip:', error);
        });
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Subject Selection */}
        {showSubjectSelection && (
          <View style={styles.selectionContainer}>
            <Text style={styles.selectionTitle}>Select Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
              <View style={styles.subjectRow}>
                {displaySubjects.map(subject => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[
                      styles.subjectCard,
                      selectedSubject === subject.id && styles.selectedSubjectCard,
                    ]}
                    onPress={() => setSelectedSubject(subject.id)}
                  >
                    <View style={[styles.subjectColorBar, { backgroundColor: subject.color }]} />
                    <Text 
                      style={[
                        styles.subjectCardText,
                        selectedSubject === subject.id && styles.selectedSubjectCardText,
                      ]}
                    >
                      {subject.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            
            {/* Timer Mode Selection */}
            <Text style={styles.modeTitle}>Timer Mode</Text>
            <View style={styles.modeContainer}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  timerMode === 'pomodoro' && styles.selectedModeButton,
                ]}
                onPress={() => {
                  if (!selectedSubject) {
                    Alert.alert('Select Subject', 'Please select a subject first.');
                    return;
                  }
                  
                  setTimerMode('pomodoro');
                  const duration = workTime * 60;
                  setTimeRemaining(duration);
                  setTotalTime(duration);
                  setSessionType('work');
                  setCompletedSessions(0);
                  setDistractionCount(0);
                  actualElapsedTime.current = 0;
                }}
              >
                <Text style={[
                  styles.modeButtonText,
                  timerMode === 'pomodoro' && styles.selectedModeButtonText,
                ]}>
                  Pomodoro
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  timerMode === 'countup' && styles.selectedModeButton,
                ]}
                onPress={async () => {
                  if (!selectedSubject) {
                    Alert.alert('Select Subject', 'Please select a subject first.');
                    return;
                  }
                  setTimerMode('countup');
                  setElapsedTime(0);
                  
                  // Auto-start the timer when switching to Count Up mode
                  try {
                    console.log('Timer - Auto-starting Count Up for subject:', selectedSubject);
                    await startStudySession(selectedSubject);
                    sessionStartTime.current = new Date();
                    actualElapsedTime.current = 0;
                    setIsRunning(true);
                    setShowSubjectSelection(false);
                  } catch (error) {
                    console.error('Error auto-starting Count Up:', error);
                    Alert.alert('Error', 'Failed to start timer. Please try again.');
                  }
                }}
              >
                <Text style={[
                  styles.modeButtonText,
                  timerMode === 'countup' && styles.selectedModeButtonText,
                ]}>
                  Count Up
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Pomodoro Settings - Always show when Pomodoro is selected */}
            {timerMode === 'pomodoro' && selectedSubject && (
              <View style={styles.pomodoroSettingsContainer}>
                <Text style={styles.pomodoroSettingsTitle}>Configure Pomodoro Timer</Text>
                
                <View style={styles.settingsGrid}>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Work Duration</Text>
                    <View style={styles.inputContainer}>
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setWorkTime(Math.max(1, workTime - 1))}
                      >
                        <FontAwesome name="minus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.timeInput}
                        value={workTime.toString()}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 1;
                          setWorkTime(Math.max(1, Math.min(120, num)));
                        }}
                        keyboardType="numeric"
                        maxLength={3}
                        selectTextOnFocus
                      />
                      <Text style={styles.unitText}>min</Text>
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setWorkTime(Math.min(120, workTime + 1))}
                      >
                        <FontAwesome name="plus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Short Break</Text>
                    <View style={styles.inputContainer}>
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setShortBreakTime(Math.max(1, shortBreakTime - 1))}
                      >
                        <FontAwesome name="minus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.timeInput}
                        value={shortBreakTime.toString()}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 1;
                          setShortBreakTime(Math.max(1, Math.min(60, num)));
                        }}
                        keyboardType="numeric"
                        maxLength={2}
                        selectTextOnFocus
                      />
                      <Text style={styles.unitText}>min</Text>
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setShortBreakTime(Math.min(60, shortBreakTime + 1))}
                      >
                        <FontAwesome name="plus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Long Break</Text>
                    <View style={styles.inputContainer}>
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setLongBreakTime(Math.max(1, longBreakTime - 1))}
                      >
                        <FontAwesome name="minus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.timeInput}
                        value={longBreakTime.toString()}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 1;
                          setLongBreakTime(Math.max(1, Math.min(120, num)));
                        }}
                        keyboardType="numeric"
                        maxLength={3}
                        selectTextOnFocus
                      />
                      <Text style={styles.unitText}>min</Text>
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setLongBreakTime(Math.min(120, longBreakTime + 1))}
                      >
                        <FontAwesome name="plus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Total Sessions</Text>
                    <View style={styles.inputContainer}>
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setTotalSessions(Math.max(1, totalSessions - 1))}
                      >
                        <FontAwesome name="minus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.timeInput}
                        value={totalSessions.toString()}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 1;
                          setTotalSessions(Math.max(1, Math.min(20, num)));
                        }}
                        keyboardType="numeric"
                        maxLength={2}
                        selectTextOnFocus
                      />
                      <TouchableOpacity 
                        style={styles.adjustButton}
                        onPress={() => setTotalSessions(Math.min(20, totalSessions + 1))}
                      >
                        <FontAwesome name="plus" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {totalSessions > 1 && (
                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Long Break After</Text>
                      <View style={styles.inputContainer}>
                        <TouchableOpacity 
                          style={styles.adjustButton}
                          onPress={() => setSessionsBeforeLongBreak(Math.max(2, sessionsBeforeLongBreak - 1))}
                        >
                          <FontAwesome name="minus" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.timeInput}
                          value={sessionsBeforeLongBreak.toString()}
                          onChangeText={(text) => {
                            const num = parseInt(text) || 2;
                            setSessionsBeforeLongBreak(Math.max(2, Math.min(totalSessions, num)));
                          }}
                          keyboardType="numeric"
                          maxLength={2}
                          selectTextOnFocus
                        />
                        <Text style={styles.unitText}>sessions</Text>
                        <TouchableOpacity 
                          style={styles.adjustButton}
                          onPress={() => setSessionsBeforeLongBreak(Math.min(totalSessions, sessionsBeforeLongBreak + 1))}
                        >
                          <FontAwesome name="plus" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
                
                {/* Timer Preview */}
                <View style={styles.timerPreview}>
                  <Text style={styles.timerPreviewLabel}>Timer will start with:</Text>
                  <Text style={styles.timerPreviewTime}>{workTime}:00</Text>
                  {totalSessions > 1 && (
                    <Text style={styles.timerPreviewInfo}>
                      {totalSessions} work sessions with breaks
                    </Text>
                  )}
                </View>
                
                {/* Start Pomodoro Button */}
                <TouchableOpacity
                  style={styles.startPomodoroButton}
                  onPress={async () => {
                    const subject = displaySubjects.find(s => s.id === selectedSubject);
                    if (!subject) {
                      Alert.alert('Error', 'Subject not found.');
                      return;
                    }
                    
                    try {
                      console.log('Timer - Starting Pomodoro for subject:', selectedSubject);
                      await startStudySession(selectedSubject);
                      sessionStartTime.current = new Date();
                      actualElapsedTime.current = 0;
                      
                      // Set initial state for Pomodoro
                      setSessionType('work');
                      setCompletedSessions(0);
                      setDistractionCount(0);
                      const duration = workTime * 60;
                      setTotalTime(duration);
                      setTimeRemaining(duration);
                      
                      // Navigate to immersive timer
                      const immersiveParams = {
                        subjectId: selectedSubject,
                        subjectName: subject.name,
                        subjectColor: subject.color,
                        mode: 'pomodoro',
                        workTime: workTime.toString(),
                        shortBreakTime: shortBreakTime.toString(),
                        longBreakTime: longBreakTime.toString(),
                        sessionsBeforeLongBreak: sessionsBeforeLongBreak.toString(),
                        sessionType: 'work',
                        initialTime: duration.toString(),
                        totalTime: duration.toString(),
                        completedSessions: '0',
                        totalSessions: totalSessions.toString(),
                      };
                      console.log('Timer - Navigating to immersive timer with params:', immersiveParams);
                      setIsRunning(true);
                      setShowSubjectSelection(false);
                      
                      router.push({
                        pathname: '/immersive-timer',
                        params: immersiveParams,
                      });
                    } catch (error) {
                      console.error('Error starting Pomodoro:', error);
                      Alert.alert('Error', 'Failed to start timer. Please try again.');
                    }
                  }}
                >
                  <Ionicons name="play" size={20} color="#FFFFFF" />
                  <Text style={styles.startPomodoroButtonText}>Start Pomodoro Timer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        
        {/* Active Timer */}
        {!showSubjectSelection && (
          <>
            {/* Current Subject */}
            <View style={styles.activeSubjectContainer}>
              <Text style={styles.activeSubjectLabel}>Studying</Text>
              <View style={styles.activeSubject}>
                <View style={[
                  styles.activeSubjectDot,
                  { backgroundColor: displaySubjects.find(s => s.id === selectedSubject)?.color || '#4ECDC4' }
                ]} />
                <Text style={styles.activeSubjectName}>
                  {displaySubjects.find(s => s.id === selectedSubject)?.name || ''}
                </Text>
              </View>
            </View>
            
            {/* Timer Display */}
            <TouchableOpacity 
              style={styles.timerSection}
              onPress={timerMode === 'pomodoro' && sessionType === 'work' ? handleDistraction : undefined}
              activeOpacity={timerMode === 'pomodoro' && sessionType === 'work' ? 0.8 : 1}
            >
              <Text style={styles.timerText}>
                {timerMode === 'pomodoro' ? formatTime(timeRemaining) : formatTime(elapsedTime)}
              </Text>
              {/* Motivational Text for Pomodoro */}
              {timerMode === 'pomodoro' && (
                <Text style={styles.motivationalText}>{motivationalText}</Text>
              )}
              {/* Distraction hint for Pomodoro work sessions */}
              {timerMode === 'pomodoro' && sessionType === 'work' && (
                <Text style={styles.distractionHint}>Tap when distracted</Text>
              )}
            </TouchableOpacity>
        
        {/* Circular Progress */}
        <View style={[styles.circleContainer, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={styles.svg}>
            {/* Background Circle */}
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="#E5E5EA"
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />
            {/* Progress Circle */}
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={sessionType === 'work' ? '#4ECDC4' : '#FFA500'}
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={getProgressOffset()}
              strokeLinecap="round"
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          
          {/* Settings Button in Center for Pomodoro */}
          {timerMode === 'pomodoro' ? (
            <TouchableOpacity 
              style={[
                styles.centerButton,
                {
                  width: CIRCLE_SIZE - 80,
                  height: CIRCLE_SIZE - 80,
                  borderRadius: (CIRCLE_SIZE - 80) / 2,
                }
              ]} 
              onPress={() => setShowSettings(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="settings" size={32} color="#636366" />
              <Text style={styles.settingsLabel}>Timer Settings</Text>
            </TouchableOpacity>
          ) : (
            <View 
              style={[
                styles.centerButton,
                {
                  width: CIRCLE_SIZE - 80,
                  height: CIRCLE_SIZE - 80,
                  borderRadius: (CIRCLE_SIZE - 80) / 2,
                }
              ]}
            >
              <Text style={styles.focusText}>Stay Focused!</Text>
            </View>
          )}
        </View>

            {/* Control Buttons */}
            <View style={styles.controls}>
              {!isRunning ? (
                <TouchableOpacity 
                  style={styles.mainButton}
                  onPress={handleStart}
                >
                  <Ionicons name="play" size={24} color="#FFFFFF" />
                  <Text style={styles.mainButtonText}>Start</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.mainButton, styles.pauseButton]}
                  onPress={handlePause}
                >
                  <Ionicons name="pause" size={24} color="#FFFFFF" />
                  <Text style={styles.mainButtonText}>Pause</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.stopButton}
                onPress={handleStop}
              >
                <MaterialIcons name="rotate-left" size={24} color="#FF6B6B" />
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>

            {/* Session Info for Pomodoro */}
            {timerMode === 'pomodoro' && (
              <>
                <Text style={styles.sessionInfo}>{getSessionInfo()}</Text>
                {isRunning && (
                  <Text style={styles.finishTime}>Timer will finish at {getFinishTime()}</Text>
                )}
              </>
            )}
            
            {/* Distraction Counter for Pomodoro work sessions */}
            {timerMode === 'pomodoro' && sessionType === 'work' && (
              <View style={styles.distractionCounter}>
                <Text style={styles.distractionCountText}>Distractions: {distractionCount}</Text>
              </View>
            )}
            
            {/* Skip Button for Pomodoro - Show for all breaks */}
            {timerMode === 'pomodoro' && sessionType !== 'work' && (
              <TouchableOpacity 
                style={styles.skipBreakButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>
                  Skip {sessionType === 'shortBreak' ? 'Short' : 'Long'} Break
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
        
        {/* Banner Ad */}
        {shouldShowBannerAd() && showSubjectSelection && (
          <View style={styles.adContainer}>
            <AdBanner size="medium" />
          </View>
        )}
      </ScrollView>
      
      {/* Interstitial Ad */}
      <InterstitialAd 
        visible={interstitialAdVisible}
        onClose={hideInterstitialAd}
      />
      
      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Timer Settings</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowSettings(false)}
            >
              <Ionicons name="close" size={24} color="#636366" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingHeader}>
                <Text style={styles.settingLabel}>Work Duration</Text>
                <View style={styles.inputContainer}>
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setWorkTime(Math.max(1, workTime - 1))}
                  >
                    <FontAwesome name="minus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={workTime.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      setWorkTime(Math.max(1, Math.min(120, num)));
                    }}
                    keyboardType="numeric"
                    maxLength={3}
                    selectTextOnFocus
                  />
                  <Text style={styles.unitText}>min</Text>
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setWorkTime(Math.min(120, workTime + 1))}
                  >
                    <FontAwesome name="plus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingHeader}>
                <Text style={styles.settingLabel}>Short Break</Text>
                <View style={styles.inputContainer}>
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setShortBreakTime(Math.max(1, shortBreakTime - 1))}
                  >
                    <FontAwesome name="minus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={shortBreakTime.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      setShortBreakTime(Math.max(1, Math.min(60, num)));
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <Text style={styles.unitText}>min</Text>
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setShortBreakTime(Math.min(60, shortBreakTime + 1))}
                  >
                    <FontAwesome name="plus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingHeader}>
                <Text style={styles.settingLabel}>Long Break</Text>
                <View style={styles.inputContainer}>
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setLongBreakTime(Math.max(1, longBreakTime - 1))}
                  >
                    <FontAwesome name="minus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={longBreakTime.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      setLongBreakTime(Math.max(1, Math.min(120, num)));
                    }}
                    keyboardType="numeric"
                    maxLength={3}
                    selectTextOnFocus
                  />
                  <Text style={styles.unitText}>min</Text>
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setLongBreakTime(Math.min(120, longBreakTime + 1))}
                  >
                    <FontAwesome name="plus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingHeader}>
                <Text style={styles.settingLabel}>Total Sessions</Text>
                <View style={styles.inputContainer}>
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setTotalSessions(Math.max(1, totalSessions - 1))}
                  >
                    <FontAwesome name="minus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={totalSessions.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      setTotalSessions(Math.max(1, Math.min(20, num)));
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                    selectTextOnFocus
                  />
                  <TouchableOpacity 
                    style={styles.adjustButton}
                    onPress={() => setTotalSessions(Math.min(20, totalSessions + 1))}
                  >
                    <FontAwesome name="plus" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            {totalSessions > 1 && (
              <View style={styles.settingItem}>
                <View style={styles.settingHeader}>
                  <Text style={styles.settingLabel}>Sessions Before Long Break</Text>
                  <Text style={styles.settingValue}>{sessionsBeforeLongBreak}</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={2}
                  maximumValue={Math.min(10, totalSessions)}
                  value={sessionsBeforeLongBreak}
                  onValueChange={(value: number) => setSessionsBeforeLongBreak(Math.round(value))}
                  minimumTrackTintColor="#4ECDC4"
                  maximumTrackTintColor="#E5E5EA"
                  thumbTintColor="#4ECDC4"
                  step={1}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>2</Text>
                  <Text style={styles.sliderLabel}>{Math.min(10, totalSessions)}</Text>
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={() => {
                setWorkTime(DEFAULT_WORK_TIME);
                setShortBreakTime(DEFAULT_SHORT_BREAK);
                setLongBreakTime(DEFAULT_LONG_BREAK);
                setSessionsBeforeLongBreak(DEFAULT_SESSIONS_BEFORE_LONG_BREAK);
                setTotalSessions(1);
                
                // Reset current session if not running
                if (!isRunning) {
                  const duration = DEFAULT_WORK_TIME * 60;
                  setTotalTime(duration);
                  setTimeRemaining(duration);
                  setSessionType('work');
                  setCompletedSessions(0);
                  setDistractionCount(0);
                }
              }}
            >
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  selectionContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  subjectScroll: {
    marginBottom: 30,
  },
  subjectRow: {
    flexDirection: 'row',
    gap: 12,
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedSubjectCard: {
    borderColor: '#4ECDC4',
    backgroundColor: '#F0FDFC',
  },
  subjectColorBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  subjectCardText: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
  },
  selectedSubjectCardText: {
    color: '#1C1C1E',
    fontWeight: '500',
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedModeButton: {
    borderColor: '#4ECDC4',
    backgroundColor: '#F0FDFC',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#636366',
  },
  selectedModeButtonText: {
    color: '#1C1C1E',
    fontWeight: '600',
  },
  activeSubjectContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  activeSubjectLabel: {
    fontSize: 14,
    color: '#636366',
    marginBottom: 8,
  },
  activeSubject: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activeSubjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  activeSubjectName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  timerText: {
    fontSize: 56,
    fontWeight: '300',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  motivationalText: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  svg: {
    position: 'absolute',
  },
  centerButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsLabel: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
    marginTop: 8,
  },
  focusText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#4ECDC4',
  },

  controls: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: '#4ECDC4',
  },
  pauseButton: {
    backgroundColor: '#FFA500',
  },
  mainButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  skipBreakButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#636366',
  },
  sessionInfo: {
    fontSize: 16,
    color: '#4ECDC4',
    marginBottom: 10,
    fontWeight: '500',
  },
  finishTime: {
    fontSize: 14,
    color: '#636366',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  settingItem: {
    marginBottom: 32,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 18,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#636366',
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInput: {
    backgroundColor: '#F8F9FA',
    color: '#1C1C1E',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  unitText: {
    fontSize: 16,
    color: '#636366',
    fontWeight: '500',
  },
  noSubjectsContainer: {
    backgroundColor: '#2C3E50',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  noSubjectsText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  noSubjectsHint: {
    fontSize: 14,
    color: '#8A95A6',
  },
  distractionHint: {
    fontSize: 12,
    color: '#636366',
    marginTop: 8,
    fontStyle: 'italic',
  },
  distractionCounter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  distractionCountText: {
    fontSize: 14,
    color: '#FFA500',
    fontWeight: '500',
  },
  pomodoroSettingsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pomodoroSettingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  timerPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  timerPreviewLabel: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 8,
  },
  timerPreviewTime: {
    fontSize: 32,
    fontWeight: '300',
    color: '#4ECDC4',
    fontVariant: ['tabular-nums'],
  },
  timerPreviewInfo: {
    fontSize: 14,
    color: '#636366',
    marginTop: 8,
  },
  settingsGrid: {
    gap: 16,
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  startPomodoroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  startPomodoroButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
});