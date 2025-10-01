import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { StudySession, TestScore, Subject, StudyPlan } from '@/types/study';

interface BackupData {
  version: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  data: {
    studySessions: StudySession[];
    testScores: TestScore[];
    subjects: Subject[];
    studyPlans: StudyPlan[];
    examDates: { NEET_PG: string; INICET: string };
    todayProgress: {
      date: string;
      totalMinutes: number;
      lastResetTime: string;
    };
    dailyTargetHours: number;
  };
  metadata: {
    totalSessions: number;
    totalTests: number;
    totalStudyHours: number;
    deviceInfo: {
      platform: string;
      appVersion: string;
    };
  };
}

interface BackupStatus {
  isAvailable: boolean;
  lastBackupDate?: string;
  backupCount: number;
  error?: string;
}

export class iCloudBackupService {
  private static readonly KEYCHAIN_SERVICE = 'StudyTrackerBackup';
  private static readonly BACKUP_VERSION = '2.0.0';
  private static readonly APP_VERSION = '1.0.0';
  private static readonly MAX_BACKUPS = 10; // Keep last 10 backups
  private static readonly BACKUP_PREFIX = 'backup_';
  private static readonly STATUS_KEY = 'backup_status';
  private static readonly INDEX_KEY = 'backup_index';

  // Check if iCloud Keychain is available
  static async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      // Test if we can write to and read from Keychain
      const testKey = 'test_availability';
      const testValue = 'test';
      
      await SecureStore.setItemAsync(testKey, testValue, {
        keychainService: this.KEYCHAIN_SERVICE,
        requireAuthentication: false,
      });
      
      const result = await SecureStore.getItemAsync(testKey, {
        keychainService: this.KEYCHAIN_SERVICE,
        requireAuthentication: false,
      });
      
      // Clean up test data
      await SecureStore.deleteItemAsync(testKey, {
        keychainService: this.KEYCHAIN_SERVICE,
      });
      
