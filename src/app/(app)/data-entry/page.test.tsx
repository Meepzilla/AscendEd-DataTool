import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DataEntryPage from './page';
import { useStudentData } from '@/hooks/use-student-data';
import { useToast } from '@/components/ui/use-toast';
import { useErrorLog } from '@/hooks/use-error-log';
import { DatePicker } from '@/components/ui/date-picker';
import { GoalDataInputComponent } from '@/components/forms/goal-data-input';
import { ConfirmationModal } from '@/components/modals/confirmation-modal';
import { getActivitySuggestions } from '@/ai/flows/activity-suggestions';
import { generateUUID } from '@/lib/utils';
import { cn } from '@/lib/utils';

// Mock hooks and external dependencies
jest.mock('@/hooks/use-student-data');
jest.mock('@/components/ui/use-toast');
jest.mock('@/hooks/use-error-log');
jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: jest.fn(({ date, onDateChange }) => (
    <input
      data-testid="date-picker"
      type="date"
      value={date?.toISOString().split('T')[0] || ''}
      onChange={(e) => onDateChange(new Date(e.target.value))}
    />
  )),
}));
jest.mock('@/components/forms/goal-data-input', () => ({
  GoalDataInputComponent: jest.fn(({ goal, data, onChange, className }) => {
    return (
 <div data-testid={`goal-input-${goal.id}`} className={className}>
        <span>{goal.name}</span>
 <input
 data-testid={`goal-data-input-${goal.id}`}
 value={data || ''}
 onChange={(e) => onChange(e.target.value)}
 />
 </div>
 );
  }),
}));
jest.mock('@/components/modals/confirmation-modal', () => ({
  ConfirmationModal: jest.fn(({ isOpen, onClose, onConfirm, title, children }) => (
    isOpen ? (
      <div data-testid="confirmation-modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null
  )),
}));
jest.mock('@/ai/flows/activity-suggestions');
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  generateUUID: jest.fn(),
  cn: jest.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

const mockUseStudentData = useStudentData as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockUseErrorLog = useErrorLog as jest.Mock;
const mockGetActivitySuggestions = getActivitySuggestions as jest.Mock;
const mockGenerateUUID = generateUUID as jest.Mock;
const mockCn = cn as jest.Mock;

const mockStudents = [
  {
    id: 'student-1',
    name: 'Alice',
    goals: [
      { id: 'goal-1', name: 'Articulation Goal', type: 'ARTICULATION', isArchived: false },
      { id: 'goal-2', name: 'Fluency Goal', type: 'FLUENCY_SYLLABLE_STUTTER', isArchived: false },
      { id: 'goal-3', name: 'Observation Goal', type: 'QUALITATIVE_OBSERVATION', isArchived: false },
      { id: 'goal-4', name: 'Archived Goal', type: 'ARTICULATION', isArchived: true },
      { id: 'goal-5', name: 'Another Goal', type: 'ARTICULATION', isArchived: false },
      { id: 'goal-6', name: 'Yet Another Goal', type: 'ARTICULATION', isArchived: false },
    ],
  },
  {
    id: 'student-2',
    name: 'Bob',
    goals: [
      { id: 'goal-b1', name: 'Bob Articulation', type: 'ARTICULATION', isArchived: false },
    ],
  },
];

const mockInitialDataEntrySessionDate = new Date('2023-10-26');
const mockInitialDataEntrySessionTime = '10:00';
const mockInitialDataEntrySelectedStudentIds = ['student-1'];
const mockInitialDataEntryStudentSessionStates = {
  'student-1': {
    activity: 'Initial Activity',
    notes: 'Initial Notes',
    goalData: {},
  },
};
const mockInitialDataEntryFocusedStudentSlotIndex = 0;
const mockInitialDataEntryFocusedGoalIndexByStudentId = {};
const mockInitialDataEntryAiActivitySuggestions = {};
const mockInitialDataEntryVisibleGoalCountByStudentId = {};
const mockInitialDataEntryShowArchivedByStudentId = {};

const mockAddSession = jest.fn();
const mockGetSessionsForStudent = jest.fn();
const mockOpenEditStudentModal = jest.fn();
const mockToast = jest.fn();
const mockAddErrorLog = jest.fn();

const setup = (
  {
    students = [],
    dataEntrySessionDate = mockInitialDataEntrySessionDate,
    dataEntrySessionTime = mockInitialDataEntrySessionTime,
    dataEntrySelectedStudentIds = [],
    dataEntryStudentSessionStates = {},
    dataEntryFocusedStudentSlotIndex = 0,
    dataEntryFocusedGoalIndexByStudentId = {},
    dataEntryAiActivitySuggestions = {},
    dataEntryVisibleGoalCountByStudentId = {},
    dataEntryShowArchivedByStudentId = {},
    isLoading = false,
    addSession = mockAddSession,
    getSessionsForStudent = mockGetSessionsForStudent,
    openEditStudentModal = mockOpenEditStudentModal,
  } = {}
) => {
  mockUseStudentData.mockReturnValue({
    students,
    dataEntrySessionDate,
    setDataEntrySessionDate: jest.fn(),
    dataEntrySessionTime,
    setDataEntrySessionTime: jest.fn(),
    dataEntrySelectedStudentIds,
    setDataEntrySelectedStudentIds: jest.fn(),
    dataEntryStudentSessionStates,
    setDataEntryStudentSessionStates: jest.fn(),
    dataEntryFocusedStudentSlotIndex,
    setDataEntryFocusedStudentSlotIndex: jest.fn(),
    dataEntryFocusedGoalIndexByStudentId,
    setDataEntryFocusedGoalIndexByStudentId: jest.fn(),
    dataEntryAiActivitySuggestions,
    setDataEntryAiActivitySuggestions: jest.fn(),
    dataEntryVisibleGoalCountByStudentId,
    setDataEntryVisibleGoalCountByStudentId: jest.fn(),
    dataEntryShowArchivedByStudentId,
    setDataEntryShowArchivedByStudentId: jest.fn(),
    addSession,
    getSessionsForStudent,
    openEditStudentModal,
    isLoading,
  });
  mockUseToast.mockReturnValue({
    toast: mockToast,
  });
  mockUseErrorLog.mockReturnValue({
    addErrorLog: mockAddErrorLog,
  });
  mockGenerateUUID.mockImplementation(() => Math.random().toString(36).substring(2, 15));
  mockCn.mockImplementation((...classes) => classes.filter(Boolean).join(' '));

  render(<DataEntryPage />);
};

describe('DataEntryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Initial render with no students.
  test('should render correctly with no students', () => {
    setup({ students: [] });
    expect(screen.getByText('Data Entry')).toBeInTheDocument();
    expect(screen.getByText('Add a student slot')).toBeInTheDocument();
    expect(screen.queryByText('No students available.')).not.toBeInTheDocument(); // Selector is still available
  });

  // 2. Initial render with students and one selected.
  test('should render correctly with students and one selected', () => {
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
    });

    expect(screen.getByText('Data Entry')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter activity...')).toHaveValue('Initial Activity');
    expect(screen.getByPlaceholderText('Enter notes...')).toHaveValue('Initial Notes');
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Time')).toBeInTheDocument();

    // Check for goal inputs for the selected student
 expect(screen.getByTestId('goal-input-goal-1')).toBeInTheDocument();
 expect(screen.getByTestId('goal-input-goal-2')).toBeInTheDocument();
 expect(screen.getByTestId('goal-input-goal-3')).toBeInTheDocument();
    expect(screen.queryByTestId('goal-data-input-goal-4')).not.toBeInTheDocument(); // Archived goal
  });

  // 3. Adding and removing student slots.
  test('should add and remove student slots', async () => {
    const setDataEntrySelectedStudentIds = jest.fn();
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: [],
      setDataEntrySelectedStudentIds,
      dataEntryStudentSessionStates: {},
      setDataEntryStudentSessionStates,
    });

    // Add a student slot
    const addSlotButton = screen.getByText('Add a student slot');
    fireEvent.click(addSlotButton);

    await waitFor(() => {
      expect(setDataEntrySelectedStudentIds).toHaveBeenCalledWith(expect.any(Function));
    });

    // Simulate state update from the mock function
    setDataEntrySelectedStudentIds.mockImplementation((updater) => {
      const newState = updater([]);
      expect(newState).toHaveLength(1);
      expect(newState[0]).toBeNull(); // Initially null
    });

    // Select a student in the new slot (tested in the next test)
    // For now, assume we have a slot. Let's simulate having one slot with student-1 selected.
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
      setDataEntrySelectedStudentIds,
      setDataEntryStudentSessionStates,
    });

    // Remove the student slot
    const removeSlotButton = screen.getByRole('button', { name: 'Remove student slot' });
    fireEvent.click(removeSlotButton);

    await waitFor(() => {
      expect(setDataEntrySelectedStudentIds).toHaveBeenCalledWith(expect.any(Function));
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });

    // Simulate state update from the mock function
    setDataEntrySelectedStudentIds.mockImplementation((updater) => {
      const newState = updater(['student-1']);
      expect(newState).toHaveLength(0);
    });
    setDataEntryStudentSessionStates.mockImplementation((updater) => {
      const newState = updater({ 'student-1': {} });
      expect(newState).toEqual({});
    });
  });


  // 4. Selecting a different student in a slot.
  test('should select a different student in a slot', async () => {
    const setDataEntrySelectedStudentIds = jest.fn();
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: [null], // Start with an empty slot
      setDataEntrySelectedStudentIds,
      dataEntryStudentSessionStates: {},
      setDataEntryStudentSessionStates,
    });

    // Select student-1 in the first slot
    const selectTrigger = screen.getByText('Select student');
    fireEvent.click(selectTrigger);

    const student1Option = screen.getByText('Alice');
    fireEvent.click(student1Option);

    await waitFor(() => {
      expect(setDataEntrySelectedStudentIds).toHaveBeenCalledWith(['student-1']);
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });

    // Simulate state update from the mock function
    setDataEntryStudentSessionStates.mockImplementation((updater) => {
      const newState = updater({});
      expect(newState).toHaveProperty('student-1');
      expect(newState['student-1'].activity).toBe('');
    });

    // Select student-2 in the same slot
    fireEvent.click(screen.getByText('Alice')); // Click the current student name to open the select
    const student2Option = screen.getByText('Bob');
    fireEvent.click(student2Option);

    await waitFor(() => {
      expect(setDataEntrySelectedStudentIds).toHaveBeenCalledWith(['student-2']);
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });

    // Simulate state update from the mock function
    setDataEntryStudentSessionStates.mockImplementation((updater) => {
      const newState = updater({ 'student-1': {} }); // State before changing
      expect(newState).not.toHaveProperty('student-1');
      expect(newState).toHaveProperty('student-2');
      expect(newState['student-2'].activity).toBe('');
    });
  });


  // 5. Changing session date and time.
  test('should change session date and time', async () => {
    const setDataEntrySessionDate = jest.fn();
    const setDataEntrySessionTime = jest.fn();
    setup({
      dataEntrySessionDate: new Date('2023-10-26'),
      dataEntrySessionTime: '10:00',
      setDataEntrySessionDate,
      setDataEntrySessionTime,
    });

    // Change date
    const dateInput = screen.getByTestId('date-picker');
    fireEvent.change(dateInput, { target: { value: '2023-11-15' } });

    await waitFor(() => {
      expect(setDataEntrySessionDate).toHaveBeenCalledWith(expect.any(Date));
      const calledDate = setDataEntrySessionDate.mock.calls[0][0];
      expect(calledDate.toISOString().split('T')[0]).toBe('2023-11-15');
    });

    // Change time
    const timeInput = screen.getByLabelText('Time');
    fireEvent.change(timeInput, { target: { value: '14:30' } });

    await waitFor(() => {
      expect(setDataEntrySessionTime).toHaveBeenCalledWith('14:30');
    });
  });

  // 6. Handling input changes for activity and notes.
  test('should handle input changes for activity and notes', async () => {
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: {
        'student-1': { activity: '', notes: '', goalData: {} },
      },
      setDataEntryStudentSessionStates,
    });

    const activityInput = screen.getByPlaceholderText('Enter activity...');
    const notesInput = screen.getByPlaceholderText('Enter notes...');

    fireEvent.change(activityInput, { target: { value: 'New Activity' } });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: {} } }); // Simulate state update

    fireEvent.change(notesInput, { target: { value: 'New Notes' } });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[1][0]({ 'student-1': { activity: 'New Activity', notes: '', goalData: {} } }); // Simulate state update
  });


  // 7. Handling goal data changes for different goal types (ARTICULATION, FLUENCY_SYLLABLE_STUTTER, QUALITATIVE_OBSERVATION).
  test('should handle goal data changes for different goal types', async () => {
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: {
        'student-1': { activity: '', notes: '', goalData: {} },
      },
      setDataEntryStudentSessionStates,
    });

 const articulationInput = screen.getByTestId('goal-data-input-goal-1');
 const fluencyInput = screen.getByTestId('goal-data-input-goal-2');
 const observationInput = screen.getByTestId('goal-data-input-goal-3');

    fireEvent.change(articulationInput, { target: { value: '5/10' } });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: {} } }); // Simulate state update

    fireEvent.change(fluencyInput, { target: { value: '3 stuttered syllables' } });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[1][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '5/10' } } }); // Simulate state update

    fireEvent.change(observationInput, { target: { value: 'Participated well' } });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[2][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '5/10', 'goal-2': '3 stuttered syllables' } } }); // Simulate state update
  });

  // 8. Hotkey handling for focusing students (1-4, A, Alt+A).
  test('should handle hotkeys for focusing students', async () => {
    const setDataEntryFocusedStudentSlotIndex = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1', 'student-2', null, null],
      setDataEntryFocusedStudentSlotIndex,
    });

    // Focus student 1 (key '1')
    fireEvent.keyDown(document.body, { key: '1' });
    await waitFor(() => {
      expect(setDataEntryFocusedStudentSlotIndex).toHaveBeenCalledWith(0);
    });
    setDataEntryFocusedStudentSlotIndex.mockClear(); // Clear mock calls

    // Focus student 2 (key '2')
    fireEvent.keyDown(document.body, { key: '2' });
    await waitFor(() => {
      expect(setDataEntryFocusedStudentSlotIndex).toHaveBeenCalledWith(1);
    });
    setDataEntryFocusedStudentSlotIndex.mockClear();

    // Try to focus student 3 (key '3') - should not happen as slot is empty
    fireEvent.keyDown(document.body, { key: '3' });
    await waitFor(() => {
      expect(setDataEntryFocusedStudentSlotIndex).not.toHaveBeenCalledWith(2);
    });

    // Focus first student (key 'A')
    fireEvent.keyDown(document.body, { key: 'a' });
    await waitFor(() => {
      expect(setDataEntryFocusedStudentSlotIndex).toHaveBeenCalledWith(0);
    });
    setDataEntryFocusedStudentSlotIndex.mockClear();

    // Add another student slot to test Alt+A
    const setDataEntrySelectedStudentIds = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'], // Start with one
      setDataEntrySelectedStudentIds,
      setDataEntryFocusedStudentSlotIndex,
    });
    fireEvent.keyDown(document.body, { key: 'a', altKey: true }); // Alt+A to add slot
    await waitFor(() => {
      expect(setDataEntrySelectedStudentIds).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntrySelectedStudentIds.mockClear();

    // Now with 2 slots ('student-1', null), press A to focus first
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1', null],
      setDataEntryFocusedStudentSlotIndex,
    });
    fireEvent.keyDown(document.body, { key: 'a' });
    await waitFor(() => {
      expect(setDataEntryFocusedStudentSlotIndex).toHaveBeenCalledWith(0);
    });
  });

  // 9. Hotkey handling for focusing goals (S, Alt+S).
  test('should handle hotkeys for focusing goals', async () => {
    const setDataEntryFocusedGoalIndexByStudentId = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryFocusedStudentSlotIndex: 0, // Focus student-1
      dataEntryFocusedGoalIndexByStudentId: {},
      setDataEntryFocusedGoalIndexByStudentId,
    });

    // Focus next goal (key 's')
    fireEvent.keyDown(document.body, { key: 's' });
    await waitFor(() => {
      expect(setDataEntryFocusedGoalIndexByStudentId).toHaveBeenCalledWith(expect.any(Function));
    });
    // Simulate state update for student-1
    setDataEntryFocusedGoalIndexByStudentId.mock.calls[0][0]({ 'student-1': 0 });
    expect(setDataEntryFocusedGoalIndexByStudentId).toHaveBeenLastCalledWith({ 'student-1': 1 }); // Goal 2 is next

    // Focus previous goal (key 's', Alt key)
    fireEvent.keyDown(document.body, { key: 's', altKey: true });
    await waitFor(() => {
      expect(setDataEntryFocusedGoalIndexByStudentId).toHaveBeenCalledWith(expect.any(Function));
    });
    // Simulate state update for student-1
    setDataEntryFocusedGoalIndexByStudentId.mock.calls[1][0]({ 'student-1': 1 });
    expect(setDataEntryFocusedGoalIndexByStudentId).toHaveBeenLastCalledWith({ 'student-1': 0 }); // Goal 1 is previous
  });

  // 10. Hotkey handling for data entry (C, Alt+C, N, Alt+N, D, V, G, P, F, I).
  test('should handle hotkeys for data entry', async () => {
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryFocusedStudentSlotIndex: 0,
      dataEntryFocusedGoalIndexByStudentId: { 'student-1': 0 }, // Focus first goal (Articulation Goal)
      dataEntryStudentSessionStates: {
        'student-1': { activity: 'Current Activity', notes: 'Current Notes', goalData: { 'goal-1': '' } },
      },
      setDataEntryStudentSessionStates,
    });

    const articulationInput = screen.getByTestId('goal-data-input-goal-1');

    // Copy Activity (key 'c')
    fireEvent.keyDown(document.body, { key: 'c' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '' } } });
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: 'Current Activity', notes: '', goalData: { 'goal-1': '' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Copy Notes (key 'n')
    fireEvent.keyDown(document.body, { key: 'n' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '' } } });
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: '', notes: 'Current Notes', goalData: { 'goal-1': '' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Copy Activity and Notes (key 'c', Alt key)
    fireEvent.keyDown(document.body, { key: 'c', altKey: true });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '' } } });
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: 'Current Activity', notes: 'Current Notes', goalData: { 'goal-1': '' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Add 10/10 (key 'd') to focused goal
    fireEvent.keyDown(document.body, { key: 'd' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '' } } });
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '10/10' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Add 5/5 (key 'v') to focused goal
    fireEvent.keyDown(document.body, { key: 'v' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '10/10' } } }); // State before
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '5/5' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Add Goal Met (key 'g') to focused goal
    fireEvent.keyDown(document.body, { key: 'g' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '' } } }); // State before
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': 'Goal Met' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Add Progressing (key 'p') to focused goal
    fireEvent.keyDown(document.body, { key: 'p' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': '' } } }); // State before
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: '', notes: '', goalData: { 'goal-1': 'Progressing' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Add Fluency Hotkeys (F, I) - requires focused goal to be Fluency type
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryFocusedStudentSlotIndex: 0,
      dataEntryFocusedGoalIndexByStudentId: { 'student-1': 1 }, // Focus second goal (Fluency Goal)
      dataEntryStudentSessionStates: {
        'student-1': { activity: '', notes: '', goalData: { 'goal-2': '' } },
      },
      setDataEntryStudentSessionStates,
    });

    // Add 5 Fluency Syllables (key 'f')
    fireEvent.keyDown(document.body, { key: 'f' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-2': '' } } }); // State before
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: '', notes: '', goalData: { 'goal-2': '5' } } });
    setDataEntryStudentSessionStates.mockClear();

    // Add Incidental (key 'i')
    fireEvent.keyDown(document.body, { key: 'i' });
    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith(expect.any(Function));
    });
    setDataEntryStudentSessionStates.mock.calls[0][0]({ 'student-1': { activity: '', notes: '', goalData: { 'goal-2': '' } } }); // State before
    expect(setDataEntryStudentSessionStates).toHaveBeenLastCalledWith({ 'student-1': { activity: '', notes: '', goalData: { 'goal-2': 'Incidental' } } });
    setDataEntryStudentSessionStates.mockClear();
  });


  // 11. Hotkey handling for saving (Ctrl+Enter).
  test('should handle Ctrl+Enter hotkey to save session', async () => {
    const addSession = jest.fn().mockResolvedValue({});
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: {
        'student-1': { activity: 'Test Activity', notes: 'Test Notes', goalData: { 'goal-1': 'Data' } },
      },
      addSession,
    });

    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(addSession).toHaveBeenCalledWith({
        date: mockInitialDataEntrySessionDate,
        time: mockInitialDataEntrySessionTime,
        studentSessions: [{
          studentId: 'student-1',
          activity: 'Test Activity',
          notes: 'Test Notes',
          goalData: { 'goal-1': 'Data' },
        }],
      });
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Session(s) saved successfully.',
    });
  });

  // 12. Hotkey handling for editing student (Alt+E).
  test('should handle Alt+E hotkey to open edit student modal', async () => {
    const openEditStudentModal = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryFocusedStudentSlotIndex: 0,
      openEditStudentModal,
    });

    fireEvent.keyDown(document.body, { key: 'e', altKey: true });

    await waitFor(() => {
      expect(openEditStudentModal).toHaveBeenCalledWith('student-1');
    });
  });

  // 13. Saving a session successfully.
  test('should save a session successfully when clicking save button', async () => {
    const addSession = jest.fn().mockResolvedValue({});
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: {
        'student-1': { activity: 'Test Activity', notes: 'Test Notes', goalData: { 'goal-1': 'Data' } },
      },
      addSession,
      setDataEntryStudentSessionStates,
    });

    const saveButton = screen.getByRole('button', { name: 'Save Session(s)' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(addSession).toHaveBeenCalledWith({
        date: mockInitialDataEntrySessionDate,
        time: mockInitialDataEntrySessionTime,
        studentSessions: [{
          studentId: 'student-1',
          activity: 'Test Activity',
          notes: 'Test Notes',
          goalData: { 'goal-1': 'Data' },
        }],
      });
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Session(s) saved successfully.',
    });
    expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith({}); // Reset state after saving
  });


  // 14. Resetting unsaved data.
  test('should reset unsaved data when clicking reset button', async () => {
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: {
        'student-1': { activity: 'Unsaved Activity', notes: 'Unsaved Notes', goalData: { 'goal-1': 'Unsaved Data' } },
      },
      setDataEntryStudentSessionStates,
    });

    const resetButton = screen.getByRole('button', { name: 'Reset' });
    fireEvent.click(resetButton);

    // Confirmation modal should appear
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(setDataEntryStudentSessionStates).toHaveBeenCalledWith({});
    });
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument(); // Modal should close
  });

  // 15. Fetching and displaying AI activity suggestions.
  test('should fetch and display AI activity suggestions', async () => {
    const setDataEntryAiActivitySuggestions = jest.fn();
    const mockSuggestions = ['Suggestion 1', 'Suggestion 2'];
    mockGetActivitySuggestions.mockResolvedValue(mockSuggestions);

    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryAiActivity