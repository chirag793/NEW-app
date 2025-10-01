import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useStudy } from '@/hooks/study-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { CalendarEvent } from '@/types/study';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EditEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { subjects, currentUser } = useStudy();
  
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventSubjectId, setEventSubjectId] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventColor, setEventColor] = useState('#4A90E2');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStorageKey = () => {
    const prefix = currentUser?.id ? `user_${currentUser.id}_` : 'guest_';
    return `${prefix}calendar_events`;
  };

  const loadEvent = async () => {
    try {
      const storageKey = getStorageKey();
      const eventsData = await AsyncStorage.getItem(storageKey);
      const events: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];
      
      const foundEvent = events.find(e => e.id === eventId);
      if (foundEvent) {
        setEvent(foundEvent);
        setEventTitle(foundEvent.title);
        setEventSubjectId(foundEvent.subjectId);
        setEventStartDate(foundEvent.startDate.split('T')[0]);
        setEventEndDate(foundEvent.endDate.split('T')[0]);
        setEventColor(foundEvent.color);
      } else {
        Alert.alert('Error', 'Event not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  const saveEvent = async () => {
    const trimmedTitle = eventTitle.trim();
    if (!trimmedTitle || !eventSubjectId || !eventStartDate || !eventEndDate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const startDate = new Date(eventStartDate);
    const endDate = new Date(eventEndDate);
    
    if (endDate < startDate) {
      Alert.alert('Error', 'End date cannot be before start date');
      return;
    }

    setIsSaving(true);
    try {
      const storageKey = getStorageKey();
      const eventsData = await AsyncStorage.getItem(storageKey);
      const events: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];
      
      const updatedEvent: CalendarEvent = {
        ...event!,
        title: trimmedTitle,
        subjectId: eventSubjectId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        color: eventColor,
      };

      const updatedEvents = events.map(e => e.id === eventId ? updatedEvent : e);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedEvents));
      
      Alert.alert('Success', 'Event updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('Error', 'Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!event) return;
    
    const confirmDelete = () => {
      if (Platform.OS === 'web') {
        const confirmed = confirm(`Delete "${event.title}"?\n\nThis action cannot be undone.`);
        if (confirmed) {
          performDelete();
        }
      } else {
        Alert.alert(
          'Delete Event',
          `Are you sure you want to delete "${event.title}"?\n\nThis action cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: performDelete },
          ]
        );
      }
    };

    const performDelete = async () => {
      setIsDeleting(true);
      try {
        const storageKey = getStorageKey();
        const eventsData = await AsyncStorage.getItem(storageKey);
        const events: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];
        
        const updatedEvents = events.filter(e => e.id !== eventId);
        await AsyncStorage.setItem(storageKey, JSON.stringify(updatedEvents));
        
        Alert.alert('Success', 'Event deleted successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } catch (error) {
        console.error('Error deleting event:', error);
        Alert.alert('Error', 'Failed to delete event');
      } finally {
        setIsDeleting(false);
      }
    };

    confirmDelete();
  };

  const predefinedColors = [
    '#4A90E2', '#F5A623', '#7ED321', '#D0021B', '#9013FE',
    '#50E3C2', '#B8E986', '#4BD5EE', '#F8E71C', '#BD10E0'
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: 'Loading...', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: 'Event Not Found', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Event not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{ 
          title: 'Edit Event',
          headerShown: true,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={[styles.headerButton, styles.deleteButton]} 
                onPress={deleteEvent}
                disabled={isDeleting}
              >
                <FontAwesome name="trash" size={20} color="#FF3B30" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.headerButton, styles.saveButton]} 
                onPress={saveEvent}
                disabled={isSaving}
              >
                <FontAwesome name="save" size={20} color="#4ECDC4" />
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Event Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Event Title *</Text>
          <TextInput
            style={styles.textInput}
            value={eventTitle}
            onChangeText={setEventTitle}
            placeholder="Enter event title"
            placeholderTextColor="#8E8E93"
            maxLength={100}
          />
        </View>

        {/* Subject Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Subject *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectSelector}>
            {subjects.map((subject) => (
              <TouchableOpacity
                key={subject.id}
                style={[
                  styles.subjectOption,
                  {
                    backgroundColor: eventSubjectId === subject.id ? subject.color : '#F8F9FA',
                    borderColor: eventSubjectId === subject.id ? subject.color : '#E5E5EA',
                  },
                ]}
                onPress={() => {
                  setEventSubjectId(subject.id);
                  setEventColor(subject.color);
                  // Set event title to subject name if title is empty or matches previous subject
                  const currentSubject = subjects.find(s => s.id === eventSubjectId);
                  if (!eventTitle.trim() || eventTitle === currentSubject?.name) {
                    setEventTitle(subject.name);
                  }
                }}
              >
                <Text style={[
                  styles.subjectOptionText,
                  { color: eventSubjectId === subject.id ? '#FFFFFF' : '#1C1C1E' }
                ]}>
                  {subject.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date Range */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Start Date *</Text>
          <TextInput
            style={styles.textInput}
            value={eventStartDate}
            onChangeText={setEventStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8E8E93"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>End Date *</Text>
          <TextInput
            style={styles.textInput}
            value={eventEndDate}
            onChangeText={setEventEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8E8E93"
          />
        </View>

        {/* Color Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorSelector}>
            {predefinedColors.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  {
                    backgroundColor: color,
                    borderWidth: eventColor === color ? 3 : 0,
                    borderColor: '#FFFFFF',
                  },
                ]}
                onPress={() => setEventColor(color)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
      
      {/* Bottom Save Strip */}
      <View style={[styles.bottomSaveContainer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity 
          style={styles.bottomSaveButton}
          onPress={saveEvent}
          disabled={isSaving}
        >
          <Text style={styles.bottomSaveButtonText}>
            {isSaving ? 'SAVING...' : 'SAVE'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  saveButton: {
    backgroundColor: '#E8F5E8',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  subjectSelector: {
    flexDirection: 'row',
  },
  subjectOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  subjectOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  colorSelector: {
    flexDirection: 'row',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomSaveContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomSaveButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomPadding: {
    height: 100,
  },
});