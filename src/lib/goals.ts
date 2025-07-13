import { AssignedGoal, GoalTemplate } from './types';

// Goal Categories
export const GOAL_CATEGORIES = [
  'Communication',
  'Social Skills',
  'Self-Care',
  'Academics',
  'Motor Skills',
  'Behavior',
  'Other',
];

// Placeholder Goal Templates
export const PLACEHOLDER_GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'template-1',
    name: 'Improve Greeting Skills',
    category: 'Social Skills',
    description: 'Learn and practice initiating greetings with peers and adults.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template-2',
    name: 'Identify and Express Emotions',
    category: 'Communication',
    description: 'Learn to recognize and verbalize different emotions.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template-3',
    name: 'Follow Two-Step Instructions',
    category: 'Academics',
    description: 'Improve ability to follow multi-step directions.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template-4',
    name: 'Independent Dressing',
    category: 'Self-Care',
    description: 'Develop skills for dressing independently.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Placeholder Assigned Goals
export const PLACEHOLDER_ASSIGNED_GOALS: AssignedGoal[] = [
  {
    id: 'assigned-goal-1',
    templateId: 'template-1',
    studentId: 'student-1',
    assignedDate: new Date('2023-10-26'),
    sessions: [
      { date: new Date('2023-10-26'), progress: 75, notes: 'Practiced greetings with 3 peers.' },
      { date: new Date('2023-10-28'), progress: 80, notes: 'Initiated greetings successfully 4 times.' },
    ],
    status: 'Active',
    notes: 'Working well on initiating greetings.',
    assignedBy: 'teacher-1',
    createdAt: new Date('2023-10-26'),
    updatedAt: new Date('2023-10-28'),
  },
  {
    id: 'assigned-goal-2',
    templateId: 'template-2',
    studentId: 'student-1',
    assignedDate: new Date('2023-11-01'),
    sessions: [
      { date: new Date('2023-11-01'), progress: 60, notes: 'Identified happy and sad emotions.' },
      { date: new Date('2023-11-03'), progress: 65, notes: 'Used feeling words twice during conversation.' },
    ],
    status: 'Active',
    notes: 'Beginning to identify basic emotions.',
    assignedBy: 'teacher-1',
    createdAt: new Date('2023-11-01'),
    updatedAt: new Date('2023-11-03'),
  },
];