import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Platform, Modal, Animated, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStudy } from '@/hooks/study-context';
import { useAuth } from '@/hooks/auth-context';
import { DataRecoveryService } from '@/utils/data-recovery';
import { DataExportService } from '@/utils/data-export';
import { iCloudBackupService } from '@/utils/icloud-backup';
import { Ionicons, FontAwesome, MaterialIcons, Feather, Entypo } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';


const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (error) {
    return 'Invalid date';
  }
};



export default function SettingsScreen() {
  const { 
    clearAllData, 
    refreshData, 
    studySessions, 
    testScores, 
    subjects, 
    studyPlans, 
    examDates, 
    currentUser,
    updateExamDates,
    dailyTargetHours,
    updateDailyTargetHours
  } = useStudy();
  const { user, signOut, signInWithApple, isLoading: authLoading, isAppleSignInAvailable, signInWithGoogle } = useAuth();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const [iCloudStatus, setICloudStatus] = useState<'checking' | 'available' | 'unavailable' | 'synced'>('checking');
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [iCloudBackupInfo, setICloudBackupInfo] = useState<any>(null);
  const [showNEETPGPicker, setShowNEETPGPicker] = useState(false);
  const [showINICETPicker, setShowINICETPicker] = useState(false);
  const [tempNEETDate, setTempNEETDate] = useState<Date | null>(null);
  const [tempINICETDate, setTempINICETDate] = useState<Date | null>(null);
  const [showTargetHoursModal, setShowTargetHoursModal] = useState(false);
  const [tempTargetHours, setTempTargetHours] = useState<string>(dailyTargetHours.toString());
  const [backupCount, setBackupCount] = useState<number>(0);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [showBackupList, setShowBackupList] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<any[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Load theme preference and check iCloud status
    checkiCloudStatus();
  }, [currentUser]);

  const checkiCloudStatus = async () => {
    if (Platform.OS !== 'ios') {
      setICloudStatus('unavailable');
      return;
    }

    try {
      const backupInfo = await iCloudBackupService.getBackupInfo(currentUser?.id);
      setICloudBackupInfo(backupInfo);
      
      if (backupInfo.isAvailable) {
        setICloudStatus(backupInfo.lastBackupDate ? 'synced' : 'available');
        setLastBackupTime(backupInfo.lastBackupDate || null);
        setBackupCount(backupInfo.backupCount);
      } else {
        setICloudStatus('unavailable');
      }
    } catch (error) {
      console.error('Error checking iCloud status:', error);
      setICloudStatus('unavailable');
    }
  };

  const handleRecoverData = async () => {
    try {
      setIsRecovering(true);
      
      // Show recovery options
      const recoveryOptions = [];
      
      // Add iCloud option for iOS users (placeholder for future implementation)
      // if (Platform.OS === 'ios' && currentUser?.id) {
      //   recoveryOptions.push({
      //     text: 'iCloud Backup',
      //     onPress: () => performiCloudRecovery()
      //   });
      // }
      
      // Add local storage option
      recoveryOptions.push({
        text: 'Local Storage',
        onPress: () => performLocalRecovery()
      });
      
      // Add file import option
      recoveryOptions.push({
        text: 'Import from File',
        onPress: () => performFileImport()
      });
      
      // Add cancel option
      recoveryOptions.unshift({ text: 'Cancel', style: 'cancel' as const });
      
      Alert.alert(
        'Restore Data',
        'Choose where to restore your data from:',
        recoveryOptions
      );
    } catch (error) {
      console.error('Recovery error:', error);
      Alert.alert(
        'Recovery Error', 
        `An error occurred during data recovery:\n\n${error}\n\nPlease check your device storage and try again.`
      );
    } finally {
      setIsRecovering(false);
    }
  };
  
  const performiCloudRecovery = async () => {
    // Placeholder for future iCloud implementation
    Alert.alert('Coming Soon', 'iCloud backup and restore will be available in a future update.');
  };
  
  const performFileImport = async () => {
    try {
      console.log('Starting file import...');
      const importedData = await DataExportService.importData();
      
      if (importedData) {
        const { data } = importedData;
        const totalItems = data.studySessions.length + data.testScores.length + 
                          data.subjects.length + data.studyPlans.length;
        const hasExamDates = data.examDates.NEET_PG || data.examDates.INICET;
        
        if (totalItems > 0 || hasExamDates) {
          let message = 'Successfully imported backup file:\n\n';
          
          if (data.studySessions.length > 0) {
            message += `• ${data.studySessions.length} study sessions\n`;
          }
          if (data.testScores.length > 0) {
            message += `• ${data.testScores.length} test scores\n`;
          }
          if (data.subjects.length > 0) {
            message += `• ${data.subjects.length} subjects\n`;
          }
          if (data.studyPlans.length > 0) {
            message += `• ${data.studyPlans.length} study plans\n`;
          }
          if (hasExamDates) {
            message += `• Exam dates\n`;
          }
          
          message += '\nThis will merge with your existing data. Continue?';
          
          Alert.alert(
            'Import Successful',
            message,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Import Data',
                onPress: async () => {
                  try {
                    await DataExportService.saveImportedData(importedData, currentUser?.id);
                    await refreshData();
                    Alert.alert('Success', `Data imported successfully!\n\nImported ${totalItems} items${hasExamDates ? ' + exam dates' : ''}.`);
                  } catch (error) {
                    console.error('Error saving imported data:', error);
                    Alert.alert('Error', 'Failed to save imported data. Please try again.');
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert('No Data', 'The selected file contains no data to import.');
        }
      }
    } catch (error) {
      console.error('File import error:', error);
      // Error is already handled in DataExportService.importData()
    }
  };

  const performLocalRecovery = async () => {
    const result = await DataRecoveryService.recoverAllData(currentUser?.id);
    
    console.log('Local recovery result:', result);
    
    if (result.success) {
      const totalItems = result.recoveredData.sessions.length + 
                        result.recoveredData.scores.length + 
                        result.recoveredData.subjects.length + 
                        result.recoveredData.plans.length;
      
      const hasExamDates = result.recoveredData.examDates.NEET_PG || result.recoveredData.examDates.INICET;
      
      if (totalItems > 0 || hasExamDates) {
        let message = 'Found recoverable data:\n\n';
        
        if (result.recoveredData.sessions.length > 0) {
          message += `• ${result.recoveredData.sessions.length} study sessions\n`;
        }
        if (result.recoveredData.scores.length > 0) {
          message += `• ${result.recoveredData.scores.length} test scores\n`;
        }
        if (result.recoveredData.subjects.length > 0) {
          message += `• ${result.recoveredData.subjects.length} subjects\n`;
        }
        if (result.recoveredData.plans.length > 0) {
          message += `• ${result.recoveredData.plans.length} study plans\n`;
        }
        if (hasExamDates) {
          message += `• Exam dates\n`;
        }
        
        if (result.errors.length > 0) {
          message += `\n⚠️ ${result.errors.length} recovery warnings (check console for details)`;
        }
        
        message += '\n\nThis will merge with your existing data. Continue?';
        
        Alert.alert(
          'Data Recovery Successful',
          message,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Restore Data',
              onPress: async () => {
                try {
                  await DataRecoveryService.saveRecoveredData(result.recoveredData, currentUser?.id);
                  await refreshData();
                  Alert.alert('Success', `Data restored successfully!\n\nRecovered ${totalItems} items${hasExamDates ? ' + exam dates' : ''}.`);
                } catch (error) {
                  console.error('Error saving recovered data:', error);
                  Alert.alert('Error', 'Failed to save recovered data. Please try again.');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'No Data Found', 
          result.errors.length > 0 
            ? `No recoverable data found.\n\nIssues encountered:\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}` 
            : 'No recoverable data was found in local storage.'
        );
      }
    } else {
      const errorMessage = result.errors.length > 0 
        ? `Recovery failed:\n\n${result.errors.slice(0, 2).join('\n')}${result.errors.length > 2 ? '\n...' : ''}` 
        : 'Failed to recover data. Please try again.';
      
      Alert.alert('Recovery Failed', errorMessage);
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      
      // Show export options
      Alert.alert(
        'Export Data',
        Platform.OS === 'ios' 
          ? 'Choose export method:\n\n• Share File: Create a backup file to save anywhere\n• iCloud Backup: Secure backup to your iCloud Keychain'
          : 'Export your study data to a backup file',
        Platform.OS === 'ios' ? [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'iCloud Backup',
            onPress: async () => {
              await handleCreateiCloudBackup();
            }
          },
          {
            text: 'Share File',
            onPress: async () => {
              const success = await DataExportService.exportAllData(
                studySessions,
                testScores,
                subjects,
                studyPlans,
                examDates,
                currentUser?.id,
                currentUser?.email
              );
              
              if (success) {
                Alert.alert('Success', 'Data exported successfully! Save to Files app for iCloud sync.');
              }
            }
          }
        ] : [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Export',
            onPress: async () => {
              const success = await DataExportService.exportAllData(
                studySessions,
                testScores,
                subjects,
                studyPlans,
                examDates,
                currentUser?.id,
                currentUser?.email
              );
              
              if (success) {
                Alert.alert('Success', 'Data exported successfully!');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateiCloudBackup = async () => {
    try {
      setIsCreatingBackup(true);
      
      // Get today's progress from study context
      const todayProgress = {
        date: new Date().toISOString().split('T')[0],
        totalMinutes: 0, // This should come from your study context
        lastResetTime: new Date().toISOString()
      };
      
      const result = await iCloudBackupService.createBackup(
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
      
      if (result.success) {
        Alert.alert('Success', 'Data backed up to iCloud Keychain successfully!');
        await checkiCloudStatus(); // Refresh status
      } else {
        Alert.alert('Backup Failed', result.error || 'Failed to create iCloud backup.');
      }
    } catch (error) {
      console.error('Error creating iCloud backup:', error);
      Alert.alert('Error', 'Failed to create iCloud backup.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleManageiCloudBackups = async () => {
    try {
      const backups = await iCloudBackupService.getBackupList(currentUser?.id);
      setAvailableBackups(backups);
      setShowBackupList(true);
    } catch (error) {
      console.error('Error getting backup list:', error);
      Alert.alert('Error', 'Failed to get backup list.');
    }
  };

  const handleDeleteBackup = async (backupTimestamp: string) => {
    Alert.alert(
      'Delete Backup',
      'Are you sure you want to delete this backup? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await iCloudBackupService.deleteBackup(backupTimestamp, currentUser?.id);
              
              if (result.success) {
                Alert.alert('Success', 'Backup deleted successfully.');
                await handleManageiCloudBackups(); // Refresh list
                await checkiCloudStatus(); // Refresh status
              } else {
                Alert.alert('Error', result.error || 'Failed to delete backup.');
              }
            } catch (error) {
              console.error('Error deleting backup:', error);
              Alert.alert('Error', 'Failed to delete backup.');
            }
          }
        }
      ]
    );
  };

  const handleRestoreFromiCloudBackup = async (backupTimestamp: string) => {
    Alert.alert(
      'Restore Backup',
      'This will replace your current data with the backup data. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await iCloudBackupService.restoreFromBackup(backupTimestamp, currentUser?.id);
              
              if (result.success && result.data) {
                // Here you would need to update your study context with the restored data
                // This depends on how your study context is structured
                await refreshData();
                Alert.alert('Success', 'Data restored successfully from iCloud backup!');
                await checkiCloudStatus(); // Refresh status
              } else {
                Alert.alert('Restore Failed', result.error || 'Failed to restore from backup.');
              }
            } catch (error) {
              console.error('Error restoring backup:', error);
              Alert.alert('Error', 'Failed to restore backup.');
            }
          }
        }
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Success', 'All data has been cleared.');
          }
        }
      ]
    );
  };



  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Settings' }} />
      
      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {user ? (
            <View style={styles.accountCard}>
              <View style={styles.accountInfo}>
                <FontAwesome name="user" size={24} color="#007AFF" />
                <View style={styles.accountDetails}>
                  <Text style={styles.accountName}>{user.name}</Text>
                  <Text style={styles.accountEmail}>{user.email}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
                <MaterialIcons name="logout" size={16} color="#FF3B30" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loginSection}>
              <View style={styles.loginPrompt}>
                <MaterialIcons name="login" size={24} color="#8E8E93" />
                <Text style={styles.loginPromptText}>Sign in to sync your data across devices</Text>
              </View>
              
              {Platform.OS === 'ios' && isAppleSignInAvailable && (
                <TouchableOpacity 
                  style={styles.appleSignInButton} 
                  onPress={signInWithApple}
                  disabled={authLoading}
                >
                  <Text style={styles.appleSignInText}>
                    {authLoading ? 'Signing in...' : (Platform.OS === 'ios' ? 'iCloud Login' : 'Sign in with Apple')}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Google Sign-In (Android & Web) */}
              {(Platform.OS !== 'ios') && (
                <TouchableOpacity
                  style={styles.googleSignInButton}
                  onPress={async () => {
                    try {
                      await signInWithGoogle?.();
                    } catch (e) {
                      console.error('Google sign-in error:', e);
                      Alert.alert('Sign-In Error', 'Failed to sign in with Google.');
                    }
                  }}
                  disabled={authLoading}
                >
                  <Text style={styles.googleSignInText}>{authLoading ? 'Signing in...' : 'Sign in with Google'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Data Management {Platform.OS === 'ios' && '(iCloud Enabled)'}
          </Text>
          
          {Platform.OS === 'ios' && (
            <View style={styles.iCloudStatus}>
              <View style={styles.settingLeft}>
                <FontAwesome name="cloud" size={16} color={iCloudStatus === 'synced' ? '#34C759' : iCloudStatus === 'available' ? '#007AFF' : '#FF3B30'} />
                <Text style={styles.iCloudStatusText}>
                  iCloud Status: {iCloudStatus === 'synced' ? 'Synced' : iCloudStatus === 'available' ? (currentUser ? 'Available' : 'Available (Sign in to use)') : iCloudStatus === 'checking' ? 'Checking...' : 'Coming Soon'}
                </Text>
              </View>
              {lastBackupTime && iCloudStatus === 'synced' && (
                <Text style={styles.lastBackupText}>
                  Last backup: {formatDate(lastBackupTime.split('T')[0])}
                </Text>
              )}
              {iCloudStatus === 'unavailable' && (
                <Text style={styles.lastBackupText}>
                  {iCloudBackupInfo?.status || 'iCloud Keychain not available'}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.settingItem} onPress={handleExportData} disabled={isExporting || isCreatingBackup}>
            <View style={styles.settingLeft}>
              {Platform.OS === 'ios' ? <FontAwesome name="cloud" size={20} color="#007AFF" /> : <MaterialIcons name="file-upload" size={20} color="#007AFF" />}
              <Text style={styles.settingText}>
                {Platform.OS === 'ios' ? 'Backup Data' : 'Export Data'}
              </Text>
            </View>
            <Text style={styles.settingValue}>
              {isExporting || isCreatingBackup ? 'Processing...' : Platform.OS === 'ios' ? 'iCloud & File' : 'Backup'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleRecoverData} disabled={isRecovering}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="file-download" size={20} color="#34C759" />
              <Text style={styles.settingText}>Restore Data</Text>
            </View>
            <Text style={styles.settingValue}>
              {isRecovering ? 'Searching...' : Platform.OS === 'ios' && iCloudStatus !== 'unavailable' ? 'iCloud, Local & File' : 'Local & File'}
            </Text>
          </TouchableOpacity>
          
          {Platform.OS === 'ios' && iCloudStatus !== 'unavailable' && (
            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={handleManageiCloudBackups}
            >
              <View style={styles.settingLeft}>
                <FontAwesome name="cloud" size={20} color="#34C759" />
                <Text style={styles.settingText}>Manage iCloud Backups</Text>
              </View>
              <Text style={styles.settingValue}>
                {backupCount} backup{backupCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Exam Dates - Redesigned */}
        <View style={styles.examDatesContainer}>
          <View style={styles.examHeaderRow}>
            <FontAwesome name="calendar" size={20} color="#FF6B35" />
            <Text style={styles.examMainTitle}>EXAM DATES</Text>
          </View>
          
          <View style={styles.examCardsContainer}>
            {/* NEET PG Card */}
            <TouchableOpacity 
              style={[
                styles.examCard,
                examDates.NEET_PG ? styles.examCardSet : styles.examCardUnset
              ]} 
              onPress={() => {
                setTempNEETDate(examDates.NEET_PG ? new Date(examDates.NEET_PG) : new Date());
                setShowNEETPGPicker(true);
                Animated.timing(fadeAnim, {
                  toValue: 1,
                  duration: 300,
                  useNativeDriver: true,
                }).start();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.examCardHeader}>
                <View style={styles.examBadge}>
                  <Text style={styles.examBadgeText}>NEET PG</Text>
                </View>
                <MaterialIcons name="edit" size={14} color={examDates.NEET_PG ? "#007AFF" : "#FF6B35"} />
              </View>
              
              {examDates.NEET_PG ? (
                <>
                  <Text style={styles.examDateDisplay}>{formatDate(examDates.NEET_PG)}</Text>
                  <View style={styles.examCountdown}>
                    <MaterialIcons name="access-time" size={12} color="#666" />
                    <Text style={styles.examCountdownText}>
                      {Math.ceil((new Date(examDates.NEET_PG).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.examUnsetContent}>
                  <FontAwesome name="calendar" size={24} color="#FFB74D" />
                  <Text style={styles.examUnsetText}>Set date</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* INICET Card */}
            <TouchableOpacity 
              style={[
                styles.examCard,
                examDates.INICET ? styles.examCardSet : styles.examCardUnset
              ]} 
              onPress={() => {
                setTempINICETDate(examDates.INICET ? new Date(examDates.INICET) : new Date());
                setShowINICETPicker(true);
                Animated.timing(fadeAnim, {
                  toValue: 1,
                  duration: 300,
                  useNativeDriver: true,
                }).start();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.examCardHeader}>
                <View style={[styles.examBadge, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.examBadgeText, { color: '#2E7D32' }]}>INICET</Text>
                </View>
                <MaterialIcons name="edit" size={14} color={examDates.INICET ? "#007AFF" : "#FF6B35"} />
              </View>
              
              {examDates.INICET ? (
                <>
                  <Text style={styles.examDateDisplay}>{formatDate(examDates.INICET)}</Text>
                  <View style={styles.examCountdown}>
                    <MaterialIcons name="access-time" size={12} color="#666" />
                    <Text style={styles.examCountdownText}>
                      {Math.ceil((new Date(examDates.INICET).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.examUnsetContent}>
                  <FontAwesome name="calendar" size={24} color="#66BB6A" />
                  <Text style={styles.examUnsetText}>Set date</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* NEET PG Date Picker Modal */}
        <Modal
          visible={showNEETPGPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowNEETPGPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowNEETPGPicker(false)}
          >
            <Animated.View 
              style={[
                styles.modalContent,
                { opacity: fadeAnim }
              ]}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select NEET PG Date</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowNEETPGPicker(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={tempNEETDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    style={styles.modernDatePicker}
                    textColor="#000000"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setTempNEETDate(selectedDate);
                      }
                    }}
                  />
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowNEETPGPicker(false);
                      setTempNEETDate(null);
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalConfirmButton}
                    onPress={() => {
                      if (tempNEETDate) {
                        updateExamDates({
                          ...examDates,
                          NEET_PG: tempNEETDate.toISOString().split('T')[0]
                        });
                      }
                      setShowNEETPGPicker(false);
                      setTempNEETDate(null);
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.modalConfirmText}>Set Date</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* INICET Date Picker Modal */}
        <Modal
          visible={showINICETPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowINICETPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowINICETPicker(false)}
          >
            <Animated.View 
              style={[
                styles.modalContent,
                { opacity: fadeAnim }
              ]}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select INICET Date</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowINICETPicker(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={tempINICETDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    style={styles.modernDatePicker}
                    textColor="#000000"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setTempINICETDate(selectedDate);
                      }
                    }}
                  />
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowINICETPicker(false);
                      setTempINICETDate(null);
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalConfirmButton, { backgroundColor: '#2E7D32' }]}
                    onPress={() => {
                      if (tempINICETDate) {
                        updateExamDates({
                          ...examDates,
                          INICET: tempINICETDate.toISOString().split('T')[0]
                        });
                      }
                      setShowINICETPicker(false);
                      setTempINICETDate(null);
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.modalConfirmText}>Set Date</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* Study Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Goals</Text>
          
          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={() => {
              setTempTargetHours(dailyTargetHours.toString());
              setShowTargetHoursModal(true);
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }).start();
            }}
          >
            <View style={styles.settingLeft}>
              <FontAwesome name="bullseye" size={20} color="#FF6B35" />
              <Text style={styles.settingText}>Daily Target Hours</Text>
            </View>
            <Text style={styles.settingValue}>{dailyTargetHours}h</Text>
          </TouchableOpacity>
        </View>

        {/* Target Hours Modal */}
        <Modal
          visible={showTargetHoursModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowTargetHoursModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowTargetHoursModal(false)}
          >
            <Animated.View 
              style={[
                styles.modalContent,
                { opacity: fadeAnim }
              ]}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Set Daily Target</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowTargetHoursModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.targetHoursInputContainer}>
                  <Text style={styles.targetHoursLabel}>Target Hours per Day</Text>
                  <View style={styles.targetHoursInputWrapper}>
                    <TextInput
                      style={styles.targetHoursInput}
                      value={tempTargetHours}
                      onChangeText={setTempTargetHours}
                      keyboardType="numeric"
                      placeholder="4"
                      maxLength={2}
                      selectTextOnFocus
                    />
                    <Text style={styles.targetHoursUnit}>hours</Text>
                  </View>
                  <Text style={styles.targetHoursHint}>
                    Set a realistic daily study goal (1-12 hours recommended)
                  </Text>
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowTargetHoursModal(false);
                      setTempTargetHours(dailyTargetHours.toString());
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalConfirmButton, { backgroundColor: '#FF6B35' }]}
                    onPress={() => {
                      const hours = parseFloat(tempTargetHours);
                      if (hours > 0 && hours <= 24) {
                        updateDailyTargetHours(hours);
                        setShowTargetHoursModal(false);
                        Alert.alert('Success', `Daily target updated to ${hours} hours`);
                      } else {
                        Alert.alert('Invalid Input', 'Please enter a valid number between 1 and 24 hours.');
                      }
                    }}
                  >
                    <FontAwesome name="check" size={20} color="#FFF" />
                    <Text style={styles.modalConfirmText}>Set Target</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications" size={20} color="#007AFF" />
              <Text style={styles.settingText}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              {isDarkMode ? <Ionicons name="moon" size={20} color="#007AFF" /> : <Ionicons name="sunny" size={20} color="#007AFF" />}
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          
          <TouchableOpacity style={styles.dangerItem} onPress={handleClearAllData}>
            <View style={styles.settingLeft}>
              <FontAwesome name="trash" size={20} color="#FF3B30" />
              <Text style={[styles.settingText, { color: '#FF3B30' }]}>Clear All Data</Text>
            </View>
          </TouchableOpacity>
        </View>



        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="phone-portrait" size={20} color="#8E8E93" />
              <Text style={styles.settingText}>Version</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="shield" size={20} color="#8E8E93" />
              <Text style={styles.settingText}>Platform</Text>
            </View>
            <Text style={styles.settingValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
          </View>
        </View>
        
        {/* iCloud Backup Management Modal */}
        <Modal
          visible={showBackupList}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowBackupList(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowBackupList(false)}
          >
            <Animated.View style={styles.backupListModal}>
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>iCloud Backups</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowBackupList(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.backupListContainer}>
                  {availableBackups.length === 0 ? (
                    <View style={styles.noBackupsContainer}>
                      <FontAwesome name="cloud" size={48} color="#CCC" />
                      <Text style={styles.noBackupsText}>No backups found</Text>
                      <Text style={styles.noBackupsSubtext}>Create your first backup to get started</Text>
                    </View>
                  ) : (
                    availableBackups.map((backup, index) => (
                      <View key={backup.timestamp} style={styles.backupItem}>
                        <View style={styles.backupInfo}>
                          <Text style={styles.backupDate}>
                            {new Date(backup.timestamp).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                          <Text style={styles.backupDetails}>
                            {backup.metadata.totalSessions} sessions • {backup.metadata.totalTests} tests • {backup.metadata.totalStudyHours}h studied
                          </Text>
                          <Text style={styles.backupVersion}>Version {backup.version}</Text>
                        </View>
                        <View style={styles.backupActions}>
                          <TouchableOpacity 
                            style={styles.restoreButton}
                            onPress={() => {
                              setShowBackupList(false);
                              handleRestoreFromiCloudBackup(backup.timestamp);
                            }}
                          >
                            <FontAwesome name="download" size={16} color="#007AFF" />
                            <Text style={styles.restoreButtonText}>Restore</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.deleteButton}
                            onPress={() => handleDeleteBackup(backup.timestamp)}
                          >
                            <FontAwesome name="trash" size={16} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
                
                <View style={styles.backupListActions}>
                  <TouchableOpacity 
                    style={styles.createBackupButton}
                    onPress={async () => {
                      setShowBackupList(false);
                      await handleCreateiCloudBackup();
                    }}
                    disabled={isCreatingBackup}
                  >
                    <FontAwesome name="cloud" size={20} color="#FFF" />
                    <Text style={styles.createBackupButtonText}>
                      {isCreatingBackup ? 'Creating...' : 'Create New Backup'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountDetails: {
    marginLeft: 12,
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  accountEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  iCloudStatus: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  iCloudStatusText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 8,
  },
  lastBackupText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    marginLeft: 24,
  },
  settingItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 14,
    color: '#8E8E93',
  },
  dangerItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  loginSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 8,
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginPromptText: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 12,
    flex: 1,
  },
  appleSignInButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  appleSignInText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  googleSignInButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleSignInText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  examDatesContainer: {
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  examHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  examMainTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: 0.5,
  },
  examCardsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  examCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  examCardSet: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  examCardUnset: {
    backgroundColor: '#FFF8F3',
    borderWidth: 2,
    borderColor: '#FFB74D',
    borderStyle: 'dashed' as const,
  },
  examCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  examBadge: {
    backgroundColor: '#FFEBE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  examBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B35',
    letterSpacing: 0.3,
  },
  examDateDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  examCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  examCountdownText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  examUnsetContent: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  examUnsetText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalCloseButton: {
    padding: 4,
  },
  datePickerWrapper: {
    paddingVertical: 20,
    backgroundColor: '#FAFAFA',
  },
  modernDatePicker: {
    backgroundColor: 'transparent',
    height: 200,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  targetHoursInputContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  targetHoursLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  targetHoursInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  targetHoursInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
    minWidth: 60,
    marginRight: 8,
  },
  targetHoursUnit: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  targetHoursHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  backupListModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '95%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  backupListContainer: {
    maxHeight: 400,
    paddingHorizontal: 24,
  },
  noBackupsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  noBackupsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  noBackupsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backupInfo: {
    flex: 1,
  },
  backupDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  backupDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  backupVersion: {
    fontSize: 12,
    color: '#999',
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 4,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  backupListActions: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  createBackupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  createBackupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

});