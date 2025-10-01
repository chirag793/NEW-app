import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface BackgroundTimerState {
  isRunning: boolean;
  startTime: number;
  pausedTime: number;
  totalTime: number;
  sessionType: 'work' | 'shortBreak' | 'longBreak';
  mode: 'pomodoro' | 'countup';
  subjectId: string;
  completedSessions: number;
  totalSessions: number;
  distractionCount: number;
}

const BACKGROUND_TIMER_KEY = 'background_timer_state';

export class BackgroundTimer {
  private static instance: BackgroundTimer;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private state: BackgroundTimerState | null = null;

  static getInstance(): BackgroundTimer {
    if (!BackgroundTimer.instance) {
      BackgroundTimer.instance = new BackgroundTimer();
    }
    return BackgroundTimer.instance;
  }

  async saveState(state: BackgroundTimerState): Promise<void> {
    try {
      // Validate state before saving
      if (!state || typeof state !== 'object') {
        console.error('Background timer: Invalid state to save:', state);
        return;
      }
      
      const stateToSave = {
        ...state,
        lastSaveTime: Date.now()
      };
      
      // Ensure we can stringify the state
      const stateStr = JSON.stringify(stateToSave);
      if (!stateStr || stateStr === 'undefined' || stateStr === 'null') {
        console.error('Background timer: Failed to stringify state');
        return;
      }
      
      this.state = state;
      await AsyncStorage.setItem(BACKGROUND_TIMER_KEY, stateStr);
      console.log('Background timer state saved successfully');
    } catch (error) {
      console.error('Error saving background timer state:', error);
      // If save fails, clear the corrupted state
      await this.clearState();
    }
  }

  async loadState(): Promise<BackgroundTimerState | null> {
    try {
      const stateStr = await AsyncStorage.getItem(BACKGROUND_TIMER_KEY);
      if (!stateStr || stateStr === 'undefined' || stateStr === 'null') {
        console.log('Background timer: No state found');
        return null;
      }
      
      // Enhanced validation for corrupted data
      const trimmed = stateStr.trim();
      if (trimmed === '' || 
          trimmed === 'object' || 
          trimmed.includes('[object Object]') ||
          trimmed.startsWith('[object') ||
          trimmed.startsWith('o') || // Fix for "Unexpected character: o" error
          /^[a-zA-Z]+$/.test(trimmed) ||
          !trimmed.startsWith('{')) {
        console.warn('Background timer: Corrupted data detected:', trimmed.substring(0, 50));
        await this.clearState();
        return null;
      }
      
      // Additional JSON validation
      let savedState;
      try {
        savedState = JSON.parse(trimmed);
      } catch (parseError) {
        console.error('Background timer: JSON parse error:', parseError);
        console.error('Background timer: Corrupted data:', trimmed.substring(0, 100));
        await this.clearState();
        return null;
      }
      
      // Validate the parsed object structure
      if (!savedState || typeof savedState !== 'object' || 
          typeof savedState.isRunning !== 'boolean' ||
          typeof savedState.startTime !== 'number' ||
          typeof savedState.mode !== 'string') {
        console.warn('Background timer: Invalid state structure:', savedState);
        await this.clearState();
        return null;
      }
      
      this.state = savedState;
      console.log('Background timer state loaded successfully');
      return savedState;
    } catch (error) {
      console.error('Error loading background timer state:', error);
      // Clear corrupted state
      await this.clearState();
      return null;
    }
  }

  async clearState(): Promise<void> {
    try {
      this.state = null;
      await AsyncStorage.removeItem(BACKGROUND_TIMER_KEY);
      console.log('Background timer state cleared');
    } catch (error) {
      console.error('Error clearing background timer state:', error);
    }
  }

  async startBackgroundTimer(state: BackgroundTimerState): Promise<void> {
    console.log('Starting background timer with state:', state);
    await this.saveState(state);
    
    if (Platform.OS === 'web') {
      // For web, use a regular interval that continues even when tab is not active
      this.startWebBackgroundTimer();
    } else {
      // For mobile, the timer state is saved and will be calculated when app returns
      console.log('Mobile background timer started - state saved for calculation on return');
    }
  }

  private startWebBackgroundTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      if (!this.state) return;

