import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useStudy } from '@/hooks/study-context';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { TestScore, SubjectScore } from '@/types/study';
import * as ImagePicker from 'expo-image-picker';

interface ExtractedTestData {
  testName?: string;
  testType?: 'INICET' | 'NEET' | 'Mock';
  totalMarks?: number;
  obtainedMarks?: number;
  subjectScores?: {
    subjectName: string;
    correctAnswers: number;
    totalQuestions: number;
    percentage: number;
  }[];
}

export default function AddTestScreenshotScreen() {
  const { subjects, addTestScore } = useStudy();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedTestData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets) {
        const imageUris = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...imageUris]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedImages(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeImages = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images', 'Please select at least one image to analyze.');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Convert images to base64 for API
      const imagePromises = selectedImages.map(async (uri) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });
      });

      const base64Images = await Promise.all(imagePromises);
      
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: `Analyze these test result images and extract the following information in JSON format:
{
  "testName": "string (if visible)",
  "testType": "INICET" | "NEET" | "Mock" (guess based on content),
  "totalMarks": number,
  "obtainedMarks": number,
  "subjectScores": [
    {
      "subjectName": "string",
      "correctAnswers": number,
      "totalQuestions": number,
      "percentage": number
    }
  ]
}

Look for:
- Test name/title
- Total marks and obtained marks
- Subject-wise breakdown (Anatomy, Physiology, Pathology, Pharmacology, etc.)
- Correct answers and total questions per subject
- Percentages

If some information is not visible, omit those fields. Focus on extracting accurate numerical data.`
            },
            ...base64Images.map(base64 => ({
              type: 'image' as const,
              image: base64
            }))
          ]
        }
      ];

      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze images');
      }

      const result = await response.json();
      const extractedText = result.completion;
      
      // Try to parse JSON from the response
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        setExtractedData(parsedData);
        setIsEditing(true);
      } else {
        throw new Error('Could not extract structured data from images');
      }
    } catch (error) {
      console.error('Error analyzing images:', error);
      Alert.alert('Analysis Failed', 'Could not extract test data from images. Please try again or add the test manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveExtractedTest = async () => {
    if (!extractedData) return;

    try {
      // Map extracted subject scores to our subject IDs
      const subjectScoresList: SubjectScore[] = [];
      
      if (extractedData.subjectScores) {
        for (const extractedScore of extractedData.subjectScores) {
          // Try to find matching subject by name (case insensitive)
          const matchingSubject = subjects.find(subject => 
            subject.name.toLowerCase().includes(extractedScore.subjectName.toLowerCase()) ||
            extractedScore.subjectName.toLowerCase().includes(subject.name.toLowerCase())
          );
          
          if (matchingSubject) {
            subjectScoresList.push({
              subjectId: matchingSubject.id,
              totalQuestions: extractedScore.totalQuestions,
              correctAnswers: extractedScore.correctAnswers,
              percentage: extractedScore.percentage,
            });
          }
        }
      }

      const newTest: Omit<TestScore, 'id'> = {
        testName: extractedData.testName || 'Imported Test',
        testType: extractedData.testType || 'Mock',
        date: new Date().toISOString(),
        totalMarks: extractedData.totalMarks || 0,
        obtainedMarks: extractedData.obtainedMarks || 0,
        subjectScores: subjectScoresList,
      };

      await addTestScore(newTest);
      Alert.alert('Success', 'Test score imported successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving test:', error);
      Alert.alert('Error', 'Failed to save test score. Please try again.');
    }
  };

  if (isEditing && extractedData) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Extracted Test Data</Text>
          <Text style={styles.sectionSubtext}>
            Review and confirm the extracted information
          </Text>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Test Name:</Text>
            <Text style={styles.dataValue}>{extractedData.testName || 'Not detected'}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Test Type:</Text>
            <Text style={styles.dataValue}>{extractedData.testType || 'Mock'}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Marks:</Text>
            <Text style={styles.dataValue}>
              {extractedData.obtainedMarks || 0} / {extractedData.totalMarks || 0}
            </Text>
          </View>

          {extractedData.subjectScores && extractedData.subjectScores.length > 0 && (
            <View style={styles.subjectScoresSection}>
              <Text style={styles.subSectionTitle}>Subject Scores:</Text>
              {extractedData.subjectScores.map((score, index) => (
                <View key={index} style={styles.subjectScoreRow}>
                  <Text style={styles.subjectScoreName}>{score.subjectName}</Text>
                  <Text style={styles.subjectScoreValue}>
                    {score.correctAnswers}/{score.totalQuestions} ({score.percentage.toFixed(1)}%)
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => setIsEditing(false)}
          >
            <Ionicons name="close" size={20} color="#8E8E93" />
            <Text style={styles.cancelButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton]}
            onPress={saveExtractedTest}
          >
            <FontAwesome name="save" size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Save Test</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Test via Screenshot</Text>
        <Text style={styles.sectionSubtext}>
          Take photos or select images of your test results. AI will automatically extract scores and subject-wise performance.
        </Text>

        <View style={styles.imageActions}>
          <TouchableOpacity style={styles.imageActionButton} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color="#4ECDC4" />
            <Text style={styles.imageActionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imageActionButton} onPress={pickImages}>
            <MaterialIcons name="file-upload" size={24} color="#4ECDC4" />
            <Text style={styles.imageActionText}>Select Images</Text>
          </TouchableOpacity>
        </View>
      </View>

      {selectedImages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Images ({selectedImages.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {selectedImages.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.selectedImage} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <FontAwesome name="trash" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
            onPress={analyzeImages}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome name="save" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.analyzeButtonText}>
              {isAnalyzing ? 'Analyzing...' : 'Analyze Images'}
            </Text>
          </TouchableOpacity>
        </View>
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
  imageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#4ECDC4',
    borderStyle: 'dashed',
    gap: 8,
  },
  imageActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4ECDC4',
  },
  imageScroll: {
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImage: {
    width: 120,
    height: 160,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#4ECDC4',
    gap: 8,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#636366',
  },
  dataValue: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  subjectScoresSection: {
    marginTop: 16,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  subjectScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  subjectScoreName: {
    fontSize: 13,
    color: '#636366',
  },
  subjectScoreValue: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
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
});