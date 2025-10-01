export interface Subject {
  id: string;
  name: string;
  color: string;
  targetHours: number;
  completedHours: number;
  averageMarks?: number; // Average marks percentage from tests
  marksProgress?: number; // Progress based on marks (0-100)
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName?: string; // Store subject name for historical accuracy
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  date: string;
  notes?: string;
}

export interface TestScore {
  id: string;
  testName: string;
  testType: 'INICET' | 'NEET' | 'Mock';
  date: string;
  totalMarks: number;
  obtainedMarks: number;
  subjectScores: SubjectScore[];
}

export interface SubjectScore {
  subjectId: string;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
}

export interface StudyPlan {
  subjectId: string;
  dailyTarget: number; // in minutes
  weeklyTarget: number; // in minutes
  priority: 'high' | 'medium' | 'low';
}

export interface DailyStats {
  date: string;
  totalMinutes: number;
  subjectBreakdown: {
    subjectId: string;
    minutes: number;
  }[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
  createdAt: string;
  lastSyncedAt?: string;
}

export interface StudyTask {
  id: string;
  title: string;
  subjectId: string;
  dueDate: string; // ISO date string
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  description?: string;
  estimatedHours?: number;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  subjectId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  type: 'study' | 'exam' | 'task' | 'revision';
  color: string;
  allDay?: boolean;
  completed?: boolean;
}