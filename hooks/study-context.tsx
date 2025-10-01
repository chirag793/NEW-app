import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StudySession, TestScore, Subject, StudyPlan, DailyStats, User } from '@/types/study';
import { iCloudBackupService } from '@/utils/icloud-backup';

// Helper functions for merging data
const mergeSessions = (local: StudySession[], cloud: StudySession[]): StudySession[] => {
  const sessionMap = new Map<string, StudySession>();
  
  // Add local sessions
  local.forEach(session => {
    if (session && session.id) {
      sessionMap.set(session.id, session);
    }
  });
  
  // Add/override with cloud sessions
  cloud.forEach(session => {
    if (session && session.id) {
      sessionMap.set(session.id, session);
    }
  });
  
  return Array.from(sessionMap.values()).sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
};

const mergeScores = (local: TestScore[], cloud: TestScore[]): TestScore[] => {
  const scoreMap = new Map<string, TestScore>();
  
  // Add local scores
  local.forEach(score => {
    if (score && score.id) {
      scoreMap.set(score.id, score);
    }
  });
  
  // Add/override with cloud scores
  cloud.forEach(score => {
    if (score && score.id) {
      scoreMap.set(score.id, score);
    }
  });
  
  return Array.from(scoreMap.values()).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

const getStorageKeys = (userId?: string) => {
  const prefix = userId ? `user_${userId}_` : 'guest_';
  return {
    STUDY_SESSIONS: `${prefix}study_sessions`,
    TEST_SCORES: `${prefix}test_scores`,
    SUBJECTS: `${prefix}subjects`,
    STUDY_PLANS: `${prefix}study_plans`,
    ACTIVE_SESSION: `${prefix}active_session`,
    EXAM_DATES: `${prefix}exam_dates`,
    TODAY_PROGRESS: `${prefix}today_progress`,
    DAILY_TARGET_HOURS: `${prefix}daily_target_hours`,
    // Cloud sync keys for authenticated users
    CLOUD_STUDY_SESSIONS: `cloud_${prefix}study_sessions`,
    CLOUD_TEST_SCORES: `cloud_${prefix}test_scores`,
    CLOUD_SUBJECTS: `cloud_${prefix}subjects`,
    CLOUD_STUDY_PLANS: `cloud_${prefix}study_plans`,
    CLOUD_EXAM_DATES: `cloud_${prefix}exam_dates`,
    CLOUD_TODAY_PROGRESS: `cloud_${prefix}today_progress`,
    CLOUD_DAILY_TARGET_HOURS: `cloud_${prefix}daily_target_hours`,
    LAST_CLOUD_SYNC: `${prefix}last_cloud_sync`,
  };
};

export const [StudyProvider, useStudy] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [testScores, setTestScores] = useState<TestScore[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [activeSession, setActiveSession] = useState<{
    subjectId: string;
    startTime: string;
    pausedTime?: number;
    lastPauseStart?: string;
    isPaused?: boolean;
  } | null>(null);
  const [examDates, setExamDates] = useState<{
    NEET_PG: string;
    INICET: string;
  }>({ NEET_PG: '', INICET: '' });
  const [dailyTargetHours, setDailyTargetHours] = useState<number>(4); // Default 4 hours
  const [isLoading, setIsLoading] = useState(true);
  
  // Simple daily progress tracking
  const [todayProgress, setTodayProgress] = useState<{
    date: string;
    totalMinutes: number;
    lastResetTime: string;
  }>({ 
    date: new Date().toISOString().split('T')[0], 
    totalMinutes: 0, 
    lastResetTime: new Date().toISOString() 
  });

  const safeJsonParse = (data: string | null | undefined, fallback: any = null) => {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    
    try {
      if (typeof data === 'object' && data !== null) {
        return data;
      }
      
      const dataStr = typeof data === 'string' ? data : String(data);
      const trimmed = dataStr.trim();
      
      if (trimmed === '') return fallback;
      
      const corruptionPatterns = [
        /^object$/i,
        /^object\s/i,
        /^object Object$/i,
        /^\[object Object\]$/i,
        /^o$/,
        /^ob$/,
        /^obj$/,
        /^obje$/,
        /^objec$/,
      ];
      
      const isCorrupted = corruptionPatterns.some(pattern => pattern.test(trimmed));
      
      if (isCorrupted) {
        console.warn('Detected corrupted data pattern, returning fallback:', trimmed.substring(0, 50));
        return fallback;
      }
      
      const startsWithValidJson = trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"');
      const isValidPrimitive = ['true', 'false', 'null'].includes(trimmed.toLowerCase()) || /^-?\d*\.?\d+$/.test(trimmed);
      
      if (!startsWithValidJson && !isValidPrimitive) {
        console.warn('Data does not look like valid JSON, returning fallback:', trimmed.substring(0, 50));
        return fallback;
      }
      
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (parseError) {
        console.warn('JSON parse failed, returning fallback. Error:', parseError instanceof Error ? parseError.message : 'Unknown error', 'Data preview:', trimmed.substring(0, 50));
        return fallback;
      }
      
      if (parsed === null || parsed === undefined) {
        return fallback;
      }
      
      return parsed;
    } catch (error) {
      console.warn('Critical error in safeJsonParse, returning fallback. Error:', error instanceof Error ? error.message : 'Unknown error', 'Data preview:', data?.toString().substring(0, 50));
      return fallback;
    }
  };

  const loadCurrentUser = useCallback(async () => {
    try {
      let userData = await AsyncStorage.getItem('user_data');
      if (!userData) {
        userData = await AsyncStorage.getItem('USER');
      }
      
      const parsedUser = safeJsonParse(userData, null);
      
      if (parsedUser && parsedUser.id && parsedUser.email) {
        console.log('Study context: User loaded:', parsedUser.email);
        setCurrentUser(parsedUser);
        return parsedUser;
      }
      
      console.log('Study context: No user found');
      setCurrentUser(null);
      return null;
    } catch (error) {
      console.error('Error loading current user:', error);
      try {
        await AsyncStorage.removeItem('user_data');
        await AsyncStorage.removeItem('USER');
      } catch (clearError) {
        console.error('Error clearing corrupted user data:', clearError);
      }
      setCurrentUser(null);
      return null;
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const STORAGE_KEYS = getStorageKeys(currentUser?.id);
      console.log('loadData - Loading data for user:', currentUser?.id || 'guest');
      
      const [sessionsData, scoresData, subjectsData, plansData, activeData, datesData, todayProgressData, targetHoursData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS),
        AsyncStorage.getItem(STORAGE_KEYS.TEST_SCORES),
        AsyncStorage.getItem(STORAGE_KEYS.SUBJECTS),
        AsyncStorage.getItem(STORAGE_KEYS.STUDY_PLANS),
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION),
        AsyncStorage.getItem(STORAGE_KEYS.EXAM_DATES),
        AsyncStorage.getItem(STORAGE_KEYS.TODAY_PROGRESS),
        AsyncStorage.getItem(STORAGE_KEYS.DAILY_TARGET_HOURS),
      ]);
      
      console.log('loadData - Raw data loaded');

      let parsedSessions = safeJsonParse(sessionsData, []);
      let parsedScores = safeJsonParse(scoresData, []);
      let parsedActive = safeJsonParse(activeData, null);
      let parsedDates = safeJsonParse(datesData, null);
      let parsedSubjects = safeJsonParse(subjectsData, null);
      let parsedPlans = safeJsonParse(plansData, []);
      let parsedTodayProgress = safeJsonParse(todayProgressData, null);
      let parsedTargetHours = safeJsonParse(targetHoursData, 4); // Default 4 hours
      
      if (Array.isArray(parsedSessions)) {
        parsedSessions = parsedSessions.filter(s => s && s.id && s.subjectId && s.startTime && typeof s.duration === 'number');
      } else {
        parsedSessions = [];
      }
      
      if (Array.isArray(parsedScores)) {
        parsedScores = parsedScores.filter(s => s && s.id && s.testName);
      } else {
        parsedScores = [];
      }
      
      if (Array.isArray(parsedPlans)) {
        parsedPlans = parsedPlans.filter(p => p && p.subjectId);
      } else {
        parsedPlans = [];
      }

      if (!parsedSubjects || !Array.isArray(parsedSubjects) || parsedSubjects.length === 0) {
        console.log('No subjects found in storage, will initialize defaults after load');
        parsedSubjects = [];
      }
      
      if (!parsedDates) {
        parsedDates = { NEET_PG: '', INICET: '' };
      }
      
      // Initialize or reset today's progress if needed
      const today = new Date().toISOString().split('T')[0];
      if (!parsedTodayProgress || parsedTodayProgress.date !== today) {
        parsedTodayProgress = {
          date: today,
          totalMinutes: 0,
          lastResetTime: new Date().toISOString()
        };
      } else {
        // Check if we need to reset at 3:00 AM
        const now = new Date();
        const lastReset = new Date(parsedTodayProgress.lastResetTime);
        const today3AM = new Date(now);
        today3AM.setHours(3, 0, 0, 0);
        
        // If it's past 3 AM and we haven't reset since yesterday's 3 AM
        if (now >= today3AM && lastReset < today3AM) {
          parsedTodayProgress = {
            date: today,
            totalMinutes: 0,
            lastResetTime: now.toISOString()
          };
        }
      }
      
      const recalculatedSubjects = parsedSubjects.map((subject: Subject) => {
        const subjectSessions = parsedSessions.filter((s: StudySession) => s && s.subjectId === subject.id);
        const completedMinutes = subjectSessions.reduce((sum: number, s: StudySession) => {
          const duration = typeof s.duration === 'number' ? s.duration : 0;
          return sum + Math.max(0, duration);
        }, 0);
        return {
          ...subject,
          completedHours: completedMinutes / 60,
        };
      });

      setStudySessions(parsedSessions);
      setTestScores(parsedScores);
      setActiveSession(parsedActive);
      setStudyPlans(parsedPlans);
      setExamDates(parsedDates);
      setSubjects(recalculatedSubjects);
      setTodayProgress(parsedTodayProgress);
      setDailyTargetHours(typeof parsedTargetHours === 'number' && parsedTargetHours > 0 ? parsedTargetHours : 4);
      
      const savePromises = [];
      if (recalculatedSubjects.length > 0) {
        savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(recalculatedSubjects)));
      }
      if (parsedSessions.length > 0) {
        savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(parsedSessions)));
      }
      if (parsedDates.NEET_PG || parsedDates.INICET) {
        savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.EXAM_DATES, JSON.stringify(parsedDates)));
      }
      
      // Always save today's progress and target hours
      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.TODAY_PROGRESS, JSON.stringify(parsedTodayProgress)),
        AsyncStorage.setItem(STORAGE_KEYS.DAILY_TARGET_HOURS, JSON.stringify(parsedTargetHours))
      );
      
      if (savePromises.length > 0) {
        await Promise.all(savePromises);
      }
      
      console.log('loadData - Data loaded successfully:', {
        sessions: parsedSessions.length,
        scores: parsedScores.length,
        subjects: recalculatedSubjects.length,
        plans: parsedPlans.length,
        todayProgress: parsedTodayProgress.totalMinutes,
        user: currentUser?.id || 'guest'
      });
      
    } catch (error) {
      console.error('Error loading data:', error);
      setStudySessions([]);
      setTestScores([]);
      setActiveSession(null);
      setStudyPlans([]);
      setExamDates({ NEET_PG: '', INICET: '' });
      setSubjects([]);
      setTodayProgress({ 
        date: new Date().toISOString().split('T')[0], 
        totalMinutes: 0, 
        lastResetTime: new Date().toISOString() 
      });
      setDailyTargetHours(4);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  // Load current user and initialize data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app - loading user...');
        await loadCurrentUser();
      } catch (error) {
        console.error('Error during app initialization:', error);
        await loadCurrentUser();
      }
    };
    
    initializeApp();
  }, [loadCurrentUser]);

  // Load data when user changes
  useEffect(() => {
    let isActive = true;
    
    const handleUserChange = async () => {
      if (currentUser !== undefined && isActive) {
        console.log('handleUserChange - User state changed:', currentUser?.id || 'guest');
        if (currentUser === null) {
          console.log('handleUserChange - Clearing data for logged out user');
          setStudySessions([]);
          setTestScores([]);
          setSubjects([]);
          setStudyPlans([]);
          setActiveSession(null);
          setExamDates({ NEET_PG: '', INICET: '' });
          setTodayProgress({ 
            date: new Date().toISOString().split('T')[0], 
            totalMinutes: 0, 
            lastResetTime: new Date().toISOString() 
          });
          setDailyTargetHours(4);
          setIsLoading(false);
        } else {
          console.log('handleUserChange - Loading data for user:', currentUser?.id || 'guest');
          await loadData();
        }
      }
    };
    
    handleUserChange();
    
    return () => {
      isActive = false;
    };
  }, [currentUser, loadData]);

  // Initialize default subjects if none exist after data load
  useEffect(() => {
    let isActive = true;
    
    const initializeDefaultSubjects = async () => {
      if (!isActive) return;
      
      if (!isLoading && currentUser !== undefined && subjects.length === 0) {
        console.log('No subjects found, initializing default subjects for user:', currentUser?.id || 'guest');
        const { DEFAULT_SUBJECTS } = await import('@/constants/subjects');
          console.log('Setting default subjects:', DEFAULT_SUBJECTS.length);
          setSubjects(DEFAULT_SUBJECTS);
          
          const STORAGE_KEYS = getStorageKeys(currentUser?.id);
          try {
            await AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(DEFAULT_SUBJECTS));
            console.log('Default subjects saved to storage');
          } catch (error) {
            console.error('Error saving default subjects:', error);
          }
        }
    };
    const timer = setTimeout(initializeDefaultSubjects, 500);
    
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [isLoading, currentUser, subjects.length]);

  const startStudySession = useCallback(async (subjectId: string) => {
    const session = {
      subjectId,
      startTime: new Date().toISOString(),
      pausedTime: 0,
      isPaused: false,
    };
    setActiveSession(session);
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  }, [currentUser?.id]);

  const pauseStudySession = useCallback(async () => {
    if (!activeSession || activeSession.isPaused) return;
    
    const updatedSession = {
      ...activeSession,
      isPaused: true,
      lastPauseStart: new Date().toISOString(),
    };
    
    setActiveSession(updatedSession);
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updatedSession));
  }, [activeSession, currentUser?.id]);

  const resumeStudySession = useCallback(async () => {
    if (!activeSession || !activeSession.isPaused || !activeSession.lastPauseStart) return;
    
    const pauseDuration = new Date().getTime() - new Date(activeSession.lastPauseStart).getTime();
    const updatedSession = {
      ...activeSession,
      isPaused: false,
      pausedTime: (activeSession.pausedTime || 0) + pauseDuration,
      lastPauseStart: undefined,
    };
    
    setActiveSession(updatedSession);
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updatedSession));
  }, [activeSession, currentUser?.id]);

  const endStudySession = useCallback(async (notes?: string) => {
    if (!activeSession) return null;

    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    const endTime = new Date();
    const startTime = new Date(activeSession.startTime);
    
    let totalPausedTime = activeSession.pausedTime || 0;
    
    if (activeSession.isPaused && activeSession.lastPauseStart) {
      const currentPauseDuration = endTime.getTime() - new Date(activeSession.lastPauseStart).getTime();
      totalPausedTime += currentPauseDuration;
    }
    
    const totalElapsed = endTime.getTime() - startTime.getTime();
    const actualStudyTime = totalElapsed - totalPausedTime;
    const duration = Math.max(1, Math.round(actualStudyTime / 60000));

    if (notes && (notes.toLowerCase().includes('break') || notes.toLowerCase().includes('rest'))) {
      console.error('WARNING: Attempted to save a break session to history, blocking!', notes);
      setActiveSession(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      return null;
    }

    const subject = subjects.find(s => s.id === activeSession.subjectId);
    
    const newSession: StudySession = {
      id: Date.now().toString(),
      subjectId: activeSession.subjectId,
      subjectName: subject?.name,
      startTime: activeSession.startTime,
      endTime: endTime.toISOString(),
      duration,
      date: startTime.toISOString().split('T')[0],
      notes,
    };

    console.log('endStudySession - Creating new WORK session:', newSession);
    
    const updatedSessions = [...studySessions, newSession];
    
    const updatedSubjects = subjects.map(s => 
      s.id === activeSession.subjectId 
        ? { ...s, completedHours: s.completedHours + duration / 60 }
        : s
    );
    
    // Update today's progress immediately
    const today = new Date().toISOString().split('T')[0];
    const updatedTodayProgress = {
      date: today,
      totalMinutes: todayProgress.date === today ? todayProgress.totalMinutes + duration : duration,
      lastResetTime: todayProgress.lastResetTime
    };
    
    setStudySessions(updatedSessions);
    setSubjects(updatedSubjects);
    setActiveSession(null);
    setTodayProgress(updatedTodayProgress);
    
    console.log('endStudySession - Updated today progress:', updatedTodayProgress);
    
    const savePromises = [
      AsyncStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(updatedSessions)),
      AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updatedSubjects)),
      AsyncStorage.setItem(STORAGE_KEYS.TODAY_PROGRESS, JSON.stringify(updatedTodayProgress)),
      AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION),
    ];
    
    if (currentUser?.id) {
      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_STUDY_SESSIONS, JSON.stringify(updatedSessions)),
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_SUBJECTS, JSON.stringify(updatedSubjects)),
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_TODAY_PROGRESS, JSON.stringify(updatedTodayProgress)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString())
      );
    }
    
    await Promise.all(savePromises);

    return newSession;
  }, [activeSession, studySessions, subjects, currentUser?.id, todayProgress]);

  const addTestScore = useCallback(async (testScore: Omit<TestScore, 'id'>) => {
    const newScore: TestScore = {
      ...testScore,
      id: Date.now().toString(),
    };

    const updatedScores = [...testScores, newScore];
    setTestScores(updatedScores);
    
    const updatedSubjects = subjects.map(subject => {
      const subjectTestScores = updatedScores
        .map(test => test.subjectScores.find(s => s.subjectId === subject.id))
        .filter(Boolean);
      
      if (subjectTestScores.length > 0) {
        const averageMarks = subjectTestScores.reduce((sum, score) => sum + (score?.percentage || 0), 0) / subjectTestScores.length;
        
        let marksProgress = 0;
        if (averageMarks >= 90) marksProgress = 100;
        else if (averageMarks >= 80) marksProgress = 90;
        else if (averageMarks >= 70) marksProgress = 80;
        else if (averageMarks >= 60) marksProgress = 70;
        else if (averageMarks >= 50) marksProgress = 60;
        else if (averageMarks >= 40) marksProgress = 50;
        else if (averageMarks >= 30) marksProgress = 40;
        else marksProgress = averageMarks;
        
        return {
          ...subject,
          averageMarks: Math.round(averageMarks * 10) / 10,
          marksProgress: Math.round(marksProgress),
        };
      }
      return subject;
    });
    
    setSubjects(updatedSubjects);
    
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    const savePromises = [
      AsyncStorage.setItem(STORAGE_KEYS.TEST_SCORES, JSON.stringify(updatedScores)),
      AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updatedSubjects)),
    ];
    
    if (currentUser?.id) {
      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_TEST_SCORES, JSON.stringify(updatedScores)),
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_SUBJECTS, JSON.stringify(updatedSubjects)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString())
      );
    }
    
    await Promise.all(savePromises);
    
    return newScore;
  }, [testScores, subjects, currentUser?.id]);

  const updateStudyPlan = useCallback(async (plan: StudyPlan) => {
    const existingIndex = studyPlans.findIndex(p => p.subjectId === plan.subjectId);
    let updatedPlans: StudyPlan[];
    
    if (existingIndex >= 0) {
      updatedPlans = [...studyPlans];
      updatedPlans[existingIndex] = plan;
    } else {
      updatedPlans = [...studyPlans, plan];
    }

    setStudyPlans(updatedPlans);
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    await AsyncStorage.setItem(STORAGE_KEYS.STUDY_PLANS, JSON.stringify(updatedPlans));
  }, [studyPlans, currentUser?.id]);

  const getTodayStats = useCallback((): DailyStats => {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('getTodayStats - Using simple progress tracking');
    console.log('getTodayStats - Today progress:', todayProgress);
    console.log('getTodayStats - Today date:', today);
    
    // Check if we need to reset progress (3 AM reset)
    const now = new Date();
    const lastReset = new Date(todayProgress.lastResetTime);
    const today3AM = new Date(now);
    today3AM.setHours(3, 0, 0, 0);
    
    let currentProgress = todayProgress;
    
    // Reset if needed
    if (todayProgress.date !== today || (now >= today3AM && lastReset < today3AM)) {
      console.log('getTodayStats - Resetting progress for new day or 3 AM reset');
      currentProgress = {
        date: today,
        totalMinutes: 0,
        lastResetTime: now.toISOString()
      };
      setTodayProgress(currentProgress);
      
      // Save the reset progress
      const STORAGE_KEYS = getStorageKeys(currentUser?.id);
      AsyncStorage.setItem(STORAGE_KEYS.TODAY_PROGRESS, JSON.stringify(currentProgress)).catch(error => {
        console.error('Error saving reset progress:', error);
      });
    }
    
    // For subject breakdown, we still need to calculate from today's sessions
    const todaySessions = studySessions.filter(s => {
      if (!s || !s.startTime || typeof s.duration !== 'number' || s.duration <= 0) {
        return false;
      }
      
      if (s.date && s.date === today) {
        return true;
      }
      
      try {
        const startTimeDate = new Date(s.startTime);
        if (isNaN(startTimeDate.getTime())) {
          return false;
        }
        
        const sessionDate = startTimeDate.getFullYear() + '-' + 
          String(startTimeDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(startTimeDate.getDate()).padStart(2, '0');
        
        return sessionDate === today;
      } catch (error) {
        return false;
      }
    });
    
    // Create subject breakdown from today's sessions
    const validSubjects = subjects.filter(subject => subject && subject.id);
    const subjectBreakdown = validSubjects.map(subject => {
      const subjectSessions = todaySessions.filter(s => s && s.subjectId === subject.id);
      const minutes = subjectSessions.reduce((sum, s) => {
        const duration = typeof s.duration === 'number' ? s.duration : 0;
        return sum + Math.max(0, duration);
      }, 0);
      
      return { subjectId: subject.id, minutes };
    }).filter(s => s.minutes > 0);
    
    const result = {
      date: today,
      totalMinutes: currentProgress.totalMinutes,
      subjectBreakdown,
    };
    
    console.log('getTodayStats - Final result:', result);
    console.log('getTodayStats - Debug info:', {
      totalSessions: studySessions.length,
      todaySessions: todaySessions.length,
      validSubjects: validSubjects.length,
      subjectBreakdownCount: subjectBreakdown.length,
      todaySessionsDetails: todaySessions.map(s => ({ id: s.id, subjectId: s.subjectId, duration: s.duration, date: s.date, startTime: s.startTime }))
    });
    return result;
  }, [todayProgress, studySessions, subjects, currentUser?.id]);

  const getWeeklyStats = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dailyStats: DailyStats[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.getFullYear() + '-' + 
        String(date.getMonth() + 1).padStart(2, '0') + '-' + 
        String(date.getDate()).padStart(2, '0');
      
      // For today, use the simple progress tracking combined with session breakdown
      if (dateStr === today) {
        const todayStats = getTodayStats();
        dailyStats.push({
          date: dateStr,
          totalMinutes: todayProgress.totalMinutes, // Use simple progress tracking for total
          subjectBreakdown: todayStats.subjectBreakdown, // Use session-based breakdown for subjects
        });
      } else {
        // For other days, use session-based calculation
        const daySessions = studySessions.filter(s => {
          if (!s || !s.startTime) return false;
          
          let sessionDateStr = s.date;
          if (!sessionDateStr) {
            const sessionDate = new Date(s.startTime);
            sessionDateStr = sessionDate.getFullYear() + '-' + 
              String(sessionDate.getMonth() + 1).padStart(2, '0') + '-' + 
              String(sessionDate.getDate()).padStart(2, '0');
          }
          
          return sessionDateStr === dateStr;
        });
        
        const subjectBreakdown = subjects.map(subject => {
          const subjectSessions = daySessions.filter(s => s.subjectId === subject.id);
          const minutes = subjectSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
          return { subjectId: subject.id, minutes };
        }).filter(s => s.minutes > 0);

        const dayTotalMinutes = subjectBreakdown.reduce((sum, s) => sum + s.minutes, 0);
        
        dailyStats.push({
          date: dateStr,
          totalMinutes: dayTotalMinutes,
          subjectBreakdown,
        });
      }
    }

    console.log('getWeeklyStats - Weekly stats calculated:', dailyStats);
    return dailyStats;
  }, [studySessions, subjects, todayProgress.totalMinutes, getTodayStats]);

  const getSubjectPerformance = useCallback((subjectId: string) => {
    const subjectTests = testScores.map(test => {
      const subjectScore = test.subjectScores.find(s => s.subjectId === subjectId);
      return {
        date: test.date,
        testName: test.testName,
        testType: test.testType,
        percentage: subjectScore?.percentage || 0,
        correctAnswers: subjectScore?.correctAnswers || 0,
        totalQuestions: subjectScore?.totalQuestions || 0,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return subjectTests;
  }, [testScores]);

  const deleteTestScore = useCallback(async (testId: string) => {
    const updatedScores = testScores.filter(t => t.id !== testId);
    setTestScores(updatedScores);
    
    const updatedSubjects = subjects.map(subject => {
      const subjectTestScores = updatedScores
        .map(test => test.subjectScores.find(s => s.subjectId === subject.id))
        .filter(Boolean);
      
      if (subjectTestScores.length > 0) {
        const averageMarks = subjectTestScores.reduce((sum, score) => sum + (score?.percentage || 0), 0) / subjectTestScores.length;
        
        let marksProgress = 0;
        if (averageMarks >= 90) marksProgress = 100;
        else if (averageMarks >= 80) marksProgress = 90;
        else if (averageMarks >= 70) marksProgress = 80;
        else if (averageMarks >= 60) marksProgress = 70;
        else if (averageMarks >= 50) marksProgress = 60;
        else if (averageMarks >= 40) marksProgress = 50;
        else if (averageMarks >= 30) marksProgress = 40;
        else marksProgress = averageMarks;
        
        return {
          ...subject,
          averageMarks: Math.round(averageMarks * 10) / 10,
          marksProgress: Math.round(marksProgress),
        };
      }
      return {
        ...subject,
        averageMarks: undefined,
        marksProgress: undefined,
      };
    });
    
    setSubjects(updatedSubjects);
    
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.TEST_SCORES, JSON.stringify(updatedScores)),
      AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updatedSubjects)),
    ]);
  }, [testScores, subjects, currentUser?.id]);

  const updateExamDates = useCallback(async (dates: { NEET_PG: string; INICET: string }) => {
    setExamDates(dates);
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    const savePromises = [
      AsyncStorage.setItem(STORAGE_KEYS.EXAM_DATES, JSON.stringify(dates))
    ];
    
    if (currentUser?.id) {
      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_EXAM_DATES, JSON.stringify(dates)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString())
      );
    }
    
    await Promise.all(savePromises);
  }, [currentUser?.id]);

  const updateDailyTargetHours = useCallback(async (hours: number) => {
    if (hours <= 0 || hours > 24) {
      console.warn('Invalid target hours:', hours);
      return;
    }
    
    setDailyTargetHours(hours);
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    const savePromises = [
      AsyncStorage.setItem(STORAGE_KEYS.DAILY_TARGET_HOURS, JSON.stringify(hours))
    ];
    
    if (currentUser?.id) {
      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_DAILY_TARGET_HOURS, JSON.stringify(hours)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString())
      );
    }
    
    await Promise.all(savePromises);
  }, [currentUser?.id]);

  const clearAllData = useCallback(async () => {
    try {
      const STORAGE_KEYS = getStorageKeys(currentUser?.id);
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.STUDY_SESSIONS),
        AsyncStorage.removeItem(STORAGE_KEYS.TEST_SCORES),
        AsyncStorage.removeItem(STORAGE_KEYS.SUBJECTS),
        AsyncStorage.removeItem(STORAGE_KEYS.STUDY_PLANS),
        AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION),
        AsyncStorage.removeItem(STORAGE_KEYS.EXAM_DATES),
        AsyncStorage.removeItem(STORAGE_KEYS.TODAY_PROGRESS),
        AsyncStorage.removeItem(STORAGE_KEYS.DAILY_TARGET_HOURS),
      ]);
      
      setStudySessions([]);
      setTestScores([]);
      setStudyPlans([]);
      setActiveSession(null);
      setExamDates({ NEET_PG: '', INICET: '' });
      setSubjects([]);
      setTodayProgress({ 
        date: new Date().toISOString().split('T')[0], 
        totalMinutes: 0, 
        lastResetTime: new Date().toISOString() 
      });
      setDailyTargetHours(4);
      
      console.log('All data cleared and reset successfully');
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }, [currentUser?.id]);

  const deleteSession = useCallback(async (sessionId: string) => {
    const deletedSession = studySessions.find(s => s.id === sessionId);
    const updatedSessions = studySessions.filter(s => s.id !== sessionId);
    setStudySessions(updatedSessions);
    
    // Update today's progress if the deleted session was from today
    if (deletedSession) {
      const today = new Date().toISOString().split('T')[0];
      const sessionDate = deletedSession.date || new Date(deletedSession.startTime).toISOString().split('T')[0];
      
      if (sessionDate === today && todayProgress.date === today) {
        const updatedTodayProgress = {
          ...todayProgress,
          totalMinutes: Math.max(0, todayProgress.totalMinutes - deletedSession.duration)
        };
        setTodayProgress(updatedTodayProgress);
        
        const STORAGE_KEYS = getStorageKeys(currentUser?.id);
        AsyncStorage.setItem(STORAGE_KEYS.TODAY_PROGRESS, JSON.stringify(updatedTodayProgress)).catch(error => {
          console.error('Error updating today progress after session deletion:', error);
        });
      }
    }
    
    const updatedSubjects = subjects.map(subject => {
      const subjectSessions = updatedSessions.filter(s => s.subjectId === subject.id);
      const completedMinutes = subjectSessions.reduce((sum, s) => sum + s.duration, 0);
      return {
        ...subject,
        completedHours: completedMinutes / 60,
      };
    });
    setSubjects(updatedSubjects);
    
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    const savePromises = [
      AsyncStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(updatedSessions)),
      AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updatedSubjects)),
    ];
    
    if (currentUser?.id) {
      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_STUDY_SESSIONS, JSON.stringify(updatedSessions)),
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_SUBJECTS, JSON.stringify(updatedSubjects)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString())
      );
    }
    
    await Promise.all(savePromises);
  }, [studySessions, subjects, currentUser?.id, todayProgress]);

  const deleteSessions = useCallback(async (sessionIds: string[]) => {
    const deletedSessions = studySessions.filter(s => sessionIds.includes(s.id));
    const updatedSessions = studySessions.filter(s => !sessionIds.includes(s.id));
    setStudySessions(updatedSessions);
    
    // Calculate total minutes to subtract from today's progress
    const today = new Date().toISOString().split('T')[0];
    let todayMinutesToSubtract = 0;
    
    deletedSessions.forEach(session => {
      const sessionDate = session.date || new Date(session.startTime).toISOString().split('T')[0];
      if (sessionDate === today) {
        todayMinutesToSubtract += session.duration;
      }
    });
    
    // Update today's progress if any deleted sessions were from today
    if (todayMinutesToSubtract > 0 && todayProgress.date === today) {
      const updatedTodayProgress = {
        ...todayProgress,
        totalMinutes: Math.max(0, todayProgress.totalMinutes - todayMinutesToSubtract)
      };
      setTodayProgress(updatedTodayProgress);
      
      const STORAGE_KEYS = getStorageKeys(currentUser?.id);
      AsyncStorage.setItem(STORAGE_KEYS.TODAY_PROGRESS, JSON.stringify(updatedTodayProgress)).catch(error => {
        console.error('Error updating today progress after bulk session deletion:', error);
      });
    }
    
    const updatedSubjects = subjects.map(subject => {
      const subjectSessions = updatedSessions.filter(s => s.subjectId === subject.id);
      const completedMinutes = subjectSessions.reduce((sum, s) => sum + s.duration, 0);
      return {
        ...subject,
        completedHours: completedMinutes / 60,
      };
    });
    setSubjects(updatedSubjects);
    
    const STORAGE_KEYS = getStorageKeys(currentUser?.id);
    const savePromises = [
      AsyncStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(updatedSessions)),
      AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updatedSubjects)),
    ];
    
    if (currentUser?.id) {
      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_STUDY_SESSIONS, JSON.stringify(updatedSessions)),
        AsyncStorage.setItem(STORAGE_KEYS.CLOUD_SUBJECTS, JSON.stringify(updatedSubjects)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString())
      );
    }
    
    await Promise.all(savePromises);
  }, [studySessions, subjects, currentUser?.id, todayProgress]);

  const getOverallProgress = useCallback((subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) {
      console.log('getOverallProgress - Subject not found:', subjectId);
      return { hoursProgress: 0, marksProgress: 0, overallProgress: 0 };
    }
    
    // Calculate hours progress based on actual completed hours vs target hours
    const hoursProgress = Math.min(100, Math.round((subject.completedHours / subject.targetHours) * 100));
    const marksProgress = subject.marksProgress || 0;
    
    // Overall progress is weighted average: 40% hours, 60% marks
    const overallProgress = marksProgress > 0 
      ? Math.round(hoursProgress * 0.4 + marksProgress * 0.6)
      : hoursProgress;
    
    console.log(`getOverallProgress for ${subject.name}:`, {
      completedHours: subject.completedHours,
      targetHours: subject.targetHours,
      hoursProgress,
      marksProgress,
      overallProgress
    });
    
    return {
      hoursProgress,
      marksProgress,
      overallProgress,
    };
  }, [subjects]);

  const refreshData = useCallback(async () => {
    console.log('Refreshing data...');
    try {
      setIsLoading(true);
      await loadData();
      console.log('Data refresh completed');
    } catch (error) {
      console.error('Error refreshing data:', error);
      await loadData();
    } finally {
      setIsLoading(false);
    }
  }, [loadData]);

  const forceInitializeSubjects = useCallback(async () => {
    console.log('Force initializing subjects...');
    try {
      const { DEFAULT_SUBJECTS } = await import('@/constants/subjects');
      console.log('Setting default subjects:', DEFAULT_SUBJECTS.length);
      const STORAGE_KEYS = getStorageKeys(currentUser?.id);
      await AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(DEFAULT_SUBJECTS));
      console.log('Default subjects saved to storage');
      
      return true;
    } catch (error) {
      console.error('Error force initializing subjects:', error);
      return false;
    }
  }, [currentUser?.id]);

  const debugStoredData = useCallback(async () => {
    try {
      console.log('=== DEBUG STORED DATA ===');
      console.log('Current state:');
      console.log('- Subjects:', subjects.length, subjects.map(s => ({ id: s.id, name: s.name })));
      console.log('- Sessions:', studySessions.length);
      console.log('- Test Scores:', testScores.length);
      console.log('- Loading:', isLoading);
      console.log('- Current User:', currentUser?.id || 'guest');
      
      // Check AsyncStorage directly
      const keys = await AsyncStorage.getAllKeys();
      console.log('All AsyncStorage keys:', keys.filter(k => k.includes('study') || k.includes('subject') || k.includes('session')));
      
      const STORAGE_KEYS = getStorageKeys(currentUser?.id);
      
      // Try to load subjects directly
      const subjectsData = await AsyncStorage.getItem(STORAGE_KEYS.SUBJECTS);
      console.log('Raw subjects data:', subjectsData?.substring(0, 200));
      
      const sessionsData = await AsyncStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS);
      console.log('Raw sessions data length:', sessionsData?.length || 0);
      
      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('Debug error:', error);
    }
  }, [subjects, studySessions, testScores, isLoading, currentUser?.id]);

  // iCloud backup functions
  const createiCloudBackup = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      return await iCloudBackupService.createBackup(
        studySessions,
        testScores,
        subjects,
        studyPlans,
        examDates,
        todayProgress,
        dailyTargetHours,
        currentUser?.id,
        currentUser?.email
      );
    } catch (error) {
      console.error('Error creating iCloud backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup'
      };
    }
  }, [studySessions, testScores, subjects, studyPlans, examDates, todayProgress, dailyTargetHours, currentUser]);

  const getiCloudBackupStatus = useCallback(async () => {
    try {
      return await iCloudBackupService.getBackupInfo(currentUser?.id);
    } catch (error) {
      console.error('Error getting iCloud backup status:', error);
      return {
        isAvailable: false,
        status: 'Error checking backup status',
        backupCount: 0,
      };
    }
  }, [currentUser?.id]);

  const getiCloudBackupList = useCallback(async () => {
    try {
      return await iCloudBackupService.getBackupList(currentUser?.id);
    } catch (error) {
      console.error('Error getting iCloud backup list:', error);
      return [];
    }
  }, [currentUser?.id]);

  const restoreFromiCloudBackup = useCallback(async (backupTimestamp: string) => {
    try {
      const result = await iCloudBackupService.restoreFromBackup(backupTimestamp, currentUser?.id);
      
      if (result.success && result.data) {
        // Update all state with restored data
        setStudySessions(result.data.studySessions);
        setTestScores(result.data.testScores);
        setSubjects(result.data.subjects);
        setStudyPlans(result.data.studyPlans);
        setExamDates(result.data.examDates);
        setTodayProgress(result.data.todayProgress);
        setDailyTargetHours(result.data.dailyTargetHours);
        
        // Save restored data to AsyncStorage
        const STORAGE_KEYS = getStorageKeys(currentUser?.id);
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(result.data.studySessions)),
          AsyncStorage.setItem(STORAGE_KEYS.TEST_SCORES, JSON.stringify(result.data.testScores)),
          AsyncStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(result.data.subjects)),
          AsyncStorage.setItem(STORAGE_KEYS.STUDY_PLANS, JSON.stringify(result.data.studyPlans)),
          AsyncStorage.setItem(STORAGE_KEYS.EXAM_DATES, JSON.stringify(result.data.examDates)),
          AsyncStorage.setItem(STORAGE_KEYS.TODAY_PROGRESS, JSON.stringify(result.data.todayProgress)),
          AsyncStorage.setItem(STORAGE_KEYS.DAILY_TARGET_HOURS, JSON.stringify(result.data.dailyTargetHours)),
        ]);
        
        console.log('Data restored from iCloud backup successfully');
      }
      
      return result;
    } catch (error) {
      console.error('Error restoring from iCloud backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup'
      };
    }
  }, [currentUser?.id]);

  const deleteiCloudBackup = useCallback(async (backupTimestamp: string) => {
    try {
      return await iCloudBackupService.deleteBackup(backupTimestamp, currentUser?.id);
    } catch (error) {
      console.error('Error deleting iCloud backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup'
      };
    }
  }, [currentUser?.id]);

  // Set up daily reset timer and auto backup
  useEffect(() => {
    const checkDailyReset = () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const today3AM = new Date(now);
      today3AM.setHours(3, 0, 0, 0);
      
      // Check if we need to reset at 3:00 AM
      if (todayProgress.date !== today || (now >= today3AM && new Date(todayProgress.lastResetTime) < today3AM)) {
        console.log('Daily reset triggered at 3:00 AM');
        const resetProgress = {
          date: today,
          totalMinutes: 0,
          lastResetTime: now.toISOString()
        };
        setTodayProgress(resetProgress);
        
        const STORAGE_KEYS = getStorageKeys(currentUser?.id);
        AsyncStorage.setItem(STORAGE_KEYS.TODAY_PROGRESS, JSON.stringify(resetProgress)).catch(error => {
          console.error('Error saving daily reset:', error);
        });
      }
    };

    // Check immediately
    checkDailyReset();
    
    // Set up interval to check every minute
    const interval = setInterval(checkDailyReset, 60000);
    
    return () => clearInterval(interval);
  }, [todayProgress, currentUser?.id]);

  // Auto backup effect - runs when significant data changes
  useEffect(() => {
    if (!isLoading && currentUser !== undefined && studySessions.length > 0) {
      // Debounce auto backup to avoid too frequent calls
      const timeoutId = setTimeout(() => {
        iCloudBackupService.autoBackup(
          studySessions,
          testScores,
          subjects,
          studyPlans,
          examDates,
          todayProgress,
          dailyTargetHours,
          currentUser?.id,
          currentUser?.email
        ).catch(error => {
          console.error('Auto backup failed:', error);
        });
      }, 5000); // Wait 5 seconds after data change
      
      return () => clearTimeout(timeoutId);
    }
  }, [studySessions.length, testScores.length, subjects.length, studyPlans.length, examDates, todayProgress.totalMinutes, dailyTargetHours, currentUser, isLoading]);

  return {
    studySessions,
    sessions: studySessions,
    testScores,
    subjects,
    studyPlans,
    activeSession,
    examDates,
    isLoading,
    currentUser,
    todayProgress,
    dailyTargetHours,
    startStudySession,
    pauseStudySession,
    resumeStudySession,
    endStudySession,
    addTestScore,
    updateStudyPlan,
    updateExamDates,
    getTodayStats,
    getWeeklyStats,
    getSubjectPerformance,
    getOverallProgress,
    deleteTestScore,
    deleteSession,
    deleteSessions,
    clearAllData,
    refreshData,
    updateDailyTargetHours,
    debugStoredData,
    // iCloud backup functions
    createiCloudBackup,
    getiCloudBackupStatus,
    getiCloudBackupList,
    restoreFromiCloudBackup,
    deleteiCloudBackup,
    forceInitializeSubjects,
  };
});
  // Add methods needed by the dashboard
  const getTodayStats = () => {
    const today = new Date().toDateString();
    const todaySessions = studySessions.filter(session => 
      new Date(session.startTime).toDateString() === today
    );
    
    const subjectBreakdown = subjects.map(subject => {
      const subjectMinutes = todaySessions
        .filter(session => session.subjectId === subject.id)
        .reduce((total, session) => total + (session.duration || 0), 0);
      return { subjectId: subject.id, minutes: subjectMinutes };
    }).filter(item => item.minutes > 0);

    return {
      totalMinutes: todaySessions.reduce((total, session) => total + (session.duration || 0), 0),
      subjectBreakdown,
      date: today
    };
  };

  const getWeeklyStats = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const daySessions = studySessions.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate.toDateString() === date.toDateString();
      });
      
      const subjectBreakdown = subjects.map(subject => {
        const subjectMinutes = daySessions
          .filter(session => session.subjectId === subject.id)
          .reduce((total, session) => total + (session.duration || 0), 0);
        return { subjectId: subject.id, minutes: subjectMinutes };
      }).filter(item => item.minutes > 0);

      last7Days.push({
        date: date.toISOString(),
        totalMinutes: daySessions.reduce((total, session) => total + (session.duration || 0), 0),
        subjectBreakdown
      });
    }
    return last7Days;
  };

  // Update the context value to include these methods
  const value = {
    // ... existing properties ...
    getTodayStats,
    getWeeklyStats,
    // ... rest of properties ...
  };
