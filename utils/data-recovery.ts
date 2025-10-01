import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { StudySession, TestScore, Subject, StudyPlan } from '@/types/study';

interface RecoveryResult {
  success: boolean;
  recoveredData: {
    sessions: StudySession[];
    scores: TestScore[];
    subjects: Subject[];
    plans: StudyPlan[];
    examDates: { NEET_PG: string; INICET: string };
  };
  errors: string[];
}

export class DataRecoveryService {
  // Immediate corruption cleanup - runs synchronously on app start
  static async immediateCorruptionCleanup(): Promise<void> {
    try {
      console.log('Running immediate corruption cleanup...');
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove: string[] = [];
      
      for (const key of allKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data && (
            // Most common corruption patterns that cause "Unexpected character: o"
            data === 'o' ||
            data === 'ob' ||
            data === 'obj' ||
            data === 'obje' ||
            data === 'objec' ||
            data === 'object' ||
            data === '[object Object]' ||
            data.includes('object Object') ||
            // Try to parse and catch JSON errors
            (() => {
              try {
                JSON.parse(data);
                return false;
              } catch (parseError) {
                const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
                return errorMsg.includes('Unexpected character') || errorMsg.includes('Unexpected token');
              }
            })()
          )) {
            console.warn(`Immediate cleanup: removing corrupted key "${key}" with data: "${data.substring(0, 20)}..."`);
            keysToRemove.push(key);
          }
        } catch (error) {
          console.warn(`Immediate cleanup: error checking key "${key}", removing it:`, error);
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Immediate cleanup: removed ${keysToRemove.length} corrupted keys`);
      } else {
        console.log('Immediate cleanup: no corrupted keys found');
      }
    } catch (error) {
      console.error('Immediate cleanup failed:', error);
    }
  }

  // Emergency cleanup for the specific "o" character corruption
  static async emergencyCleanupCorruption(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = [];
    let cleaned = 0;
    
    try {
      console.log('Starting emergency cleanup for "o" character corruption...');
      
      const allKeys = await AsyncStorage.getAllKeys();
      const corruptedKeys: string[] = [];
      
      for (const key of allKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data && (
            // Exact matches for corrupted data
            data === 'o' ||
            data === 'ob' ||
            data === 'obj' ||
            data === 'obje' ||
            data === 'objec' ||
            data === 'object' ||
            data === '[object Object]' ||
            data === 'object Object' ||
            data.includes('object Object') ||
            data.includes('[object Object]') ||
            // Whitespace variations
            /^\s*o\s*$/.test(data) ||
            /^\s*ob\s*$/.test(data) ||
            /^\s*obj\s*$/.test(data) ||
            /^\s*obje\s*$/.test(data) ||
            /^\s*objec\s*$/.test(data) ||
            /^\s*object\s*$/.test(data) ||
            // Additional corruption patterns that cause JSON parse errors
            (data.length < 20 && /^[a-zA-Z]+$/.test(data.trim()) && !['true', 'false', 'null'].includes(data.trim().toLowerCase())) ||
            // Single character corruptions
            /^\s*[a-zA-Z]\s*$/.test(data) ||
            // Short corrupted strings that aren't valid JSON
            (data.length <= 10 && /^[a-zA-Z]{1,10}$/.test(data.trim()) && !data.startsWith('{') && !data.startsWith('[')) ||
            // Additional patterns that cause "Unexpected character" errors
            /^\s*[a-zA-Z]/.test(data) && !data.startsWith('{') && !data.startsWith('[') && !data.startsWith('"') && data.length < 50
          )) {
            console.warn(`Found corrupted data in key "${key}": "${data}"`);
            corruptedKeys.push(key);
          }
          
          // Additional check: try to parse the data to catch JSON syntax errors
          if (data && data.trim() !== '' && data !== 'null' && data !== 'undefined') {
            try {
              JSON.parse(data);
            } catch (parseError) {
              const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
              if (errorMessage.includes('Unexpected character') || 
                  errorMessage.includes('Unexpected token') ||
                  errorMessage.includes('JSON')) {
                console.warn(`Found unparseable data in key "${key}": "${data.substring(0, 50)}..." Error: ${errorMessage}`);
                corruptedKeys.push(key);
              }
            }
          }
        } catch (error) {
          console.warn(`Error checking key "${key}":`, error);
          errors.push(`Error checking key "${key}": ${error}`);
          // If we can't even check the key, it's probably corrupted
          corruptedKeys.push(key);
        }
      }
      
      // Remove duplicates
      const uniqueCorruptedKeys = [...new Set(corruptedKeys)];
      
      if (uniqueCorruptedKeys.length > 0) {
        console.log(`Removing ${uniqueCorruptedKeys.length} corrupted keys:`, uniqueCorruptedKeys);
        await AsyncStorage.multiRemove(uniqueCorruptedKeys);
        cleaned = uniqueCorruptedKeys.length;
        console.log('Emergency cleanup completed successfully');
      } else {
        console.log('No corrupted keys found during emergency cleanup');
      }
      
    } catch (error) {
      const errorMsg = `Emergency cleanup failed: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
    
    return { cleaned, errors };
  }

  private static async getAllStorageKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys]; // Convert readonly array to mutable array
    } catch (error) {
      console.error('Error getting storage keys:', error);
      return [];
    }
  }

  private static safeJsonParse(data: string | null, fallback: any = null): any {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    
    try {
      // Handle already parsed objects
      if (typeof data === 'object' && data !== null) {
        return data;
      }
      
      const dataStr = typeof data === 'string' ? data : String(data);
      let trimmed = dataStr.trim();
      
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
        console.warn('Data recovery: Detected corrupted data pattern, returning fallback:', trimmed.substring(0, 50));
        return fallback;
      }
      
      // Try to fix common corruption patterns
      if (trimmed.includes('[object Object]')) {
        console.warn('Fixing [object Object] corruption');
        trimmed = trimmed.replace(/\[object Object\]/g, '{}');
      }
      
      // Try to extract JSON from corrupted strings
      const jsonMatch = trimmed.match(/({.*}|\[.*\])/s);
      if (jsonMatch) {
        trimmed = jsonMatch[0];
      }
      
      // Validate JSON structure
      const startsWithValidJson = trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"');
      const isValidPrimitive = ['true', 'false', 'null'].includes(trimmed.toLowerCase()) || /^-?\d*\.?\d+$/.test(trimmed);
      
      if (!startsWithValidJson && !isValidPrimitive) {
        console.warn('Data recovery: Data does not look like valid JSON, returning fallback:', trimmed.substring(0, 50));
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
          console.warn('Data recovery: JSON parse error:', errorMessage, 'Data preview:', trimmed.substring(0, 100));
          
          // Return fallback for any JSON syntax errors - be more aggressive
          console.warn('Data recovery: Returning fallback due to JSON parse error');
          return fallback;
        }
        console.warn('Data recovery: Unknown parse error, returning fallback');
        return fallback;
      }
      
      return parsed;
    } catch (error) {
      console.warn('Data recovery: Critical parse error:', error, 'Data preview:', data?.toString().substring(0, 50));
      return fallback;
    }
  }

  static async recoverAllData(userId?: string): Promise<RecoveryResult> {
    const errors: string[] = [];
    const recoveredData = {
      sessions: [] as StudySession[],
      scores: [] as TestScore[],
      subjects: [] as Subject[],
      plans: [] as StudyPlan[],
      examDates: { NEET_PG: '', INICET: '' },
    };

    try {
      const allKeys = await this.getAllStorageKeys();
      console.log('Data Recovery: Found storage keys:', allKeys.length);
      console.log('Data Recovery: Recovering for userId:', userId || 'guest');
      console.log('Data Recovery: Platform:', Platform.OS);
      
      // First try to recover from iCloud on iOS
      if (Platform.OS === 'ios') {
        console.log('Data Recovery: Attempting iCloud recovery first...');
        const iCloudRecovered = await this.recoverFromiCloud(userId);
        if (iCloudRecovered.success) {
          console.log('Data Recovery: Successfully recovered from iCloud');
          return iCloudRecovered;
        } else {
          console.log('Data Recovery: iCloud recovery failed, trying AsyncStorage');
          errors.push(...iCloudRecovered.errors);
        }
      }
      
      if (allKeys.length === 0) {
        console.log('Data Recovery: No storage keys found');
        return {
          success: false,
          recoveredData,
          errors: ['No data found in local storage or iCloud']
        };
      }

      // Try to recover from all possible key patterns - including legacy keys
      const patterns = {
        sessions: [
          'study_sessions', 
          'guest_study_sessions', 
          `user_${userId}_study_sessions`, 
          `cloud_user_${userId}_study_sessions`,
          'STUDY_SESSIONS', // Legacy uppercase
          '@study_sessions', // Legacy with @
          'studySessions', // Legacy camelCase
          // Additional patterns for better recovery
          'sessions',
          'user_sessions',
          'cloud_sessions',
        ],
        scores: [
          'test_scores', 
          'guest_test_scores', 
          `user_${userId}_test_scores`, 
          `cloud_user_${userId}_test_scores`,
          'TEST_SCORES', // Legacy uppercase
          '@test_scores', // Legacy with @
          'testScores', // Legacy camelCase
          // Additional patterns
          'scores',
          'user_scores',
          'cloud_scores',
        ],
        subjects: [
          'subjects', 
          'guest_subjects', 
          `user_${userId}_subjects`, 
          `cloud_user_${userId}_subjects`,
          'SUBJECTS', // Legacy uppercase
          '@subjects', // Legacy with @
          // Additional patterns
          'user_subjects',
          'cloud_subjects',
        ],
        plans: [
          'study_plans', 
          'guest_study_plans', 
          `user_${userId}_study_plans`, 
          `cloud_user_${userId}_study_plans`,
          'STUDY_PLANS', // Legacy uppercase
          '@study_plans', // Legacy with @
          'studyPlans', // Legacy camelCase
          // Additional patterns
          'plans',
          'user_plans',
          'cloud_plans',
        ],
        examDates: [
          'exam_dates', 
          'guest_exam_dates', 
          `user_${userId}_exam_dates`, 
          `cloud_user_${userId}_exam_dates`,
          'EXAM_DATES', // Legacy uppercase
          '@exam_dates', // Legacy with @
          'examDates', // Legacy camelCase
          // Additional patterns
          'dates',
          'user_dates',
          'cloud_dates',
        ],
      };
      
      // Also check for any keys that contain relevant data patterns
      const additionalPatterns = allKeys.filter(key => {
        const lowerKey = key.toLowerCase();
        return (
          (lowerKey.includes('session') && !lowerKey.includes('active')) ||
          lowerKey.includes('score') ||
          lowerKey.includes('subject') ||
          lowerKey.includes('plan') ||
          lowerKey.includes('exam')
        );
      });
      
      console.log('Additional patterns found:', additionalPatterns);

      // Recover sessions - check all patterns and additional keys
      const allSessionKeys = [...patterns.sessions, ...additionalPatterns.filter(k => k.toLowerCase().includes('session'))];
      for (const key of allSessionKeys) {
        if (allKeys.includes(key)) {
          try {
            const data = await AsyncStorage.getItem(key);
            const parsed = this.safeJsonParse(data, []);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validSessions = parsed.filter((s: any) => 
                s && s.id && s.subjectId && s.startTime && typeof s.duration === 'number'
              );
              if (validSessions.length > 0) {
                recoveredData.sessions.push(...validSessions);
                console.log(`Recovered ${validSessions.length} sessions from ${key}`);
              }
            }
          } catch (error) {
            errors.push(`Failed to recover sessions from ${key}: ${error}`);
          }
        }
      }

      // Recover scores - check all patterns and additional keys
      const allScoreKeys = [...patterns.scores, ...additionalPatterns.filter(k => k.toLowerCase().includes('score'))];
      for (const key of allScoreKeys) {
        if (allKeys.includes(key)) {
          try {
            const data = await AsyncStorage.getItem(key);
            const parsed = this.safeJsonParse(data, []);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validScores = parsed.filter((s: any) => s && s.id && s.testName);
              if (validScores.length > 0) {
                recoveredData.scores.push(...validScores);
                console.log(`Recovered ${validScores.length} scores from ${key}`);
              }
            }
          } catch (error) {
            errors.push(`Failed to recover scores from ${key}: ${error}`);
          }
        }
      }

      // Recover subjects - check all patterns and additional keys
      const allSubjectKeys = [...patterns.subjects, ...additionalPatterns.filter(k => k.toLowerCase().includes('subject'))];
      for (const key of allSubjectKeys) {
        if (allKeys.includes(key)) {
          try {
            const data = await AsyncStorage.getItem(key);
            const parsed = this.safeJsonParse(data, []);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Validate subjects have required fields
              const validSubjects = parsed.filter((s: any) => s && s.id && s.name);
              if (validSubjects.length > 0 && recoveredData.subjects.length === 0) {
                recoveredData.subjects = validSubjects;
                console.log(`Recovered ${validSubjects.length} subjects from ${key}`);
                break; // Use first valid subjects found
              }
            }
          } catch (error) {
            errors.push(`Failed to recover subjects from ${key}: ${error}`);
          }
        }
      }

      // Recover plans - check all patterns and additional keys
      const allPlanKeys = [...patterns.plans, ...additionalPatterns.filter(k => k.toLowerCase().includes('plan'))];
      for (const key of allPlanKeys) {
        if (allKeys.includes(key)) {
          try {
            const data = await AsyncStorage.getItem(key);
            const parsed = this.safeJsonParse(data, []);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validPlans = parsed.filter((p: any) => p && p.subjectId);
              if (validPlans.length > 0) {
                recoveredData.plans.push(...validPlans);
                console.log(`Recovered ${validPlans.length} plans from ${key}`);
              }
            }
          } catch (error) {
            errors.push(`Failed to recover plans from ${key}: ${error}`);
          }
        }
      }

      // Recover exam dates - check all patterns and additional keys
      const allExamKeys = [...patterns.examDates, ...additionalPatterns.filter(k => k.toLowerCase().includes('exam'))];
      for (const key of allExamKeys) {
        if (allKeys.includes(key)) {
          try {
            const data = await AsyncStorage.getItem(key);
            const parsed = this.safeJsonParse(data, null);
            if (parsed && typeof parsed === 'object') {
              // Ensure we have valid exam dates
              const validDates = {
                NEET_PG: parsed.NEET_PG || parsed.neet_pg || parsed.NEET || '',
                INICET: parsed.INICET || parsed.inicet || ''
              };
              
              // Only use if at least one date is valid
              if (validDates.NEET_PG || validDates.INICET) {
                recoveredData.examDates = validDates;
                console.log(`Recovered exam dates from ${key}:`, validDates);
                break;
              }
            }
          } catch (error) {
            errors.push(`Failed to recover exam dates from ${key}: ${error}`);
          }
        }
      }

      // Deduplicate recovered data
      recoveredData.sessions = this.deduplicateById(recoveredData.sessions);
      recoveredData.scores = this.deduplicateById(recoveredData.scores);
      recoveredData.plans = this.deduplicateBySubjectId(recoveredData.plans);

      // Recalculate subject hours if we have sessions
      if (recoveredData.subjects.length > 0 && recoveredData.sessions.length > 0) {
        recoveredData.subjects = recoveredData.subjects.map(subject => {
          const subjectSessions = recoveredData.sessions.filter(s => s.subjectId === subject.id);
          const completedMinutes = subjectSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
          return {
            ...subject,
            completedHours: completedMinutes / 60,
          };
        });
      }

      const totalRecovered = recoveredData.sessions.length + recoveredData.scores.length + 
                            recoveredData.subjects.length + recoveredData.plans.length;
      
      console.log('Data Recovery: Recovery complete:', {
        sessions: recoveredData.sessions.length,
        scores: recoveredData.scores.length,
        subjects: recoveredData.subjects.length,
        plans: recoveredData.plans.length,
        examDates: recoveredData.examDates.NEET_PG || recoveredData.examDates.INICET ? 'Found' : 'None',
        errors: errors.length,
        totalRecovered
      });
      
      if (totalRecovered === 0 && errors.length === 0) {
        errors.push('No recoverable data found in local storage');
      }

      return {
        success: totalRecovered > 0 || Boolean(recoveredData.examDates.NEET_PG || recoveredData.examDates.INICET),
        recoveredData,
        errors,
      };
    } catch (error) {
      console.error('Data Recovery: Critical error during recovery:', error);
      errors.push(`Critical recovery error: ${error}`);
      return {
        success: false,
        recoveredData,
        errors,
      };
    }
  }

  private static deduplicateById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }

  private static deduplicateBySubjectId<T extends { subjectId: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.subjectId)) {
        return false;
      }
      seen.add(item.subjectId);
      return true;
    });
  }

  static async saveRecoveredData(
    recoveredData: RecoveryResult['recoveredData'],
    userId?: string
  ): Promise<void> {
    const prefix = userId ? `user_${userId}_` : 'guest_';
    const keys = {
      STUDY_SESSIONS: `${prefix}study_sessions`,
      TEST_SCORES: `${prefix}test_scores`,
      SUBJECTS: `${prefix}subjects`,
      STUDY_PLANS: `${prefix}study_plans`,
      EXAM_DATES: `${prefix}exam_dates`,
    };

    const savePromises = [];

    if (recoveredData.sessions.length > 0) {
      savePromises.push(
        AsyncStorage.setItem(keys.STUDY_SESSIONS, JSON.stringify(recoveredData.sessions))
      );
    }

    if (recoveredData.scores.length > 0) {
      savePromises.push(
        AsyncStorage.setItem(keys.TEST_SCORES, JSON.stringify(recoveredData.scores))
      );
    }

    if (recoveredData.subjects.length > 0) {
      savePromises.push(
        AsyncStorage.setItem(keys.SUBJECTS, JSON.stringify(recoveredData.subjects))
      );
    }

    if (recoveredData.plans.length > 0) {
      savePromises.push(
        AsyncStorage.setItem(keys.STUDY_PLANS, JSON.stringify(recoveredData.plans))
      );
    }

    // Always save exam dates, even if empty, to ensure proper initialization
    savePromises.push(
      AsyncStorage.setItem(keys.EXAM_DATES, JSON.stringify(recoveredData.examDates))
    );

    await Promise.all(savePromises);
    console.log('Recovered data saved successfully');
  }

  // New method to recover from iCloud
  private static async recoverFromiCloud(userId?: string): Promise<RecoveryResult> {
    const errors: string[] = [];
    const recoveredData = {
      sessions: [] as StudySession[],
      scores: [] as TestScore[],
      subjects: [] as Subject[],
      plans: [] as StudyPlan[],
      examDates: { NEET_PG: '', INICET: '' },
    };

    try {
      if (Platform.OS !== 'ios') {
        return {
          success: false,
          recoveredData,
          errors: ['iCloud recovery only available on iOS']
        };
      }

      console.log('Data Recovery: Checking iCloud for user:', userId || 'guest');
      
      // Try multiple key patterns for better recovery
      const keyPatterns = [
        userId ? `${userId}_sessions` : 'guest_sessions',
        userId ? `${userId}_scores` : 'guest_scores',
        userId ? `${userId}_subjects` : 'guest_subjects',
        userId ? `${userId}_plans` : 'guest_plans',
        userId ? `${userId}_dates` : 'guest_dates',
      ];
      
      // Also try legacy patterns
      const legacyPatterns = [
        'sessions', 'scores', 'subjects', 'plans', 'dates',
        'study_sessions', 'test_scores', 'study_plans', 'exam_dates'
      ];
      
      // Try to restore all data types from iCloud with multiple patterns
      const tryRestoreWithPatterns = async (patterns: string[]) => {
        for (const pattern of patterns) {
          try {
            const data = await SecureStore.getItemAsync(`icloud_${pattern}`, {
              keychainService: 'StudyTrackerBackup',
              requireAuthentication: false,
            });
            if (data) {
              const parsed = this.safeJsonParse(data, null);
              if (parsed) {
                console.log(`Data Recovery: Found iCloud data for pattern: ${pattern}`);
                return parsed;
              }
            }
          } catch (error) {
            console.log(`Data Recovery: No iCloud data for pattern: ${pattern}`);
          }
        }
        return null;
      };
      
      // Try to recover each data type
      const [iCloudSessions, iCloudScores, iCloudSubjects, iCloudPlans, iCloudDates] = await Promise.all([
        tryRestoreWithPatterns([keyPatterns[0], legacyPatterns[0], legacyPatterns[5]]),
        tryRestoreWithPatterns([keyPatterns[1], legacyPatterns[1], legacyPatterns[6]]),
        tryRestoreWithPatterns([keyPatterns[2], legacyPatterns[2]]),
        tryRestoreWithPatterns([keyPatterns[3], legacyPatterns[3], legacyPatterns[7]]),
        tryRestoreWithPatterns([keyPatterns[4], legacyPatterns[4], legacyPatterns[8]]),
      ]);
      
      // Process recovered sessions
      if (iCloudSessions && Array.isArray(iCloudSessions)) {
        const validSessions = iCloudSessions.filter((s: any) => 
          s && s.id && s.subjectId && s.startTime && typeof s.duration === 'number'
        );
        if (validSessions.length > 0) {
          recoveredData.sessions = validSessions;
          console.log(`Data Recovery: Recovered ${validSessions.length} sessions from iCloud`);
        }
      }
      
      // Process recovered scores
      if (iCloudScores && Array.isArray(iCloudScores)) {
        const validScores = iCloudScores.filter((s: any) => s && s.id && s.testName);
        if (validScores.length > 0) {
          recoveredData.scores = validScores;
          console.log(`Data Recovery: Recovered ${validScores.length} scores from iCloud`);
        }
      }
      
      // Process recovered subjects
      if (iCloudSubjects && Array.isArray(iCloudSubjects)) {
        const validSubjects = iCloudSubjects.filter((s: any) => s && s.id && s.name);
        if (validSubjects.length > 0) {
          // Recalculate subject hours from sessions
          recoveredData.subjects = validSubjects.map((subject: Subject) => {
            const subjectSessions = recoveredData.sessions.filter(s => s.subjectId === subject.id);
            const completedMinutes = subjectSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            return {
              ...subject,
              completedHours: completedMinutes / 60,
            };
          });
          console.log(`Data Recovery: Recovered ${validSubjects.length} subjects from iCloud`);
        }
      }
      
      // Process recovered plans
      if (iCloudPlans && Array.isArray(iCloudPlans)) {
        const validPlans = iCloudPlans.filter((p: any) => p && p.subjectId);
        if (validPlans.length > 0) {
          recoveredData.plans = validPlans;
          console.log(`Data Recovery: Recovered ${validPlans.length} plans from iCloud`);
        }
      }
      
      // Process recovered exam dates
      if (iCloudDates && typeof iCloudDates === 'object') {
        const validDates = {
          NEET_PG: iCloudDates.NEET_PG || iCloudDates.neet_pg || iCloudDates.NEET || '',
          INICET: iCloudDates.INICET || iCloudDates.inicet || ''
        };
        
        if (validDates.NEET_PG || validDates.INICET) {
          recoveredData.examDates = validDates;
          console.log('Data Recovery: Recovered exam dates from iCloud');
        }
      }
      
      const totalRecovered = recoveredData.sessions.length + recoveredData.scores.length + 
                            recoveredData.subjects.length + recoveredData.plans.length;
      
      console.log('Data Recovery: iCloud recovery complete:', {
        sessions: recoveredData.sessions.length,
        scores: recoveredData.scores.length,
        subjects: recoveredData.subjects.length,
        plans: recoveredData.plans.length,
        examDates: recoveredData.examDates.NEET_PG || recoveredData.examDates.INICET ? 'Found' : 'None',
        totalRecovered
      });
      
      if (totalRecovered === 0 && !(recoveredData.examDates.NEET_PG || recoveredData.examDates.INICET)) {
        errors.push('No recoverable data found in iCloud');
      }
      
      return {
        success: totalRecovered > 0 || Boolean(recoveredData.examDates.NEET_PG || recoveredData.examDates.INICET),
        recoveredData,
        errors,
      };
    } catch (error) {
      console.error('Data Recovery: Error during iCloud recovery:', error);
      errors.push(`iCloud recovery error: ${error}`);
      return {
        success: false,
        recoveredData,
        errors,
      };
    }
  }
}