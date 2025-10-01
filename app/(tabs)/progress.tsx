import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useStudy } from '@/hooks/study-context';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ProgressScreen() {
  const { subjects, studySessions, testScores, getSubjectPerformance, getOverallProgress, isLoading, debugStoredData, forceInitializeSubjects } = useStudy();


  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [sessionHistoryLimit, setSessionHistoryLimit] = useState(10);

  const calculateSubjectStats = useCallback((subjectId: string) => {
    const subjectSessions = studySessions.filter(s => s.subjectId === subjectId);
    // Only count work sessions, not breaks
    const workSessions = subjectSessions.filter(s => !s.notes?.toLowerCase().includes('break'));
    const totalMinutes = workSessions.reduce((sum, s) => sum + s.duration, 0);
    const performance = getSubjectPerformance(subjectId);
    const avgPerformance = performance.length > 0
      ? performance.reduce((sum, p) => sum + p.percentage, 0) / performance.length
      : 0;
    
    return {
      totalHours: totalMinutes / 60,
      sessionCount: workSessions.length,
      avgPerformance: Math.round(avgPerformance),
      recentTests: performance.slice(-3),
    };
  }, [studySessions, getSubjectPerformance]);

  const overallStats = useMemo(() => {
    // Only count work sessions for study time, not breaks
    const workSessions = studySessions.filter(s => !s.notes?.toLowerCase().includes('break'));
    const totalMinutes = workSessions.reduce((sum, s) => sum + s.duration, 0);
    const avgScore = testScores.length > 0
      ? Math.round(testScores.reduce((sum, t) => sum + (t.obtainedMarks / t.totalMarks) * 100, 0) / testScores.length)
      : 0;
    
    return {
      totalHours: totalMinutes / 60,
      totalSessions: workSessions.length,
      totalTests: testScores.length,
      avgScore,
    };
  }, [studySessions, testScores]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overall Stats */}
      <TouchableOpacity 
        style={styles.overallCard}
        onPress={() => setShowSessionHistory(!showSessionHistory)}
        activeOpacity={0.7}
      >
        <View style={styles.overallHeader}>
          <Text style={styles.overallTitle}>Overall Progress</Text>
          <Text style={styles.tapHint}>Tap to view session history</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <MaterialIcons name="access-time" size={24} color="#4ECDC4" />
            <Text style={styles.statValue}>{overallStats.totalHours.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>Total Study</Text>
          </View>
          <View style={styles.statItem}>
            <FontAwesome name="calendar" size={24} color="#4ECDC4" />
            <Text style={styles.statValue}>{overallStats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <FontAwesome name="bullseye" size={24} color="#4ECDC4" />
            <Text style={styles.statValue}>{overallStats.totalTests}</Text>
            <Text style={styles.statLabel}>Tests</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="trending-up" size={24} color="#4ECDC4" />
            <Text style={styles.statValue}>{overallStats.avgScore}%</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Debug Info */}
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>Sessions: {studySessions.length} | Subjects: {subjects.length} | Loading: {isLoading ? 'Yes' : 'No'}</Text>
        <View style={styles.debugButtons}>
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={debugStoredData}
          >
            <Text style={styles.debugButtonText}>Debug Storage</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.debugButton, styles.recoveryButton]}
            onPress={forceInitializeSubjects}
          >
            <Text style={styles.debugButtonText}>Force Init Subjects</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/study-planner')}
        >
          <FontAwesome name="bullseye" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Study Planner</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/session-history')}
        >
          <FontAwesome name="history" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Session History</Text>
        </TouchableOpacity>
      </View>



      {/* Session History */}
      {showSessionHistory && (
        <View style={styles.sessionHistorySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => setShowSessionHistory(false)}>
              <Ionicons name="chevron-up" size={24} color="#8A95A6" />
            </TouchableOpacity>
          </View>
          
          {studySessions.length === 0 ? (
            <Text style={styles.noSessionsText}>No study sessions yet</Text>
          ) : (
            <>
              {studySessions
                .slice()
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .slice(0, sessionHistoryLimit)
                .map((session, index) => {
                  const subject = subjects.find(s => s.id === session.subjectId);
                  const sessionDate = new Date(session.startTime);
                  const currentYear = new Date().getFullYear();
                  const dateStr = sessionDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: sessionDate.getFullYear() !== currentYear ? 'numeric' : undefined
                  });
                  const timeStr = sessionDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  });
                  
                  // Parse notes to check if it's a break or work session
                  const isBreak = session.notes?.toLowerCase().includes('break');
                  
                  // Debug logging for subject matching
                  if (!subject) {
                    console.log('Progress - Session subject not found:', {
                      sessionSubjectId: session.subjectId,
                      availableSubjects: subjects.map(s => ({ id: s.id, name: s.name })),
                      sessionId: session.id
                    });
                  }
                  
                  return (
                    <View key={session.id} style={styles.sessionItem}>
                      <View style={styles.sessionLeft}>
                        <View style={[styles.sessionDot, { backgroundColor: subject?.color || '#4ECDC4' }]} />
                        <View style={styles.sessionInfo}>
                          <Text style={styles.sessionSubject}>{subject?.name || `Unknown (${session.subjectId})`}</Text>
                          <Text style={styles.sessionDateTime}>{dateStr} at {timeStr}</Text>
                          {session.notes && (
                            <Text style={styles.sessionNotes} numberOfLines={1}>{session.notes}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.sessionRight}>
                        <Text style={[styles.sessionDuration, isBreak && styles.breakDuration]}>
                          {session.duration} min
                        </Text>
                        {isBreak && <Text style={styles.breakLabel}>Break</Text>}
                      </View>
                    </View>
                  );
                })}
              
              {studySessions.length > sessionHistoryLimit && (
                <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={() => setSessionHistoryLimit(prev => prev + 10)}
                >
                  <Text style={styles.loadMoreText}>Load More Sessions</Text>
                  <Ionicons name="chevron-down" size={16} color="#4ECDC4" />
                </TouchableOpacity>
              )}
              
              {/* Session Summary */}
              <View style={styles.sessionSummary}>
                <Text style={styles.summaryTitle}>Session Summary</Text>
                <View style={styles.summaryStats}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Sessions</Text>
                    <Text style={styles.summaryValue}>{studySessions.length}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Study Time</Text>
                    <Text style={styles.summaryValue}>
                      {Math.floor(studySessions.reduce((sum, s) => {
                        // Only count work sessions, not breaks
                        const isBreak = s.notes?.toLowerCase().includes('break');
                        return sum + (isBreak ? 0 : s.duration);
                      }, 0) / 60)}h {studySessions.reduce((sum, s) => {
                        const isBreak = s.notes?.toLowerCase().includes('break');
                        return sum + (isBreak ? 0 : s.duration);
                      }, 0) % 60}m
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Avg Session</Text>
                    <Text style={styles.summaryValue}>
                      {studySessions.length > 0 
                        ? Math.round(studySessions.reduce((sum, s) => {
                            const isBreak = s.notes?.toLowerCase().includes('break');
                            return sum + (isBreak ? 0 : s.duration);
                          }, 0) / studySessions.filter(s => !s.notes?.toLowerCase().includes('break')).length)
                        : 0} min
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* Subject Progress */}
      <View style={styles.subjectsSection}>
        <Text style={styles.sectionTitle}>Subject Progress</Text>
        {subjects.length === 0 ? (
          <View style={styles.noSubjectsContainer}>
            <Text style={styles.noSubjectsText}>No subjects found</Text>
            <Text style={styles.noSubjectsHint}>Subjects will be initialized automatically</Text>
            <TouchableOpacity 
              style={styles.initializeButton}
              onPress={forceInitializeSubjects}
            >
              <Text style={styles.initializeButtonText}>Initialize Subjects</Text>
            </TouchableOpacity>
          </View>
        ) : (
          subjects.map(subject => {
            const stats = calculateSubjectStats(subject.id);
            const isSelected = selectedSubject === subject.id;
            const progressData = getOverallProgress(subject.id);
            
            // Debug logging for progress calculation
            console.log(`Progress for ${subject.name}:`, {
              subjectId: subject.id,
              completedHours: subject.completedHours,
              targetHours: subject.targetHours,
              sessionCount: stats.sessionCount,
              totalHours: stats.totalHours,
              progressData
            });

            return (
              <TouchableOpacity
                key={subject.id}
                style={styles.subjectCard}
                onPress={() => setSelectedSubject(isSelected ? null : subject.id)}
              >
                <View style={styles.subjectHeader}>
                  <View style={styles.subjectInfo}>
                    <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                    <Text style={styles.subjectName}>{subject.name}</Text>
                  </View>
                  <View style={styles.subjectStats}>
                    <Text style={styles.subjectHours}>
                      {stats.totalHours.toFixed(1)}h / {subject.targetHours}h
                    </Text>
                    {subject.averageMarks !== undefined && (
                      <Text style={[
                        styles.subjectMarks,
                        { color: subject.averageMarks >= 60 ? '#4ECDC4' : '#FF6B6B' }
                      ]}>
                        {subject.averageMarks.toFixed(1)}%
                      </Text>
                    )}
                  </View>
                </View>

                {/* Combined Progress Bar */}
                <View style={styles.progressSection}>
                  <Text style={styles.progressLabel}>Overall Progress</Text>
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBg}>
                      <View 
                        style={[
                          styles.progressBar,
                          { 
                            width: `${progressData.overallProgress}%`,
                            backgroundColor: subject.color,
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>{progressData.overallProgress}%</Text>
                  </View>
                </View>

                {/* Separate Progress Indicators */}
                <View style={styles.progressBreakdown}>
                  <View style={styles.progressItem}>
                    <MaterialIcons name="access-time" size={14} color="#8E8E93" />
                    <Text style={styles.progressItemLabel}>Hours</Text>
                    <Text style={styles.progressItemValue}>{progressData.hoursProgress}%</Text>
                  </View>
                  {progressData.marksProgress > 0 && (
                    <View style={styles.progressItem}>
                      <FontAwesome name="bullseye" size={14} color="#8E8E93" />
                      <Text style={styles.progressItemLabel}>Marks</Text>
                      <Text style={[
                        styles.progressItemValue,
                        { color: progressData.marksProgress >= 60 ? '#4ECDC4' : '#FF6B6B' }
                      ]}>
                        {progressData.marksProgress}%
                      </Text>
                    </View>
                  )}
                </View>

                {isSelected && (
                  <View style={styles.subjectDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sessions:</Text>
                      <Text style={styles.detailValue}>{stats.sessionCount}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Avg Performance:</Text>
                      <Text style={[
                        styles.detailValue,
                        { color: stats.avgPerformance >= 60 ? '#4ECDC4' : '#FF6B6B' }
                      ]}>
                        {stats.avgPerformance}%
                      </Text>
                    </View>
                    {stats.recentTests.length > 0 && (
                      <>
                        <Text style={styles.recentTestsTitle}>Recent Tests</Text>
                        {stats.recentTests.map((test, index) => (
                          <View key={index} style={styles.recentTest}>
                            <Text style={styles.recentTestName}>{test.testName}</Text>
                            <Text style={[
                              styles.recentTestScore,
                              { color: test.percentage >= 60 ? '#4ECDC4' : '#FF6B6B' }
                            ]}>
                              {Math.round(test.percentage)}%
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
  },
  overallCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  overallHeader: {
    marginBottom: 16,
  },
  tapHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontStyle: 'italic',
  },
  overallTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    width: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  plannerButton: {
    backgroundColor: '#4ECDC4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  plannerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subjectsSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  subjectStats: {
    alignItems: 'flex-end',
  },
  subjectHours: {
    fontSize: 12,
    color: '#8E8E93',
  },
  subjectMarks: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressBreakdown: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  progressItemLabel: {
    fontSize: 11,
    color: '#8E8E93',
  },
  progressItemValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },

  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636366',
    width: 35,
    textAlign: 'right',
  },
  subjectDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  recentTestsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    marginTop: 8,
    marginBottom: 8,
  },
  recentTest: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recentTestName: {
    fontSize: 12,
    color: '#8E8E93',
  },
  recentTestScore: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
  debugButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  debugButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  recoveryButton: {
    backgroundColor: '#4ECDC4',
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  dataStatus: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  dataStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  dataStatusText: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionHistorySection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  noSessionsText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionSubject: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  sessionDateTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  sessionNotes: {
    fontSize: 11,
    color: '#636366',
    fontStyle: 'italic',
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  sessionDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  breakDuration: {
    color: '#8E8E93',
  },
  breakLabel: {
    fontSize: 10,
    color: '#FFA500',
    fontWeight: '500',
    marginTop: 2,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 4,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  sessionSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636366',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  debugInfo: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  debugText: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 8,
  },
  noSubjectsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  noSubjectsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  noSubjectsHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  initializeButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  initializeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});