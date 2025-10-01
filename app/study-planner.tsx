import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useStudy } from '@/hooks/study-context';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { CalendarEvent } from '@/types/study';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

export default function StudyPlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { subjects, studySessions, currentUser } = useStudy();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventSubjectId, setEventSubjectId] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventColor, setEventColor] = useState('#4A90E2');
  
  // Remove mock tasks - we'll use calendar events instead

  // Calendar events state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  // Remove unused variable warning by using it in a comment: isLoadingEvents

  // const priorityColors = {
  //   high: '#FF6B6B',
  //   medium: '#FFA500',
  //   low: '#4ECDC4',
  // }; // Removed as not used

  const getStorageKey = useCallback(() => {
    const prefix = currentUser?.id ? `user_${currentUser.id}_` : 'guest_';
    return `${prefix}calendar_events`;
  }, [currentUser?.id]);

  const loadCalendarEvents = useCallback(async () => {
    try {
      const storageKey = getStorageKey();
      const eventsData = await AsyncStorage.getItem(storageKey);
      const events: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [getStorageKey]);

  const saveCalendarEvents = useCallback(async (events: CalendarEvent[]) => {
    try {
      const storageKey = getStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify(events));
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error saving calendar events:', error);
    }
  }, [getStorageKey]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // Reload events when screen comes into focus (e.g., returning from edit page)
  useFocusEffect(
    useCallback(() => {
      loadCalendarEvents();
    }, [loadCalendarEvents])
  );

  // Generate calendar data with subject strips
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Last day of current month

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    // Calculate how many weeks we need to show the full month
    const weeksNeeded = Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7);
    const totalDays = weeksNeeded * 7;
    
    for (let i = 0; i < totalDays; i++) {
      const dateStr = current.toISOString().split('T')[0];
      const isCurrentMonth = current.getMonth() === month;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      // Only include dates that are in current month or previous month (not next month)
      const isNextMonth = current.getMonth() === (month + 1) % 12 && current.getFullYear() >= year;
      
      if (!isNextMonth) {
        // Get study sessions for this date
        const daySessions = studySessions.filter(session => {
          const sessionDate = new Date(session.startTime).toISOString().split('T')[0];
          return sessionDate === dateStr;
        });
        
        // Get calendar events for this date
        const dayEvents = calendarEvents.filter(event => {
          const eventStart = new Date(event.startDate).toISOString().split('T')[0];
          const eventEnd = new Date(event.endDate).toISOString().split('T')[0];
          return dateStr >= eventStart && dateStr <= eventEnd;
        });
        
        // Get tasks for this date (from calendar events)
        const dayTasks = dayEvents.filter(event => {
          const eventDate = new Date(event.startDate).toISOString().split('T')[0];
          return eventDate === dateStr;
        });
        
        // Get subjects studied on this day
        const subjectsStudied = daySessions.map(session => {
          const subject = subjects.find(s => s.id === session.subjectId);
          return subject;
        }).filter(Boolean);
        
        days.push({
          date: new Date(current),
          dateStr,
          day: current.getDate(),
          isCurrentMonth,
          isToday,
          sessions: daySessions,
          tasks: dayTasks,
          events: dayEvents,
          subjects: subjectsStudied,
          totalMinutes: daySessions.reduce((sum, s) => sum + s.duration, 0),
        });
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentDate, studySessions, subjects, calendarEvents]);

  // Generate subject strips for the calendar
  const subjectStrips = useMemo(() => {
    const strips: {
      event: CalendarEvent;
      startCol: number;
      endCol: number;
      row: number;
      width: number;
      stackIndex: number;
    }[] = [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Track events per calendar position (row + column) to handle stacking properly
    const eventsPerPosition: { [key: string]: CalendarEvent[] } = {};
    
    // First pass: group events by their calendar positions
    calendarEvents.forEach(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      
      // Calculate position in calendar grid
      const startDiff = Math.floor((eventStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const endDiff = Math.floor((eventEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (startDiff < 42 && endDiff >= 0) {
        const startRow = Math.floor(Math.max(0, startDiff) / 7);
        const endRow = Math.floor(Math.min(41, endDiff) / 7);
        
        // Handle multi-row events by creating separate strips for each row
        for (let row = startRow; row <= endRow; row++) {
          const isFirstRow = row === startRow;
          const isLastRow = row === endRow;
          
          const startCol = isFirstRow ? Math.max(0, startDiff % 7) : 0;
          const endCol = isLastRow ? Math.min(6, endDiff % 7) : 6;
          
          // For each column this event spans in this row
          for (let col = startCol; col <= endCol; col++) {
            const positionKey = `${row}-${col}`;
            if (!eventsPerPosition[positionKey]) {
              eventsPerPosition[positionKey] = [];
            }
            // Only add if not already added (avoid duplicates)
            if (!eventsPerPosition[positionKey].find(e => e.id === event.id)) {
              eventsPerPosition[positionKey].push(event);
            }
          }
        }
      }
    });

    // Second pass: create strips with proper positioning and stacking
    calendarEvents.forEach(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      
      // Calculate position in calendar grid
      const startDiff = Math.floor((eventStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const endDiff = Math.floor((eventEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (startDiff < 42 && endDiff >= 0) {
        const startRow = Math.floor(Math.max(0, startDiff) / 7);
        const endRow = Math.floor(Math.min(41, endDiff) / 7);
        
        // Handle multi-row events by creating separate strips for each row
        for (let row = startRow; row <= endRow; row++) {
          const isFirstRow = row === startRow;
          const isLastRow = row === endRow;
          
          const colStart = isFirstRow ? Math.max(0, startDiff % 7) : 0;
          const colEnd = isLastRow ? Math.min(6, endDiff % 7) : 6;
          const width = colEnd - colStart + 1;
          
          if (width > 0) {
            // Calculate stack index based on the first column of this row segment
            const firstPositionKey = `${row}-${colStart}`;
            const positionEvents = eventsPerPosition[firstPositionKey] || [];
            
            // Sort events by start time to ensure consistent stacking order
            const sortedEvents = positionEvents.sort((a, b) => {
              const aStart = new Date(a.startDate).getTime();
              const bStart = new Date(b.startDate).getTime();
              if (aStart !== bStart) return aStart - bStart;
              // If same start time, sort by event ID for consistency
              return a.id.localeCompare(b.id);
            });
            
            const stackIndex = sortedEvents.findIndex(e => e.id === event.id);
            
            strips.push({
              event,
              startCol: colStart,
              endCol: colEnd,
              row,
              width,
              stackIndex: Math.max(0, stackIndex),
            });
          }
        }
      }
    });

    return strips;
  }, [currentDate, calendarEvents]);
  
  const upcomingTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return calendarEvents
      .filter(event => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        eventStartDate.setHours(0, 0, 0, 0);
        eventEndDate.setHours(0, 0, 0, 0);
        
        // Show events that are:
        // 1. Starting today or in the future, OR
        // 2. Currently ongoing (started in the past but ending today or in the future)
        const isUpcoming = eventStartDate >= today || (eventStartDate < today && eventEndDate >= today);
        
        return isUpcoming && !event.completed;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  }, [calendarEvents]);
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  
  const getDaysUntilTask = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const toggleTaskCompletion = async (eventId: string) => {
    const updatedEvents = calendarEvents.map(event => 
      event.id === eventId 
        ? { ...event, completed: !event.completed }
        : event
    );
    await saveCalendarEvents(updatedEvents);
  };

  const deleteTask = async (eventId: string) => {
    const eventToDelete = calendarEvents.find(event => event.id === eventId);
    if (!eventToDelete) return;
    
    const performDelete = async () => {
      try {
        console.log('Deleting task with ID:', eventId);
        const updatedEvents = calendarEvents.filter(event => event.id !== eventId);
        console.log('Updated events after deletion:', updatedEvents.length);
        await saveCalendarEvents(updatedEvents);
        console.log('Task deleted successfully from both calendar and upcoming tasks');
      } catch (error) {
        console.error('Error deleting task:', error);
        if (Platform.OS === 'web') {
          alert('Failed to delete task. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to delete task. Please try again.');
        }
      }
    };
    
    if (Platform.OS === 'web') {
      const confirmed = confirm(`🗑️ Delete "${eventToDelete.title}"?\n\nThis action cannot be undone.`);
      if (confirmed) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Delete Task',
        `Are you sure you want to delete "${eventToDelete.title}"?\n\nThis action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const openEventModal = (date?: string, event?: CalendarEvent) => {
    if (event) {
      // Editing existing event - validate event data
      if (!event.title?.trim() || !event.subjectId || !event.startDate || !event.endDate) {
        console.warn('Invalid event data provided to openEventModal');
        return;
      }
      setEditingEvent(event);
      setEventTitle(event.title.trim());
      setEventSubjectId(event.subjectId);
      setEventStartDate(event.startDate.split('T')[0]);
      setEventEndDate(event.endDate.split('T')[0]);
      setEventColor(event.color);
    } else {
      // Creating new event
      setEditingEvent(null);
      const firstSubject = subjects[0];
      setEventTitle(firstSubject?.name || '');
      setEventSubjectId(firstSubject?.id || '');
      const selectedDateStr = date || new Date().toISOString().split('T')[0];
      setEventStartDate(selectedDateStr);
      setEventEndDate(selectedDateStr);
      setEventColor(firstSubject?.color || '#4A90E2');
    }
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setEventTitle('');
    setEventSubjectId('');
    setEventStartDate('');
    setEventEndDate('');
    setEventColor('#4A90E2');
  };

  const saveEvent = async () => {
    const trimmedTitle = eventTitle.trim();
    if (!trimmedTitle || trimmedTitle.length > 100 || !eventSubjectId || !eventStartDate || !eventEndDate) {
      console.warn('Invalid event data:', { title: trimmedTitle, subjectId: eventSubjectId, startDate: eventStartDate, endDate: eventEndDate });
      return;
    }

    const startDate = new Date(eventStartDate);
    const endDate = new Date(eventEndDate);
    
    if (endDate < startDate) {
      console.warn('End date cannot be before start date');
      return;
    }

    const newEvent: CalendarEvent = {
      id: editingEvent?.id || Date.now().toString(),
      title: trimmedTitle,
      subjectId: eventSubjectId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      type: 'study',
      color: eventColor,
      allDay: true,
    };

    let updatedEvents: CalendarEvent[];
    if (editingEvent) {
      // Update existing event
      updatedEvents = calendarEvents.map(event => 
        event.id === editingEvent.id ? newEvent : event
      );
    } else {
      // Add new event
      updatedEvents = [...calendarEvents, newEvent];
    }

    await saveCalendarEvents(updatedEvents);
    closeEventModal();
  };

  const deleteEvent = async (eventId: string) => {
    const eventToDelete = calendarEvents.find(event => event.id === eventId);
    if (!eventToDelete) return;
    
    if (Platform.OS === 'web') {
      // For web compatibility, use confirm
      const confirmed = confirm(`🗑️ Delete "${eventToDelete.title}"?\n\nThis action cannot be undone.`);
      if (confirmed) {
        const updatedEvents = calendarEvents.filter(event => event.id !== eventId);
        await saveCalendarEvents(updatedEvents);
        console.log(`Event "${eventToDelete.title}" deleted successfully`);
      }
    } else {
      // For mobile, use Alert
      Alert.alert(
        'Delete Event',
        `Are you sure you want to delete "${eventToDelete.title}"?\n\nThis action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const updatedEvents = calendarEvents.filter(event => event.id !== eventId);
              await saveCalendarEvents(updatedEvents);
              console.log(`Event "${eventToDelete.title}" deleted successfully`);
            },
          },
        ]
      );
    }
  };

  const handleStripPress = (event: CalendarEvent) => {
    // Navigate to edit event page
    router.push(`/edit-event?eventId=${event.id}`);
  };

  const handleStripLongPress = (event: CalendarEvent) => {
    // Validate event parameter
    if (!event || !event.title?.trim() || event.title.length > 100) {
      console.warn('Invalid event provided to handleStripLongPress');
      return;
    }
    
    const sanitizedTitle = event.title.trim();
    
    if (Platform.OS === 'web') {
      // For web compatibility, show a simple prompt
      const action = prompt(`📚 ${sanitizedTitle}\n\n🔧 Choose an action:\n\n1️⃣ Edit this event\n2️⃣ Delete this event\n\nEnter 1 or 2:`);
      
      if (action === '1') {
        router.push(`/edit-event?eventId=${event.id}`);
      } else if (action === '2') {
        deleteEvent(event.id);
      }
    } else {
      // For mobile, use Alert with action sheet style
      Alert.alert(
        sanitizedTitle,
        'Choose an action for this event:',
        [
          {
            text: 'Edit',
            onPress: () => router.push(`/edit-event?eventId=${event.id}`),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteEvent(event.id),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleDayLongPress = (dateStr: string) => {
    // Validate dateStr parameter
    if (!dateStr?.trim() || dateStr.length > 20) {
      console.warn('Invalid dateStr provided to handleDayLongPress');
      return;
    }
    
    const sanitizedDateStr = dateStr.trim();
    const formattedDate = new Date(sanitizedDateStr).toLocaleDateString();
    
    if (Platform.OS === 'web') {
      // For web compatibility, use confirm
      const confirmed = confirm(`Add a study event for ${formattedDate}?`);
      if (confirmed) {
        openEventModal(sanitizedDateStr);
      }
    } else {
      // For mobile, use Alert
      Alert.alert(
        'Add Event',
        `Add a study event for ${formattedDate}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Add Event',
            onPress: () => openEventModal(sanitizedDateStr),
          },
        ]
      );
    }
  };

  const predefinedColors = [
    '#4A90E2', '#F5A623', '#7ED321', '#D0021B', '#9013FE',
    '#50E3C2', '#B8E986', '#4BD5EE', '#F8E71C', '#BD10E0'
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
              <Ionicons name="chevron-back" size={20} color="#4ECDC4" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{formatDate(currentDate)}</Text>
            <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={20} color="#4ECDC4" />
            </TouchableOpacity>
          </View>
          
          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Text key={day} style={styles.dayHeader}>{day}</Text>
            ))}
          </View>
          
          {/* Calendar grid with subject strips */}
          <View style={styles.calendarGridContainer}>
            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {calendarData.map((dayData) => (
                <TouchableOpacity
                  key={dayData.dateStr}
                  style={[
                    styles.calendarDay,
                    !dayData.isCurrentMonth && styles.inactiveDay,
                    dayData.isToday && styles.today,
                    selectedDate === dayData.dateStr && styles.selectedDay,
                  ]}
                  onPress={() => setSelectedDate(dayData.dateStr === selectedDate ? null : dayData.dateStr)}
                  onLongPress={() => handleDayLongPress(dayData.dateStr)}
                >
                  <Text style={[
                    styles.dayNumber,
                    !dayData.isCurrentMonth && styles.inactiveDayText,
                    dayData.isToday && styles.todayText,
                    selectedDate === dayData.dateStr && styles.selectedDayText,
                  ]}>
                    {dayData.day}
                  </Text>
                  

                </TouchableOpacity>
              ))}
            </View>
            
            {/* Subject strips overlay */}
            <View style={styles.subjectStripsContainer}>
              {subjectStrips.map((strip, index) => {
                const leftPosition = (strip.startCol / 7) * 100;
                const widthPercentage = (strip.width / 7) * 100;
                const baseTopPosition = strip.row * 84 + 40; // 84px per row + 40px offset to place below day number
                const stackOffset = strip.stackIndex * 16; // 16px per stacked event (14px height + 2px margin)
                const topPosition = baseTopPosition + stackOffset;
                
                return (
                  <TouchableOpacity
                    key={`${strip.event.id}-${strip.row}-${strip.stackIndex}-${index}`}
                    style={[
                      styles.subjectStrip,
                      {
                        left: `${leftPosition}%`,
                        width: `${widthPercentage}%`,
                        top: topPosition,
                        backgroundColor: strip.event.color,
                      },
                    ]}
                    onPress={() => handleStripPress(strip.event)}
                    onLongPress={() => handleStripLongPress(strip.event)}
                    delayLongPress={500}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.subjectStripText} numberOfLines={1}>
                      {strip.event.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>💡 How to manage events:</Text>
          <Text style={styles.instructionsText}>• Tap a subject strip to edit it</Text>
          <Text style={styles.instructionsText}>• Long press a subject strip for more options</Text>
          <Text style={styles.instructionsText}>• Long press a calendar day to add new event</Text>
          <Text style={styles.instructionsText}>• Use the + button below to add new events</Text>
        </View>

        {/* Upcoming Tasks */}
        <View style={styles.tasksContainer}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="bullseye" size={20} color="#4ECDC4" />
            <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => openEventModal()}>
              <Ionicons name="add" size={16} color="#4ECDC4" />
            </TouchableOpacity>
          </View>
          
          {upcomingTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No upcoming tasks</Text>
              <Text style={styles.emptyStateSubtext}>Add tasks to stay organized</Text>
            </View>
          ) : (
            upcomingTasks.map(task => {
              const subject = subjects.find(s => s.id === task.subjectId);
              const daysUntil = getDaysUntilTask(task.startDate);
              
              return (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskHeader}>
                    <TouchableOpacity 
                      style={styles.taskCheckbox}
                      onPress={() => toggleTaskCompletion(task.id)}
                    >
                      {task.completed ? (
                        <FontAwesome name="check-circle" size={20} color="#4ECDC4" />
                      ) : (
                        <FontAwesome name="circle-o" size={20} color="#8E8E93" />
                      )}
                    </TouchableOpacity>
                    
                    <View style={styles.taskInfo}>
                      <View style={styles.taskTitleRow}>
                        <Text style={[
                          styles.taskTitle,
                          task.completed && styles.completedTask
                        ]}>
                          {task.title}
                        </Text>
                      </View>
                      <View style={styles.taskMeta}>
                        <View style={[
                          styles.subjectTag,
                          { backgroundColor: subject?.color || '#4ECDC4' }
                        ]}>
                          <Text style={styles.subjectTagText}>{subject?.name || 'Unknown'}</Text>
                        </View>
                        <Text style={styles.taskDue}>
                          {daysUntil === 0 ? 'Due today' : 
                           daysUntil === 1 ? 'Due tomorrow' : 
                           daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` :
                           `Due in ${daysUntil} days`}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.taskActions}>
                      <TouchableOpacity 
                        style={styles.taskActionIconButton}
                        onPress={() => router.push(`/edit-event?eventId=${task.id}`)}
                      >
                        <MaterialIcons name="edit" size={16} color="#4ECDC4" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.taskActionIconButton, styles.deleteIconButton]}
                        onPress={() => deleteTask(task.id)}
                      >
                        <FontAwesome name="trash" size={16} color="#E53E3E" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.floatingAddButton}
        onPress={() => openEventModal()}
        activeOpacity={0.8}
      >
  <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Event Modal */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEventModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeEventModal} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEvent ? 'Edit Event' : 'Add Event'}
            </Text>
            <TouchableOpacity onPress={saveEvent} style={styles.modalSaveButton}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Event Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Event Title</Text>
              <TextInput
                style={styles.textInput}
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="Enter event title"
                placeholderTextColor="#8E8E93"
              />
            </View>

            {/* Subject Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subject</Text>
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
              <Text style={styles.inputLabel}>Start Date</Text>
              <TextInput
                style={styles.textInput}
                value={eventStartDate}
                onChangeText={setEventStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Date</Text>
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
                    onPress={() => {
                      if (color && color.length <= 7 && color.startsWith('#')) {
                        setEventColor(color);
                      }
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Save Strip */}
            <TouchableOpacity 
              style={[
                styles.saveStrip,
                { backgroundColor: eventColor }
              ]}
              onPress={saveEvent}
              activeOpacity={0.8}
            >
              <Text style={styles.saveStripText}>
                Save
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  calendarContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    paddingVertical: 8,
  },
  calendarGridContainer: {
    position: 'relative',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    height: 84,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    position: 'relative',
    borderRadius: 8,
    marginBottom: 4,
  },
  inactiveDay: {
    opacity: 0.3,
  },
  today: {
    // Remove background color to remove the box
  },
  selectedDay: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  inactiveDayText: {
    color: '#8E8E93',
  },
  todayText: {
    color: '#FF0000',
    fontWeight: 'bold',
  },
  selectedDayText: {
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
  subjectStripsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  subjectStrip: {
    position: 'absolute',
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginHorizontal: 1,
  },
  subjectStripText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },

  tasksContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
    flex: 1,
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  taskCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskCheckbox: {
    marginRight: 12,
    padding: 4,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    flex: 1,
  },
  completedTask: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subjectTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  subjectTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  taskDue: {
    fontSize: 12,
    color: '#8E8E93',
  },
  taskDescription: {
    fontSize: 14,
    color: '#636366',
    lineHeight: 18,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  taskActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4ECDC4',
  },
  deleteButton: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FED7D7',
  },
  deleteButtonText: {
    color: '#E53E3E',
  },
  taskActionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  deleteIconButton: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FED7D7',
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeEstimateText: {
    fontSize: 10,
    color: '#8E8E93',
    marginLeft: 2,
  },
  bottomPadding: {
    height: 20,
  },
  instructionsContainer: {
    backgroundColor: '#E8F5E8',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: '#388E3C',
    marginBottom: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4ECDC4',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalContent: {
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
  saveStrip: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveStripText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});