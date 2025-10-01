import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useStudy } from '@/hooks/study-context';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function TestsScreen() {
  const { testScores, subjects, deleteTestScore, isLoading } = useStudy();
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const handleDeleteTest = (testId: string, testName: string) => {
    Alert.alert(
      'Delete Test',
      `Are you sure you want to delete "${testName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteTestScore(testId),
        },
      ]
    );
  };

  const getPerformanceTrend = (subjectId: string) => {
    const subjectTests = testScores
      .filter(test => test.subjectScores.some(s => s.subjectId === subjectId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-2);

    if (subjectTests.length < 2) return null;

    const prevScore = subjectTests[0].subjectScores.find(s => s.subjectId === subjectId)?.percentage || 0;
    const currScore = subjectTests[1].subjectScores.find(s => s.subjectId === subjectId)?.percentage || 0;

    return currScore - prevScore;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  const sortedTests = [...testScores].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Add Test Button */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => router.push('/add-test')}
      >
  <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Add Test Score</Text>
      </TouchableOpacity>

      {/* Test List */}
      {sortedTests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No test scores yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Add your first test score to track your progress
          </Text>
        </View>
      ) : (
        sortedTests.map(test => {
          const isExpanded = expandedTest === test.id;
          const percentage = Math.round((test.obtainedMarks / test.totalMarks) * 100);
          
          return (
            <View key={test.id} style={styles.testCard}>
              <TouchableOpacity 
                style={styles.testHeader}
                onPress={() => setExpandedTest(isExpanded ? null : test.id)}
              >
                <View style={styles.testInfo}>
                  <Text style={styles.testName}>{test.testName}</Text>
                  <View style={styles.testMeta}>
                    <Text style={styles.testType}>{test.testType}</Text>
                    <Text style={styles.testDate}>
                      {new Date(test.date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.testScoreContainer}>
                  <Text style={styles.testScore}>
                    {test.obtainedMarks}/{test.totalMarks}
                  </Text>
                  <View style={[
                    styles.percentageBadge,
                    { backgroundColor: percentage >= 60 ? '#4ECDC4' : '#FF6B6B' }
                  ]}>
                    <Text style={styles.percentageText}>{percentage}%</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.testDetails}>
                  <Text style={styles.detailsTitle}>Subject-wise Performance</Text>
                  {test.subjectScores.map(score => {
                    const subject = subjects.find(s => s.id === score.subjectId);
                    if (!subject) return null;
                    
                    const trend = getPerformanceTrend(score.subjectId);
                    
                    return (
                      <View key={score.subjectId} style={styles.subjectScore}>
                        <View style={styles.subjectScoreLeft}>
                          <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                          <Text style={styles.subjectName}>{subject.name}</Text>
                          {trend !== null && (
                            trend > 0 ? (
                              <MaterialIcons name="trending-up" size={16} color="#4ECDC4" />
                            ) : trend < 0 ? (
                              <MaterialIcons name="trending-down" size={16} color="#FF6B6B" />
                            ) : null
                          )}
                        </View>
                        <View style={styles.subjectScoreRight}>
                          <Text style={styles.subjectScoreText}>
                            {score.correctAnswers}/{score.totalQuestions}
                          </Text>
                          <Text style={[
                            styles.subjectPercentage,
                            { color: score.percentage >= 60 ? '#4ECDC4' : '#FF6B6B' }
                          ]}>
                            {Math.round(score.percentage)}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDeleteTest(test.id, test.testName)}
                  >
                    <FontAwesome name="trash" size={18} color="#FF6B6B" />
                    <Text style={styles.deleteButtonText}>Delete Test</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}

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
  addButton: {
    backgroundColor: '#4ECDC4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  testCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  testMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  testType: {
    fontSize: 12,
    color: '#FFFFFF',
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  testDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  testScoreContainer: {
    alignItems: 'flex-end',
  },
  testScore: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  percentageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  testDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    padding: 16,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636366',
    marginBottom: 12,
  },
  subjectScore: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectScoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectName: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
  },
  subjectScoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subjectScoreText: {
    fontSize: 14,
    color: '#636366',
  },
  subjectPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 8,
    gap: 8,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  bottomPadding: {
    height: 20,
  },
});