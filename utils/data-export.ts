import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert } from 'react-native';
import { StudySession, TestScore, Subject, StudyPlan } from '@/types/study';

interface ExportData {
  version: string;
  exportDate: string;
  userId?: string;
  userEmail?: string;
  data: {
    studySessions: StudySession[];
    testScores: TestScore[];
    subjects: Subject[];
    studyPlans: StudyPlan[];
    examDates: { NEET_PG: string; INICET: string };
  };
  metadata: {
    totalSessions: number;
    totalTests: number;
    totalStudyHours: number;
    appVersion: string;
    platform: string;
  };
}

export class DataExportService {
  private static readonly EXPORT_VERSION = '1.0.0';
  private static readonly APP_VERSION = '1.0.0';

  static async exportAllData(
    studySessions: StudySession[],
    testScores: TestScore[],
    subjects: Subject[],
    studyPlans: StudyPlan[],
    examDates: { NEET_PG: string; INICET: string },
    userId?: string,
    userEmail?: string
  ): Promise<boolean> {
    try {
      // Calculate metadata
      const totalStudyHours = studySessions.reduce((sum, session) => sum + (session.duration || 0), 0) / 60;

      const exportData: ExportData = {
        version: this.EXPORT_VERSION,
        exportDate: new Date().toISOString(),
        userId,
        userEmail,
        data: {
          studySessions,
          testScores,
          subjects,
          studyPlans,
          examDates,
        },
        metadata: {
          totalSessions: studySessions.length,
          totalTests: testScores.length,
          totalStudyHours: Math.round(totalStudyHours * 10) / 10,
          appVersion: this.APP_VERSION,
          platform: Platform?.OS || 'unknown',
        },
      };

      // Also backup to iCloud/Keychain on iOS for automatic backup
      if (Platform?.OS === 'ios' && userId) {
        try {
          await SecureStore.setItemAsync(`backup_${userId}_${Date.now()}`, JSON.stringify(exportData), {
            keychainService: 'StudyTrackerBackup',
            requireAuthentication: false,
          });
          console.log('Data automatically backed up to iCloud Keychain');
        } catch (iCloudError) {
          console.warn('iCloud backup failed:', iCloudError);
        }
      }

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `study-tracker-backup-${timestamp}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Write data to file
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: Platform?.OS === 'ios' 
            ? 'Save to Files app → iCloud Drive for automatic backup'
            : 'Export Study Data',
        });
        
        // Show additional instructions for iOS users
        if (Platform?.OS === 'ios') {
          setTimeout(() => {
            Alert.alert(
              'iCloud Backup Tip',
              'To ensure your backup is saved to iCloud:\n\n1. Tap "Save to Files"\n2. Choose "iCloud Drive"\n3. Select a folder\n4. Tap "Save"\n\nYour backup will now sync across all your Apple devices!',
              [{ text: 'Got it!' }]
            );
          }, 1000);
        }
        
        return true;
      } else {
        Alert.alert('Export Failed', 'Sharing is not available on this device');
        return false;
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Export Failed', 'Failed to export data. Please try again.');
      return false;
    }
  }

  static async importData(): Promise<ExportData | null> {
    try {
      // Pick a document - accept multiple file types
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return null;
      }

      const file = result.assets[0];
      if (!file || !file.uri) {
        Alert.alert('Import Failed', 'No file selected');
        return null;
      }

      console.log('Importing file:', file.name, 'Type:', file.mimeType, 'Size:', file.size);

      // Read the file
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log('File content preview:', content.substring(0, 200));

      if (!content || content.trim().length === 0) {
        Alert.alert('Import Failed', 'The selected file is empty');
        return null;
      }

      // Try to parse JSON with enhanced validation
      let importedData: any;
      try {
        const trimmed = content.trim();
        
        // Check for corrupted data patterns
        if (trimmed === 'object' || 
            trimmed.includes('[object Object]') ||
            trimmed.startsWith('[object') ||
            /^[a-zA-Z]+$/.test(trimmed)) {
          Alert.alert(
            'Import Failed', 
            'The backup file appears to be corrupted. Please try a different backup file.'
          );
          return null;
        }
        
        importedData = JSON.parse(trimmed);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        Alert.alert(
          'Import Failed', 
          'The file is not a valid JSON backup file. Please select a backup file exported from this app.'
        );
        return null;
      }

      // Check if it's our export format
      if (importedData && typeof importedData === 'object') {
        // Try to detect and convert different backup formats
        let convertedData: ExportData | null = null;

        // Check if it's our current format
        if (importedData.version && importedData.data) {
          convertedData = importedData as ExportData;
        }
        // Check if it's a legacy format or direct data export
        else if (importedData.studySessions || importedData.sessions || 
                 importedData.testScores || importedData.scores ||
                 importedData.subjects || importedData.plans) {
          // Convert legacy format
          convertedData = {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            data: {
              studySessions: importedData.studySessions || importedData.sessions || [],
              testScores: importedData.testScores || importedData.scores || [],
              subjects: importedData.subjects || [],
              studyPlans: importedData.studyPlans || importedData.plans || [],
              examDates: importedData.examDates || { NEET_PG: '', INICET: '' },
            },
            metadata: {
              totalSessions: (importedData.studySessions || importedData.sessions || []).length,
              totalTests: (importedData.testScores || importedData.scores || []).length,
              totalStudyHours: 0,
              appVersion: '1.0.0',
              platform: 'unknown',
            },
          };
        }
        // Check if it's just an array of sessions or scores
        else if (Array.isArray(importedData)) {
          // Assume it's an array of study sessions
          convertedData = {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            data: {
              studySessions: importedData,
              testScores: [],
              subjects: [],
              studyPlans: [],
              examDates: { NEET_PG: '', INICET: '' },
            },
            metadata: {
              totalSessions: importedData.length,
              totalTests: 0,
              totalStudyHours: 0,
              appVersion: '1.0.0',
              platform: 'unknown',
            },
          };
        }

        if (convertedData) {
          // Validate the converted data
          const { data } = convertedData;
          
          // Ensure all required fields are arrays
          data.studySessions = Array.isArray(data.studySessions) ? data.studySessions : [];
          data.testScores = Array.isArray(data.testScores) ? data.testScores : [];
          data.subjects = Array.isArray(data.subjects) ? data.subjects : [];
          data.studyPlans = Array.isArray(data.studyPlans) ? data.studyPlans : [];
          data.examDates = data.examDates || { NEET_PG: '', INICET: '' };

          // Check if we have any meaningful data
          const totalItems = data.studySessions.length + data.testScores.length + 
                            data.subjects.length + data.studyPlans.length;
          
          if (totalItems === 0 && !data.examDates.NEET_PG && !data.examDates.INICET) {
            Alert.alert(
              'Import Failed', 
              'The backup file contains no data to import. Please select a valid backup file.'
            );
            return null;
          }

          console.log('Successfully converted backup data:', {
            sessions: data.studySessions.length,
            scores: data.testScores.length,
            subjects: data.subjects.length,
            plans: data.studyPlans.length
          });

          return convertedData;
        }
      }

      // If we get here, the format is not recognized
      Alert.alert(
        'Import Failed', 
        'The selected file is not a recognized backup format. Please select a backup file exported from this app.'
      );
      return null;

    } catch (error) {
      console.error('Error importing data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Import Failed', 
        `Failed to import data: ${errorMessage}\n\nPlease check the file and try again.`
      );
      return null;
    }
  }

  static async saveImportedData(
    importedData: ExportData,
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

    const { data } = importedData;

    // Save all data to AsyncStorage
    await Promise.all([
      AsyncStorage.setItem(keys.STUDY_SESSIONS, JSON.stringify(data.studySessions)),
      AsyncStorage.setItem(keys.TEST_SCORES, JSON.stringify(data.testScores)),
      AsyncStorage.setItem(keys.SUBJECTS, JSON.stringify(data.subjects)),
      AsyncStorage.setItem(keys.STUDY_PLANS, JSON.stringify(data.studyPlans)),
      AsyncStorage.setItem(keys.EXAM_DATES, JSON.stringify(data.examDates)),
    ]);

    // If user is logged in, also save to cloud storage
    if (userId) {
      const cloudKeys = {
        CLOUD_STUDY_SESSIONS: `cloud_${prefix}study_sessions`,
        CLOUD_TEST_SCORES: `cloud_${prefix}test_scores`,
        CLOUD_SUBJECTS: `cloud_${prefix}subjects`,
        CLOUD_STUDY_PLANS: `cloud_${prefix}study_plans`,
        CLOUD_EXAM_DATES: `cloud_${prefix}exam_dates`,
        LAST_CLOUD_SYNC: `${prefix}last_cloud_sync`,
      };

      await Promise.all([
        AsyncStorage.setItem(cloudKeys.CLOUD_STUDY_SESSIONS, JSON.stringify(data.studySessions)),
        AsyncStorage.setItem(cloudKeys.CLOUD_TEST_SCORES, JSON.stringify(data.testScores)),
        AsyncStorage.setItem(cloudKeys.CLOUD_SUBJECTS, JSON.stringify(data.subjects)),
        AsyncStorage.setItem(cloudKeys.CLOUD_STUDY_PLANS, JSON.stringify(data.studyPlans)),
        AsyncStorage.setItem(cloudKeys.CLOUD_EXAM_DATES, JSON.stringify(data.examDates)),
        AsyncStorage.setItem(cloudKeys.LAST_CLOUD_SYNC, new Date().toISOString()),
      ]);
    }

    // Also backup to iCloud on iOS
    if (Platform?.OS === 'ios' && userId) {
      try {
        await SecureStore.setItemAsync(`backup_${userId}_${Date.now()}`, JSON.stringify(importedData), {
          keychainService: 'StudyTrackerBackup',
          requireAuthentication: false,
        });
        console.log('Imported data backed up to iCloud');
      } catch (error) {
        console.warn('iCloud backup of imported data failed:', error);
      }
    }

    console.log('Imported data saved successfully');
  }

  static async mergeImportedData(
    importedData: ExportData,
    existingData: {
      studySessions: StudySession[];
      testScores: TestScore[];
      subjects: Subject[];
      studyPlans: StudyPlan[];
      examDates: { NEET_PG: string; INICET: string };
    }
  ): Promise<typeof existingData> {
    const { data: imported } = importedData;

    // Merge sessions (avoid duplicates by ID)
    const sessionMap = new Map<string, StudySession>();
    existingData.studySessions.forEach(s => sessionMap.set(s.id, s));
    imported.studySessions.forEach(s => {
      if (!sessionMap.has(s.id)) {
        sessionMap.set(s.id, s);
      }
    });

    // Merge test scores
    const scoreMap = new Map<string, TestScore>();
    existingData.testScores.forEach(s => scoreMap.set(s.id, s));
    imported.testScores.forEach(s => {
      if (!scoreMap.has(s.id)) {
        scoreMap.set(s.id, s);
      }
    });

    // Merge subjects (prefer imported if no existing)
    const subjects = existingData.subjects.length > 0 ? existingData.subjects : imported.subjects;

    // Merge study plans
    const planMap = new Map<string, StudyPlan>();
    existingData.studyPlans.forEach(p => planMap.set(p.subjectId, p));
    imported.studyPlans.forEach(p => planMap.set(p.subjectId, p));

    // Merge exam dates (prefer imported if existing is empty)
    const examDates = (existingData.examDates.NEET_PG || existingData.examDates.INICET)
      ? existingData.examDates
      : imported.examDates;

    return {
      studySessions: Array.from(sessionMap.values()).sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
      testScores: Array.from(scoreMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      subjects,
      studyPlans: Array.from(planMap.values()),
      examDates,
    };
  }

  // Get available iCloud backups on iOS
  static async getAvailableiCloudBackups(userId?: string): Promise<string[]> {
    if (Platform?.OS !== 'ios') return [];
    
    try {
      // This is a limitation - SecureStore doesn't provide a way to list keys
      // We'll try to get recent backups by checking common patterns
      const backupKeys = [];
      const now = Date.now();
      
      // Check for backups from the last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(now - (i * 24 * 60 * 60 * 1000));
        const timestamp = date.getTime();
        const key = `backup_${userId}_${timestamp}`;
        
        try {
          const data = await SecureStore.getItemAsync(key, {
            keychainService: 'StudyTrackerBackup',
            requireAuthentication: false,
          });
          if (data) {
            backupKeys.push(key);
          }
        } catch {
          // Key doesn't exist, continue
        }
      }
      
      return backupKeys;
    } catch (error) {
      console.error('Error getting iCloud backups:', error);
      return [];
    }
  }

  // Restore from iCloud backup
  static async restoreFromiCloudBackup(backupKey: string): Promise<ExportData | null> {
    if (Platform?.OS !== 'ios') return null;
    
    try {
      const data = await SecureStore.getItemAsync(backupKey, {
        keychainService: 'StudyTrackerBackup',
        requireAuthentication: false,
      });
      
      if (data) {
        // Validate data before parsing
        const trimmed = data.trim();
        if (trimmed === 'object' || 
            trimmed.includes('[object Object]') ||
            trimmed.startsWith('[object') ||
            /^[a-zA-Z]+$/.test(trimmed)) {
          console.warn('iCloud backup data appears corrupted');
          return null;
        }
        
        return JSON.parse(trimmed) as ExportData;
      }
    } catch (error) {
      console.error('Error restoring from iCloud backup:', error);
    }
    
    return null;
  }
}