      return result === testValue;
    } catch (error) {
      console.error('iCloud Keychain availability check failed:', error);
      return false;
    }
  }

  // Get backup status
  static async getBackupStatus(userId?: string): Promise<BackupStatus> {
    if (Platform.OS !== 'ios') {
      return {
        isAvailable: false,
        backupCount: 0,
        error: 'iCloud Keychain is only available on iOS'
      };
    }

    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return {
          isAvailable: false,
          backupCount: 0,
          error: 'iCloud Keychain is not available or accessible'
        };
      }

      // Get backup list
      const backups = await this.getBackupList(userId);
      const lastBackup = backups.length > 0 ? backups[0] : null;

      return {
        isAvailable: true,
        lastBackupDate: lastBackup?.timestamp,
        backupCount: backups.length,
      };
    } catch (error) {
      console.error('Error getting backup status:', error);
      return {
        isAvailable: false,
        backupCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Create a backup
  static async createBackup(
    studySessions: StudySession[],
    testScores: TestScore[],
    subjects: Subject[],
    studyPlans: StudyPlan[],
    examDates: { NEET_PG: string; INICET: string },
    todayProgress: { date: string; totalMinutes: number; lastResetTime: string },
    dailyTargetHours: number,
    userId?: string,
    userEmail?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'iCloud Keychain is only available on iOS' };
    }

    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return { success: false, error: 'iCloud Keychain is not available' };
      }

      // Calculate metadata
      const totalStudyHours = studySessions.reduce((sum, session) => sum + (session.duration || 0), 0) / 60;

      const backupData: BackupData = {
        version: this.BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        userId,
        userEmail,
        data: {
          studySessions,
          testScores,
          subjects,
          studyPlans,
          examDates,
          todayProgress,
          dailyTargetHours,
        },
        metadata: {
          totalSessions: studySessions.length,
          totalTests: testScores.length,
          totalStudyHours: Math.round(totalStudyHours * 10) / 10,
          deviceInfo: {
            platform: Platform.OS,
            appVersion: this.APP_VERSION,
          },
        },
      };

      // Create backup key with timestamp
      const timestamp = Date.now();
      const backupKey = `${this.BACKUP_PREFIX}${userId || 'guest'}_${timestamp}`;

      // Save backup to Keychain
      await SecureStore.setItemAsync(backupKey, JSON.stringify(backupData), {
        keychainService: this.KEYCHAIN_SERVICE,
        requireAuthentication: false,
      });

      // Add to backup index
      await this.addToBackupIndex(backupKey, userId);

      // Update backup status
      await this.updateBackupStatus(userId, backupData.timestamp);

      // Clean up old backups
      await this.cleanupOldBackups(userId);

      console.log('iCloud backup created successfully:', backupKey);
      return { success: true };
    } catch (error) {
      console.error('Error creating iCloud backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup'
      };
    }
  }

  // Get list of available backups
  static async getBackupList(userId?: string): Promise<BackupData[]> {
    if (Platform.OS !== 'ios') {
      return [];
    }

    try {
      // Get backup index
      const indexKey = `${this.INDEX_KEY}_${userId || 'guest'}`;
      const indexData = await SecureStore.getItemAsync(indexKey, {
        keychainService: this.KEYCHAIN_SERVICE,
        requireAuthentication: false,
      });
      
      if (!indexData) {
        return [];
      }
      
      const backupKeys: string[] = JSON.parse(indexData);
      const backups: BackupData[] = [];
      
      // Fetch each backup
      for (const backupKey of backupKeys) {
        try {
          const data = await SecureStore.getItemAsync(backupKey, {
            keychainService: this.KEYCHAIN_SERVICE,
            requireAuthentication: false,
          });
          
          if (data) {
            const backupData = JSON.parse(data) as BackupData;
            backups.push(backupData);
          }
        } catch (error) {
          console.error(`Error loading backup ${backupKey}:`, error);
          // Remove invalid key from index
          await this.removeFromBackupIndex(backupKey, userId);
        }
      }
      
      // Sort by timestamp (newest first)
      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error getting backup list:', error);
      return [];
    }
  }

  // Restore from backup
  static async restoreFromBackup(
    backupTimestamp: string,
    userId?: string
  ): Promise<{ success: boolean; data?: BackupData['data']; error?: string }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'iCloud Keychain is only available on iOS' };
    }

    try {
      const backups = await this.getBackupList(userId);
      const backup = backups.find(b => b.timestamp === backupTimestamp);
      
      if (!backup) {
        return { success: false, error: 'Backup not found' };
      }

      // Validate backup data
      if (!backup.data || typeof backup.data !== 'object') {
        return { success: false, error: 'Invalid backup data' };
      }

      // Ensure all required fields exist
      const data = {
        studySessions: Array.isArray(backup.data.studySessions) ? backup.data.studySessions : [],
        testScores: Array.isArray(backup.data.testScores) ? backup.data.testScores : [],
        subjects: Array.isArray(backup.data.subjects) ? backup.data.subjects : [],
        studyPlans: Array.isArray(backup.data.studyPlans) ? backup.data.studyPlans : [],
        examDates: backup.data.examDates || { NEET_PG: '', INICET: '' },
        todayProgress: backup.data.todayProgress || {
          date: new Date().toISOString().split('T')[0],
          totalMinutes: 0,
          lastResetTime: new Date().toISOString()
        },
        dailyTargetHours: typeof backup.data.dailyTargetHours === 'number' ? backup.data.dailyTargetHours : 4,
      };

      console.log('iCloud backup restored successfully:', {
        sessions: data.studySessions.length,
        scores: data.testScores.length,
        subjects: data.subjects.length,
        plans: data.studyPlans.length,
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error restoring from iCloud backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup'
      };
    }
  }

  // Delete a specific backup
  static async deleteBackup(
    backupTimestamp: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'iCloud Keychain is only available on iOS' };
    }

    try {
      const backups = await this.getBackupList(userId);
      const backup = backups.find(b => b.timestamp === backupTimestamp);
      
      if (!backup) {
        return { success: false, error: 'Backup not found' };
      }

      // Find the backup key by timestamp
      const timestamp = new Date(backupTimestamp).getTime();
      const backupKey = `${this.BACKUP_PREFIX}${userId || 'guest'}_${timestamp}`;

      await SecureStore.deleteItemAsync(backupKey, {
        keychainService: this.KEYCHAIN_SERVICE,
      });

      // Remove from backup index
      await this.removeFromBackupIndex(backupKey, userId);

      console.log('iCloud backup deleted successfully:', backupKey);
      return { success: true };
    } catch (error) {
      console.error('Error deleting iCloud backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup'
      };
    }
  }

  // Clean up old backups (keep only the latest MAX_BACKUPS)
  private static async cleanupOldBackups(userId?: string): Promise<void> {
    try {
      const backups = await this.getBackupList(userId);
      
      if (backups.length > this.MAX_BACKUPS) {
        const backupsToDelete = backups.slice(this.MAX_BACKUPS);
        
        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.timestamp, userId);
        }
        
        console.log(`Cleaned up ${backupsToDelete.length} old backups`);
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  // Add backup key to index
  private static async addToBackupIndex(backupKey: string, userId?: string): Promise<void> {
    try {
      const indexKey = `${this.INDEX_KEY}_${userId || 'guest'}`;
      
      // Get existing index
      let backupKeys: string[] = [];
      try {
        const indexData = await SecureStore.getItemAsync(indexKey, {
          keychainService: this.KEYCHAIN_SERVICE,
          requireAuthentication: false,
        });
        if (indexData) {
          backupKeys = JSON.parse(indexData);
        }
      } catch {
        // Index doesn't exist yet
      }
      
      // Add new backup key if not already present
      if (!backupKeys.includes(backupKey)) {
        backupKeys.push(backupKey);
        
        // Save updated index
        await SecureStore.setItemAsync(indexKey, JSON.stringify(backupKeys), {
          keychainService: this.KEYCHAIN_SERVICE,
          requireAuthentication: false,
        });
      }
    } catch (error) {
      console.error('Error adding to backup index:', error);
    }
  }

  // Remove backup key from index
  private static async removeFromBackupIndex(backupKey: string, userId?: string): Promise<void> {
    try {
      const indexKey = `${this.INDEX_KEY}_${userId || 'guest'}`;
      
      // Get existing index
      const indexData = await SecureStore.getItemAsync(indexKey, {
        keychainService: this.KEYCHAIN_SERVICE,
        requireAuthentication: false,
      });
      
      if (indexData) {
        let backupKeys: string[] = JSON.parse(indexData);
        backupKeys = backupKeys.filter(key => key !== backupKey);
        
        // Save updated index
        await SecureStore.setItemAsync(indexKey, JSON.stringify(backupKeys), {
          keychainService: this.KEYCHAIN_SERVICE,
          requireAuthentication: false,
        });
      }
    } catch (error) {
      console.error('Error removing from backup index:', error);
    }
  }

  // Update backup status
  private static async updateBackupStatus(userId?: string, lastBackupDate?: string): Promise<void> {
    try {
      const statusKey = `${this.STATUS_KEY}_${userId || 'guest'}`;
      const status = {
        lastBackupDate,
        updatedAt: new Date().toISOString(),
      };

      await SecureStore.setItemAsync(statusKey, JSON.stringify(status), {
        keychainService: this.KEYCHAIN_SERVICE,
        requireAuthentication: false,
      });
    } catch (error) {
      console.error('Error updating backup status:', error);
    }
  }

  // Auto backup (call this periodically or after significant data changes)
  static async autoBackup(
    studySessions: StudySession[],
    testScores: TestScore[],
    subjects: Subject[],
    studyPlans: StudyPlan[],
    examDates: { NEET_PG: string; INICET: string },
    todayProgress: { date: string; totalMinutes: number; lastResetTime: string },
    dailyTargetHours: number,
    userId?: string,
    userEmail?: string
  ): Promise<void> {
    // Validate inputs
    if (!Array.isArray(studySessions) || !Array.isArray(testScores) || 
        !Array.isArray(subjects) || !Array.isArray(studyPlans) ||
        !examDates || typeof examDates !== 'object' ||
        !todayProgress || typeof todayProgress !== 'object' ||
        typeof dailyTargetHours !== 'number' || dailyTargetHours <= 0) {
      console.error('Invalid input data for auto backup');
      return;
    }
    
    if (userEmail && typeof userEmail !== 'string') {
      console.error('Invalid userEmail for auto backup');
      return;
    }
    try {
      const status = await this.getBackupStatus(userId);
      
      if (!status.isAvailable) {
        console.log('Auto backup skipped: iCloud Keychain not available');
        return;
      }

      // Check if we need to create a backup (e.g., if last backup is older than 24 hours)
      const shouldBackup = !status.lastBackupDate || 
        (Date.now() - new Date(status.lastBackupDate).getTime()) > (24 * 60 * 60 * 1000);

      if (shouldBackup) {
        console.log('Creating auto backup...');
        const result = await this.createBackup(
          studySessions,
          testScores,
          subjects,
          studyPlans,
          examDates,
          todayProgress,
          dailyTargetHours,
          userId,
          userEmail
        );
        
        if (result.success) {
          console.log('Auto backup created successfully');
        } else {
          console.error('Auto backup failed:', result.error);
        }
      } else {
        console.log('Auto backup skipped: Recent backup exists');
      }
    } catch (error) {
      console.error('Error in auto backup:', error);
    }
  }

  // Get backup info for display
  static async getBackupInfo(userId?: string): Promise<{
    isAvailable: boolean;
    status: string;
    lastBackupDate?: string;
    backupCount: number;
    nextAutoBackup?: string;
  }> {
    const status = await this.getBackupStatus(userId);
    
    if (!status.isAvailable) {
      return {
        isAvailable: false,
        status: status.error || 'iCloud Keychain not available',
        backupCount: 0,
      };
    }

    let statusText = 'Available';
    let nextAutoBackup: string | undefined;
    
    if (status.lastBackupDate) {
      const lastBackup = new Date(status.lastBackupDate);
      const now = new Date();
      const hoursSinceBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceBackup < 1) {
        statusText = 'Recently backed up';
      } else if (hoursSinceBackup < 24) {
        statusText = `Last backup ${Math.floor(hoursSinceBackup)} hours ago`;
      } else {
        const daysSinceBackup = Math.floor(hoursSinceBackup / 24);
        statusText = `Last backup ${daysSinceBackup} day${daysSinceBackup > 1 ? 's' : ''} ago`;
      }
      
      // Calculate next auto backup (24 hours after last backup)
      const nextBackupTime = new Date(lastBackup.getTime() + (24 * 60 * 60 * 1000));
      if (nextBackupTime > now) {
        nextAutoBackup = nextBackupTime.toISOString();
      }
    } else {
      statusText = 'No backups found';
    }

    return {
      isAvailable: true,
      status: statusText,
      lastBackupDate: status.lastBackupDate,
      backupCount: status.backupCount,
      nextAutoBackup,
    };
  }
}

// Helper function to format backup date for display
export const formatBackupDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)} hour${Math.floor(diffHours) > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)} day${Math.floor(diffDays) > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    return 'Unknown date';
  }
};