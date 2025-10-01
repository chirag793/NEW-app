import { Subject } from '@/types/study';

export const MEDICAL_SUBJECTS = [
  { id: 'anatomy', name: 'Anatomy', color: '#FF6B6B' },
  { id: 'physiology', name: 'Physiology', color: '#4ECDC4' },
  { id: 'biochemistry', name: 'Biochemistry', color: '#45B7D1' },
  { id: 'pathology', name: 'Pathology', color: '#96CEB4' },
  { id: 'pharmacology', name: 'Pharmacology', color: '#FFEAA7' },
  { id: 'microbiology', name: 'Microbiology', color: '#DDA0DD' },
  { id: 'forensic', name: 'Forensic Medicine', color: '#98D8C8' },
  { id: 'community', name: 'Community Medicine', color: '#F7DC6F' },
  { id: 'medicine', name: 'Medicine', color: '#85C1E2' },
  { id: 'surgery', name: 'Surgery', color: '#F8B739' },
  { id: 'obgyn', name: 'OB/GYN', color: '#E8DAEF' },
  { id: 'pediatrics', name: 'Pediatrics', color: '#ABEBC6' },
  { id: 'ophthalmology', name: 'Ophthalmology', color: '#FAD7A0' },
  { id: 'ent', name: 'ENT', color: '#D5A6BD' },
  { id: 'orthopedics', name: 'Orthopedics', color: '#AED6F1' },
  { id: 'radiology', name: 'Radiology', color: '#A9DFBF' },
  { id: 'psychiatry', name: 'Psychiatry', color: '#F9E79F' },
  { id: 'dermatology', name: 'Dermatology', color: '#D2B4DE' },
  { id: 'anesthesia', name: 'Anesthesia', color: '#A3E4D7' },
];

// Default subjects with target hours for initialization
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'anatomy', name: 'Anatomy', color: '#FF6B6B', targetHours: 150, completedHours: 0 },
  { id: 'physiology', name: 'Physiology', color: '#4ECDC4', targetHours: 120, completedHours: 0 },
  { id: 'biochemistry', name: 'Biochemistry', color: '#45B7D1', targetHours: 100, completedHours: 0 },
  { id: 'pathology', name: 'Pathology', color: '#96CEB4', targetHours: 130, completedHours: 0 },
  { id: 'pharmacology', name: 'Pharmacology', color: '#FFEAA7', targetHours: 110, completedHours: 0 },
  { id: 'microbiology', name: 'Microbiology', color: '#DDA0DD', targetHours: 90, completedHours: 0 },
  { id: 'forensic', name: 'Forensic Medicine', color: '#98D8C8', targetHours: 80, completedHours: 0 },
  { id: 'community', name: 'Community Medicine', color: '#F7DC6F', targetHours: 85, completedHours: 0 },
  { id: 'medicine', name: 'Medicine', color: '#85C1E2', targetHours: 200, completedHours: 0 },
  { id: 'surgery', name: 'Surgery', color: '#F8B739', targetHours: 180, completedHours: 0 },
  { id: 'obgyn', name: 'OB/GYN', color: '#E8DAEF', targetHours: 120, completedHours: 0 },
  { id: 'pediatrics', name: 'Pediatrics', color: '#ABEBC6', targetHours: 140, completedHours: 0 },
  { id: 'ophthalmology', name: 'Ophthalmology', color: '#FAD7A0', targetHours: 70, completedHours: 0 },
  { id: 'ent', name: 'ENT', color: '#D5A6BD', targetHours: 70, completedHours: 0 },
  { id: 'orthopedics', name: 'Orthopedics', color: '#AED6F1', targetHours: 90, completedHours: 0 },
  { id: 'radiology', name: 'Radiology', color: '#A9DFBF', targetHours: 80, completedHours: 0 },
  { id: 'psychiatry', name: 'Psychiatry', color: '#F9E79F', targetHours: 75, completedHours: 0 },
  { id: 'dermatology', name: 'Dermatology', color: '#D2B4DE', targetHours: 65, completedHours: 0 },
  { id: 'anesthesia', name: 'Anesthesia', color: '#A3E4D7', targetHours: 70, completedHours: 0 },
];

// Default exam dates - INICET is usually in May (2nd Sunday)
// NEET PG dates vary each year
export const DEFAULT_EXAM_DATES = {
  NEET_PG: '2025-07-07', // Usually in June/July
  INICET: '2025-05-11', // Usually 2nd Sunday of May
};

export const EXAM_INFO = {
  INICET: {
    name: 'INICET',
    fullName: 'Institute of National Importance Combined Entrance Test',
    description: 'Usually held on 2nd Sunday of May',
    defaultMonth: 5, // May
    defaultDay: 11, // 2nd Sunday (approximate)
  },
  NEET_PG: {
    name: 'NEET PG',
    fullName: 'National Eligibility cum Entrance Test - Postgraduate',
    description: 'Date varies each year (usually June-July)',
    defaultMonth: 7, // July
    defaultDay: 7,
  },
};