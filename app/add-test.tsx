import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useStudy } from '@/hooks/study-context';
import { router } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { TestScore, SubjectScore } from '@/types/study';

export default function AddTestScreen() {
  const { subjects, addTestScore } = useStudy();
  const [testName, setTestName] = useState('');
  const [testType, setTestType] = useState<'INICET' | 'NEET' | 'Mock'>('Mock');
  const [totalMarks, setTotalMarks] = useState('');
  const [obtainedMarks, setObtainedMarks] = useState('');
  const [subjectScores, setSubjectScores] = useState<Record<string, {
    totalQuestions: string;
    correctAnswers: string;
  }>>({});

  const handleSave = async () => {
    if (!testName || !totalMarks || !obtainedMarks) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const total = parseInt(totalMarks);
    const obtained = parseInt(obtainedMarks);

    if (isNaN(total) || isNaN(obtained) || obtained > total) {
      Alert.alert('Invalid Marks', 'Please enter valid marks.');
      return;
    }

    const subjectScoresList: SubjectScore[] = [];
    
    for (const [subjectId, scores] of Object.entries(subjectScores)) {
      const totalQ = parseInt(scores.totalQuestions);
      const correctA = parseInt(scores.correctAnswers);
      
      if (!isNaN(totalQ) && !isNaN(correctA) && totalQ > 0) {
        subjectScoresList.push({
          subjectId,
          totalQuestions: totalQ,
          correctAnswers: correctA,
          percentage: (correctA / totalQ) * 100,
        });
      }
    }

    const newTest: Omit<TestScore, 'id'> = {
      testName,
      testType,
      date: new Date().toISOString(),
      totalMarks: total,
      obtainedMarks: obtained,
      subjectScores: subjectScoresList,
    };

    await addTestScore(newTest);
    Alert.alert('Success', 'Test score added successfully!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const updateSubjectScore = (subjectId: string, field: 'totalQuestions' | 'correctAnswers', value: string) => {
    setSubjectScores(prev => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        [field]: value,
      }
    }));
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Test Score</Text>
        <Text style={styles.sectionSubtext}>
          Choose how you&apos;d like to add your test results
        </Text>
        
        <TouchableOpacity 
          style={styles.screenshotButton}
          onPress={() => router.push('/add-test-screenshot')}
        >
          <Ionicons name="camera" size={20} color="#4ECDC4" />
          <Text style={styles.screenshotButtonText}>Add via Screenshot</Text>
          <Text style={styles.screenshotSubtext}>AI will extract scores automatically</Text>
        </TouchableOpacity>
        
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Entry</Text>
        
        <Text style={styles.label}>Test Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., NEET PG Mock Test 1"
          value={testName}
          onChangeText={setTestName}
        />

        <Text style={styles.label}>Test Type *</Text>
        <View style={styles.typeButtons}>
          {(['INICET', 'NEET', 'Mock'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.typeButton, testType === type && styles.selectedType]}
              onPress={() => setTestType(type)}
            >
              <Text style={[styles.typeButtonText, testType === type && styles.selectedTypeText]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.marksRow}>
          <View style={styles.marksInput}>
            <Text style={styles.label}>Obtained Marks *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={obtainedMarks}
              onChangeText={setObtainedMarks}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.marksInput}>
            <Text style={styles.label}>Total Marks *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={totalMarks}
              onChangeText={setTotalMarks}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {/* Subject-wise Scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subject-wise Performance (Optional)</Text>
        <Text style={styles.sectionSubtext}>
          Add subject scores to track your performance in each area
        </Text>

        {subjects.map(subject => (
          <View key={subject.id} style={styles.subjectRow}>
            <View style={styles.subjectHeader}>
              <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
              <Text style={styles.subjectName}>{subject.name}</Text>
            </View>
            <View style={styles.subjectInputs}>
              <TextInput
                style={styles.smallInput}
                placeholder="Correct"
                value={subjectScores[subject.id]?.correctAnswers || ''}
                onChangeText={(value) => updateSubjectScore(subject.id, 'correctAnswers', value)}
                keyboardType="numeric"
              />
              <Text style={styles.separator}>/</Text>
              <TextInput
                style={styles.smallInput}
                placeholder="Total"
                value={subjectScores[subject.id]?.totalQuestions || ''}
                onChangeText={(value) => updateSubjectScore(subject.id, 'totalQuestions', value)}
                keyboardType="numeric"
              />
            </View>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color="#8E8E93" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.saveButton]}
          onPress={handleSave}
        >
          <FontAwesome name="save" size={20} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
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
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#636366',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  selectedType: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#636366',
  },
  selectedTypeText: {
    color: '#FFFFFF',
  },
  marksRow: {
    flexDirection: 'row',
    gap: 12,
  },
  marksInput: {
    flex: 1,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  subjectName: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  subjectInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smallInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: '#1C1C1E',
    width: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  separator: {
    fontSize: 16,
    color: '#8E8E93',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4ECDC4',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
  screenshotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#4ECDC4',
    borderStyle: 'dashed',
    gap: 12,
    marginBottom: 16,
  },
  screenshotButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  screenshotSubtext: {
    position: 'absolute',
    right: 16,
    fontSize: 12,
    color: '#8E8E93',
    top: 32,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
});