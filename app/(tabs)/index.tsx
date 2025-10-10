
import React, { useCallback, useMemo, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudy } from '@/hooks/study-context';
import { useAdManager } from '@/hooks/ad-context';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AdBanner from '@/components/AdBanner';
import InterstitialAd from '@/components/InterstitialAd';
import { DataRecoveryService } from '@/utils/data-recovery';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen() {
  const { getTodayStats, getWeeklyStats, subjects, testScores, examDates, isLoading, refreshData, studySessions, todayProgress, dailyTargetHours } = useStudy();
  const { showBannerAds, interstitialAdVisible, hideInterstitialAd } = useAdManager();
  const insets = useSafeAreaInsets();
  const [isLinearView, setIsLinearView] = useState<boolean>(false);

  useEffect(() => {
    const loadViewPreference = async () => {
      try {
        const savedView = await AsyncStorage.getItem('dashboard_linear_view');
        if (savedView !== null) {
          setIsLinearView(JSON.parse(savedView));
        }
      } catch (error) {
        console.error('Error loading view preference:', error);
      }
    };
    loadViewPreference();
  }, []);

  const toggleView = useCallback(async () => {
    const newView = !isLinearView;
    setIsLinearView(newView);
    try {
      await AsyncStorage.setItem('dashboard_linear_view', JSON.stringify(newView));
    } catch (error) {
      console.error('Error saving view preference:', error);
    }
  }, [isLinearView]);

  useEffect(() => {
    const runEmergencyCleanup = async () => {
      try {
        const result = await DataRecoveryService.emergencyCleanupCorruption();
        if (result.cleaned > 0) {
          setTimeout(() => {
            refreshData();
          }, 500);
        }
      } catch (error) {
        console.error('Dashboard: Emergency cleanup failed:', error);
      }
    };
    runEmergencyCleanup();
  }, [refreshData]);

  const { daysUntilNEET, daysUntilINICET } = useMemo(() => {
    const calculateDaysUntil = (dateString: string) => {
      if (!dateString || dateString.trim() === '') {
        return null;
      }
      const examDate = new Date(dateString);
      if (isNaN(examDate.getTime())) {
        return null;
      }
      const today = new Date();
      const diffTime = examDate.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    return {
      daysUntilNEET: calculateDaysUntil(examDates.NEET_PG),
      daysUntilINICET: calculateDaysUntil(examDates.INICET)
    };
  }, [examDates.NEET_PG, examDates.INICET]);

  const todayStats = getTodayStats();
  const weeklyStats = getWeeklyStats();

  const totalWeekMinutes = useMemo(() => 
    weeklyStats.reduce((sum, day) => sum + day.totalMinutes, 0), 
    [weeklyStats]
  );

  const recentTests = useMemo(() => testScores.slice(-3).reverse(), [testScores]);

  const topSubjects = useMemo(() => {
    const subjectTotals = subjects.map(subject => {
      const totalMinutes = weeklyStats.reduce((sum, day) => {
        const subjectData = day.subjectBreakdown.find(s => s.subjectId === subject.id);
        return sum + (subjectData?.minutes || 0);
      }, 0);
      return { ...subject, totalMinutes };
    });
    return subjectTotals
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 3);
  }, [subjects, weeklyStats]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const dailyGoalMinutes = dailyTargetHours * 60;
  const progressPercentage = Math.min(100, Math.round((todayProgress.totalMinutes / dailyGoalMinutes) * 100));

  const renderLinearProgress = () => {
    return (
      <View style={[styles.card, styles.firstCard, styles.linearProgressCard]}>
        <View style={styles.linearProgressHeader}>
          <View style={styles.linearProgressTitleRow}>
            <Text style={styles.linearProgressTitle}>Today's Progress</Text>
            <TouchableOpacity onPress={toggleView} style={styles.viewToggle}>
              <Ionicons name="toggle" size={24} color={isLinearView ? "#4ECDC4" : "#8E8E93"} />
            </TouchableOpacity>
          </View>
          <View style={styles.linearProgressStats}>
            <Text style={styles.linearProgressTime}>
              {formatTime(todayProgress.totalMinutes)} / {formatTime(dailyGoalMinutes)}
            </Text>
            <View style={styles.linearProgressIcon}>
              <MaterialIcons name="access-time" size={24} color="#FFFFFF" />
            </View>
          </View>
        </View>
        <View style={styles.linearProgressBarContainer}>
          <View style={styles.linearProgressBarBackground}>
            <View 
              style={[
                styles.linearProgressBarFill,
                { width: `${progressPercentage}%` }
              ]}
            />
          </View>
        </View>
        <Text style={styles.linearProgressPercentage}>
          {progressPercentage}% complete • {dailyTargetHours}h target
        </Text>
      </View>
    );
  };

  const renderOriginalProgress = () => {
    return (
      <View style={[styles.card, styles.firstCard]}>
        <View style={styles.cardHeader}>
          <FontAwesome name="calendar" size={20} color="#4ECDC4" />
          <Text style={styles.cardTitle}>Today&apos;s Progress</Text>
          <TouchableOpacity onPress={toggleView} style={styles.viewToggle}>
            <Ionicons name="toggle" size={24} color={isLinearView ? "#4ECDC4" : "#8E8E93"} />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(todayProgress.totalMinutes)}</Text>
            <Text style={styles.statLabel}>Study Time</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{todayStats.subjectBreakdown.length}</Text>
            <Text style={styles.statLabel}>Subjects</Text>
          </View>
        </View>
        {todayStats.subjectBreakdown.length > 0 && (
          <View style={styles.subjectList}>
            {todayStats.subjectBreakdown.map(item => {
              const subject = subjects.find(s => s.id === item.subjectId);
              if (!subject) return null;
              return (
                <View key={item.subjectId} style={styles.subjectItem}>
                  <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <Text style={styles.subjectTime}>{formatTime(item.minutes)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <ScrollView 
        style={[styles.container, { paddingTop: insets.top }]} 
        showsVerticalScrollIndicator={false}
      >
      {/* Exam Countdown */}
      <View style={styles.countdownSection}>
        <View style={styles.countdownHeader}>
          <Text style={styles.countdownTitle}>Exam Countdown</Text>
          <TouchableOpacity 
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Ionicons name="settings" size={20} color="#4ECDC4" />
          </TouchableOpacity>
        </View>
        <View style={styles.countdownContainer}>
          <TouchableOpacity 
            style={styles.countdownCard}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.countdownLabel}>NEET PG</Text>
            <Text style={styles.countdownDays}>
              {daysUntilNEET !== null ? daysUntilNEET : 'NaN'}
            </Text>
            <Text style={styles.countdownText}>days left</Text>
            <Text style={styles.examDate}>
              {daysUntilNEET !== null && examDates.NEET_PG ? 
                new Date(examDates.NEET_PG).toLocaleDateString('en-IN', { 
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Invalid Date'
              }
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.countdownCard}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.countdownLabel}>INICET</Text>
            <Text style={styles.countdownDays}>
              {daysUntilINICET !== null ? daysUntilINICET : 'NaN'}
            </Text>
            <Text style={styles.countdownText}>days left</Text>
            <Text style={styles.examDate}>
              {daysUntilINICET !== null && examDates.INICET ? 
                new Date(examDates.INICET).toLocaleDateString('en-IN', { 
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Invalid Date'
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Progress */}
      {isLinearView ? renderLinearProgress() : renderOriginalProgress()}

      {/* Weekly Overview */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="access-time" size={20} color="#4ECDC4" />
          <Text style={styles.cardTitle}>This Week</Text>
        </View>
        <Text style={styles.weekTotal}>{formatTime(totalWeekMinutes)} total</Text>
        <View style={styles.weekChart}>
          {weeklyStats.map((day, index) => {
            const date = new Date(day.date);
            const dayName = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()];
            const height = Math.max(5, (day.totalMinutes / 360) * 100); // Max 6 hours
            return (
              <View key={day.date} style={styles.dayColumn}>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        height: `${height}%`,
                        backgroundColor: index === 6 ? '#4ECDC4' : '#B2E5E1',
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.dayLabel}>{dayName}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Top Subjects */}
      {topSubjects.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome name="book" size={20} color="#4ECDC4" />
            <Text style={styles.cardTitle}>Top Subjects This Week</Text>
          </View>
          {topSubjects.map((subject, index) => (
            <View key={subject.id} style={styles.topSubjectItem}>
              <Text style={styles.topSubjectRank}>{index + 1}</Text>
              <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
              <Text style={styles.topSubjectName}>{subject.name}</Text>
              <Text style={styles.topSubjectTime}>{formatTime(subject.totalMinutes)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent Tests */}
      {recentTests.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="trending-up" size={20} color="#4ECDC4" />
            <Text style={styles.cardTitle}>Recent Tests</Text>
          </View>
          {recentTests.map(test => (
            <TouchableOpacity 
              key={test.id} 
              style={styles.testItem}
              onPress={() => router.push('/tests')}
            >
              <View>
                <Text style={styles.testName}>{test.testName}</Text>
                <Text style={styles.testDate}>{new Date(test.date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.testScore}>
                <Text style={styles.testScoreText}>
                  {test.obtainedMarks}/{test.totalMarks}
                </Text>
                <Text style={styles.testPercentage}>
                  {Math.round((test.obtainedMarks / test.totalMarks) * 100)}%
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Banner Ad */}
      {showBannerAds && (
        <View style={styles.adContainer}>
          <AdBanner size="medium" />
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/timer')}
        >
          <Ionicons name="timer" size={24} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Start Study</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/add-test')}
        >
          <MaterialIcons name="bar-chart" size={24} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Add Test</Text>
        </TouchableOpacity>
      </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
      <InterstitialAd 
        visible={interstitialAdVisible}
        onClose={hideInterstitialAd}
      />
      <TouchableOpacity 
        style={[styles.fabButton, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push('/study-planner')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>📅</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  countdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  settingsButton: {
    padding: 4,
  },
  countdownContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  countdownCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  countdownDays: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  countdownText: {
    fontSize: 14,
    color: '#636366',
  },
  examDate: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
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
  firstCard: {
    marginTop: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  viewToggle: {
    marginLeft: 'auto',
    padding: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  subjectList: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  subjectName: {
    flex: 1,
    fontSize: 14,
    color: '#636366',
  },
  subjectTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  weekTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  weekChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    flex: 1,
    width: '80%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  dayLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
  },
  topSubjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  topSubjectRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    width: 24,
  },
  topSubjectName: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 8,
  },
  topSubjectTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#636366',
  },
  testItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  testName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  testDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  testScore: {
    alignItems: 'flex-end',
  },
  testScoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  testPercentage: {
    fontSize: 12,
    color: '#4ECDC4',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
  adContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  calendarIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    position: 'relative',
  },
  calendarHeader: {
    height: 6,
    backgroundColor: '#FF4757',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  calendarBody: {
    flex: 1,
    padding: 3,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%',
  },
  calendarDot: {
    width: 3,
    height: 3,
    backgroundColor: '#C7C7CC',
    borderRadius: 1.5,
    margin: 0.5,
  },
  calendarDotActive: {
    backgroundColor: '#FF4757',
  },
  checkmarkContainer: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 16,
    height: 16,
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 5,
    height: 2.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    marginTop: -0.5,
  },
  linearProgressCard: {
    backgroundColor: '#5A67D8',
    paddingVertical: 16,
  },
  linearProgressHeader: {
    marginBottom: 12,
  },
  linearProgressTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  linearProgressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  linearProgressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linearProgressTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  linearProgressIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linearProgressBarContainer: {
    marginBottom: 10,
  },
  linearProgressBarBackground: {
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  linearProgressBarFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  linearProgressSegments: {
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: 3,
    paddingVertical: 3,
    gap: 1.5,
  },
  linearProgressSegment: {
    flex: 1,
    height: '100%',
    borderRadius: 6,
  },
  linearProgressPercentage: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'left',
  },
});