      try {
        const now = Date.now();
        const elapsed = Math.floor((now - this.state.startTime - this.state.pausedTime) / 1000);
        
        if (this.state.mode === 'pomodoro') {
          const remaining = Math.max(0, this.state.totalTime - elapsed);
          
          // Update state with current progress
          const updatedState = {
            ...this.state,
            lastSaveTime: now
          };
          await AsyncStorage.setItem(BACKGROUND_TIMER_KEY, JSON.stringify(updatedState));
          
          // Check if timer completed
          if (remaining === 0 && elapsed >= this.state.totalTime) {
            console.log('Background timer completed on web');
            await this.handleTimerCompletion();
          }
        }
      } catch (error) {
        console.error('Error in web background timer:', error);
      }
    }, 1000);
  }

  private async handleTimerCompletion(): Promise<void> {
    console.log('Handling background timer completion');
    
    // Stop the background timer
    await this.stopBackgroundTimer();
    
    // The actual completion handling will be done when the app becomes active
    // We just mark that completion occurred
    if (this.state) {
      const completionState = {
        ...this.state,
        completed: true,
        completionTime: Date.now()
      };
      await AsyncStorage.setItem(BACKGROUND_TIMER_KEY, JSON.stringify(completionState));
    }
  }

  async stopBackgroundTimer(): Promise<void> {
    console.log('Stopping background timer');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    await this.clearState();
  }

  async pauseBackgroundTimer(): Promise<void> {
    if (!this.state) return;
    
    const now = Date.now();
    const currentPausedTime = this.state.pausedTime + (now - this.state.startTime);
    
    const pausedState = {
      ...this.state,
      pausedTime: currentPausedTime,
      isRunning: false,
      lastPauseTime: now
    };
    
    await this.saveState(pausedState);
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('Background timer paused');
  }

  async resumeBackgroundTimer(): Promise<void> {
    if (!this.state) return;
    
    const now = Date.now();
    const resumedState = {
      ...this.state,
      isRunning: true,
      startTime: now - (this.state.pausedTime || 0)
    };
    
    await this.saveState(resumedState);
    
    if (Platform.OS === 'web') {
      this.startWebBackgroundTimer();
    }
    
    console.log('Background timer resumed');
  }

  async getTimerProgress(): Promise<{
    timeRemaining: number;
    elapsedTime: number;
    isCompleted: boolean;
    state: BackgroundTimerState | null;
  } | null> {
    const state = await this.loadState();
    if (!state) return null;

    const now = Date.now();
    const totalElapsed = Math.floor((now - state.startTime - (state.pausedTime || 0)) / 1000);
    
    if (state.mode === 'pomodoro') {
      const timeRemaining = Math.max(0, state.totalTime - totalElapsed);
      const isCompleted = timeRemaining === 0;
      
      return {
        timeRemaining,
        elapsedTime: totalElapsed,
        isCompleted,
        state
      };
    } else {
      return {
        timeRemaining: 0,
        elapsedTime: totalElapsed,
        isCompleted: false,
        state
      };
    }
  }

  isActive(): boolean {
    return this.state?.isRunning || false;
  }
}

export const backgroundTimer = BackgroundTimer.getInstance();

// Utility function to clear corrupted AsyncStorage data on app startup
export const clearCorruptedTimerData = async (): Promise<void> => {
  try {
    console.log('Checking for corrupted timer data...');
    const stateStr = await AsyncStorage.getItem(BACKGROUND_TIMER_KEY);
    
    if (stateStr) {
      const trimmed = stateStr.trim();
      
      // Check for common corruption patterns
      if (trimmed === '' || 
          trimmed === 'object' || 
          trimmed.includes('[object Object]') ||
          trimmed.startsWith('[object') ||
          trimmed.startsWith('o') ||
          /^[a-zA-Z]+$/.test(trimmed) ||
          !trimmed.startsWith('{')) {
        console.warn('Found corrupted timer data, clearing...');
        await AsyncStorage.removeItem(BACKGROUND_TIMER_KEY);
        console.log('Corrupted timer data cleared successfully');
        return;
      }
      
      // Try to parse and validate
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || 
            typeof parsed.isRunning !== 'boolean' ||
            typeof parsed.mode !== 'string') {
          console.warn('Found invalid timer data structure, clearing...');
          await AsyncStorage.removeItem(BACKGROUND_TIMER_KEY);
          console.log('Invalid timer data cleared successfully');
        } else {
          console.log('Timer data is valid');
        }
      } catch {
        console.warn('Found unparseable timer data, clearing...');
        await AsyncStorage.removeItem(BACKGROUND_TIMER_KEY);
        console.log('Unparseable timer data cleared successfully');
      }
    } else {
      console.log('No timer data found');
    }
  } catch (error) {
    console.error('Error checking timer data:', error);
    // If there's any error, just clear the data to be safe
    try {
      await AsyncStorage.removeItem(BACKGROUND_TIMER_KEY);
      console.log('Timer data cleared due to error');
    } catch (clearError) {
      console.error('Error clearing timer data:', clearError);
    }
  }
};

// Also clear other potential corrupted keys
export const clearAllCorruptedData = async (): Promise<void> => {
  try {
    console.log('Checking for all corrupted AsyncStorage data...');
    const keys = await AsyncStorage.getAllKeys();
    
    for (const key of keys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const trimmed = value.trim();
          
          // Check for corruption patterns
          if (trimmed === 'object' || 
              trimmed.includes('[object Object]') ||
              trimmed.startsWith('[object') ||
              (trimmed.startsWith('o') && trimmed.length < 10) ||
              (/^[a-zA-Z]+$/.test(trimmed) && !['true', 'false'].includes(trimmed))) {
            console.warn(`Found corrupted data for key ${key}, clearing...`);
            await AsyncStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.error(`Error checking key ${key}:`, error);
        // If there's an error with this key, remove it
        try {
          await AsyncStorage.removeItem(key);
        } catch (removeError) {
          console.error(`Error removing corrupted key ${key}:`, removeError);
        }
      }
    }
    
    console.log('Corrupted data cleanup completed');
  } catch (error) {
    console.error('Error during corrupted data cleanup:', error);
  }
};