import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useStudy } from '@/hooks/study-context';
import { StudySession } from '@/types/study';

export default function SessionHistoryScreen() {
  const router = useRouter();
  const { studySessions, deleteSession, deleteSessions, subjects } = useStudy();
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: Record<string, StudySession[]> = {};
    
    studySessions.forEach((session: StudySession) => {
      const date = new Date(session.startTime);
      const dateKey = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(session);
    });
    
    // Sort dates in descending order
    const sortedDates = Object.keys(groups).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    
    return sortedDates.map(date => ({
      date,
      sessions: groups[date].sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      )
    }));
  }, [studySessions]);

  const toggleSelection = (sessionId: string) => {
    const newSelection = new Set(selectedSessions);
    if (newSelection.has(sessionId)) {
      newSelection.delete(sessionId);
    } else {
      newSelection.add(sessionId);
    }
    setSelectedSessions(newSelection);
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedSessions(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const selectAll = () => {
    const allIds = new Set(studySessions.map((s: StudySession) => s.id));
    setSelectedSessions(allIds);
  };

  const deselectAll = () => {
    setSelectedSessions(new Set());
  };

  const handleDelete = () => {
    if (selectedSessions.size === 0) return;

    Alert.alert(
      'Delete Sessions',
      `Are you sure you want to delete ${selectedSessions.size} session${selectedSessions.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSessions(Array.from(selectedSessions));
            setSelectedSessions(new Set());
            setIsSelectionMode(false);
          }
        }
      ]
    );
  };

  const handleSingleDelete = (sessionId: string) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSession(sessionId)
        }
      ]
    );
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getTotalStats = () => {
    const totalMinutes = studySessions.reduce((sum: number, s: StudySession) => sum + s.duration, 0);
    const totalSessions = studySessions.length;
    const avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
    
    return { totalMinutes, totalSessions, avgDuration };
  };

  const stats = getTotalStats();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen 
        options={{ 
          title: 'Session History',
          headerRight: () => (
            <View style={styles.headerButtons}>
              {isSelectionMode && selectedSessions.size > 0 && (
                <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                  <FontAwesome name="trash" size={24} color="#FF3B30" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={toggleSelectionMode} style={styles.headerButton}>
                <Text style={[styles.selectText, isSelectionMode && styles.selectTextActive]}>
                  {isSelectionMode ? 'Done' : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }} 
      />

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="time" size={20} color="#4ECDC4" />
          <Text style={styles.statValue}>{formatDuration(stats.totalMinutes)}</Text>
          <Text style={styles.statLabel}>Total Time</Text>
        </View>
        <View style={styles.statCard}>
          <FontAwesome name="bullseye" size={20} color="#4ECDC4" />
          <Text style={styles.statValue}>{stats.totalSessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar" size={20} color="#4ECDC4" />
          <Text style={styles.statValue}>{formatDuration(stats.avgDuration)}</Text>
          <Text style={styles.statLabel}>Avg Duration</Text>
        </View>
      </View>

      {/* Selection Controls */}
      {isSelectionMode && (
        <View style={styles.selectionControls}>
          <TouchableOpacity onPress={selectAll} style={styles.selectionButton}>
            <Text style={styles.selectionButtonText}>Select All</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCount}>
            {selectedSessions.size} selected
          </Text>
          <TouchableOpacity onPress={deselectAll} style={styles.selectionButton}>
            <Text style={styles.selectionButtonText}>Deselect All</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {groupedSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No study sessions yet</Text>
            <Text style={styles.emptySubtext}>Start a timer to track your study time</Text>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => router.push('/(tabs)/timer')}
            >
              <Text style={styles.startButtonText}>Start Timer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groupedSessions.map(group => (
            <View key={group.date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{group.date}</Text>
              {group.sessions.map((session: StudySession) => (
                <TouchableOpacity
                  key={session.id}
                  style={[
                    styles.sessionCard,
                    selectedSessions.has(session.id) && styles.sessionCardSelected
                  ]}
                  onPress={() => {
                    if (isSelectionMode) {
                      toggleSelection(session.id);
                    }
                  }}
                  onLongPress={() => {
                    if (!isSelectionMode) {
                      setIsSelectionMode(true);
                      toggleSelection(session.id);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {isSelectionMode && (
                    <View style={styles.checkbox}>
                      {selectedSessions.has(session.id) ? (
                        <FontAwesome name="check-square" size={24} color="#4ECDC4" />
                      ) : (
                        <FontAwesome name="square-o" size={24} color="#C7C7CC" />
                      )}
                    </View>
                  )}
                  
                  <View style={styles.sessionContent}>
                    <View style={styles.sessionHeader}>
                      <Text style={styles.subjectName}>
                        {session.subjectName || subjects.find(s => s.id === session.subjectId)?.name || 'Unknown Subject'}
                      </Text>
                      <Text style={styles.duration}>{formatDuration(session.duration)}</Text>
                    </View>
                    
                    <View style={styles.sessionDetails}>
                      <Text style={styles.sessionTime}>
                        {formatTime(new Date(session.startTime))} - {formatTime(new Date(session.endTime))}
                      </Text>
                    </View>
                    
                    {session.notes && (
                      <Text style={styles.notes} numberOfLines={2}>{session.notes}</Text>
                    )}
                  </View>

                  {!isSelectionMode && (
                    <TouchableOpacity
                      onPress={() => handleSingleDelete(session.id)}
                      style={styles.deleteButton}
                    >
                      <FontAwesome name="trash" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  selectText: {
    fontSize: 17,
    color: '#007AFF',
  },
  selectTextActive: {
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  selectionButton: {
    padding: 8,
  },
  selectionButtonText: {
    color: '#007AFF',
    fontSize: 15,
  },
  selectionCount: {
    fontSize: 15,
    color: '#8E8E93',
  },
  scrollView: {
    flex: 1,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionCardSelected: {
    backgroundColor: '#F0FFFE',
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  checkbox: {
    marginRight: 12,
  },
  sessionContent: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  duration: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  sessionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  technique: {
    fontSize: 12,
    color: '#4ECDC4',
    backgroundColor: '#F0FFFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  notes: {
    fontSize: 14,
    color: '#6E6E73',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});