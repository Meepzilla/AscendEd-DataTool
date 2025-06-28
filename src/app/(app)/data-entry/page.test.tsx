
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataEntryPage from './page';
import { useStudentData } from '@/hooks/use-student-data';
import { useToast } from '@/hooks/use-toast';
import { Student, SessionGoalData, Goal } from '@/lib/types';
import { GOAL_TYPE_FIELDS } from '@/lib/constants';


jest.mock('@/hooks/use-student-data', () => ({
    useStudentData: jest.fn(),
}));

jest.mock('@/hooks/use-toast', () => ({
    useToast: jest.fn(() => ({
      toast: jest.fn(),
    })),
  }));

jest.mock('@/components/ui/date-picker', () => ({
    DatePicker: ({ date, setDate }: { date: Date, setDate: (date: Date) => void }) => (
      <input
        type="date"
        value={date.toISOString().split('T')[0]}
        onChange={(e) => setDate(new Date(e.target.value))}
        data-testid="datepicker"
      />
    ),
  }));

  jest.mock('@/components/layout/AppLoadingSkeleton', () => () => <div>Loading...</div>);

  jest.mock('@/components/forms/goal-data-input', () => ({
    __esModule: true,
    default: ({ goal, data, onChange, isFocused }: { goal: Goal, data: any, onChange: Function, isFocused: boolean }) => (
      <div data-testid={`goal-input-${goal.id}`} className={isFocused ? 'focused' : ''}>
        <h3>{goal.name}</h3>
        <input
          value={data.prompt}
          onChange={(e) => onChange('prompt', e.target.value)}
          data-testid={`goal-prompt-input-${goal.id}`}
        />
      </div>
    ),
}));

jest.mock('@/components/modals/confirmation-modal', () => ({
    __esModule: true,
    default: ({ isOpen, onClose, onConfirm, title }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string }) => (
        isOpen ? (
            <div data-testid="confirmation-modal">
                <h2>{title}</h2>
                <button onClick={onConfirm}>Confirm</button>
                <button onClick={onClose}>Close</button>
            </div>
        ) : null
    ),
}));


const mockStudents: Student[] = [
    {
      id: 'student-1',
      name: 'Student One',
      goals: [
        { id: 'goal-1', name: 'Goal One', type: 'Trial', isArchived: false, prompt: '', data: {}, order: 0 },
        { id: 'goal-2', name: 'Goal Two', type: 'Tally', isArchived: false, prompt: '', data: {}, order: 1 },
      ],
      isArchived: false,
    },
    {
      id: 'student-2',
      name: 'Student Two',
      goals: [
        { id: 'goal-3', name: 'Goal Three', type: 'Duration', isArchived: false, prompt: '', data: {}, order: 0 },
      ],
      isArchived: false,
    },
  ];

  const mockInitialDataEntrySessionDate = new Date();
  const mockInitialDataEntrySessionTime = '10:00';
  const mockInitialDataEntryStudentSessionStates = {
    'student-1': {
        studentId: 'student-1',
        studentName: "Student One",
        activity: '',
        notes: '',
        goalData: {
            'goal-1': JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS['Trial'])),
            'goal-2': JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS['Tally'])),
        },
        originalGoalHeaders: mockStudents[0].goals,
    },
  };

  const mockAddSession = jest.fn();
  const mockGetSessionsForStudent = jest.fn();
  const mockOpenEditStudentModal = jest.fn();
  const mockUseStudentData = useStudentData as jest.Mock;


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
      loading: isLoading,
      addSession,
      getSessionsForStudent,
      openEditStudentModal,
      saveDataEntrySession: jest.fn(),
      resetDataEntrySession: jest.fn(),
      handleGoalDataChange: jest.fn(),
      handleMoveGoal: jest.fn(),
      getCurrentFocusedGoalInfo: jest.fn(),
      fetchAiActivitySuggestions: jest.fn(),
    });

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
    expect(screen.getByText('Add Student Slot')).toBeInTheDocument();
    expect(screen.queryByText('No students available.')).not.toBeInTheDocument(); // Selector is still available
  });

  // 2. Initial render with students and one selected.
  test('should render correctly with students and one selected', () => {
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
    });
    expect(screen.getByText('Student One')).toBeInTheDocument();
    expect(screen.getByText('Goal One')).toBeInTheDocument();
    expect(screen.getByText('Goal Two')).toBeInTheDocument();
  });

  // 3. Adding and removing a student slot.
  test('should add and remove a student slot', async () => {
    const setDataEntrySelectedStudentIds = jest.fn();
    setup({
      students: mockStudents,
      dataEntrySelectedStudentIds: ['student-1'],
      dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
    });
    mockUseStudentData.mockReturnValueOnce({
      ...mockUseStudentData(),
      setDataEntrySelectedStudentIds,
      dataEntrySelectedStudentIds: ['student-1'],
    });

    const addSlotButton = screen.getByText('Add Student Slot');
    fireEvent.click(addSlotButton);
    expect(setDataEntrySelectedStudentIds).toHaveBeenCalledWith(['student-1', 'student-2']);

    // Mock the return value for the second render (after adding a student)
    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        setDataEntrySelectedStudentIds,
        dataEntrySelectedStudentIds: ['student-1', 'student-2'],
        dataEntryStudentSessionStates: {
            ...mockInitialDataEntryStudentSessionStates,
            'student-2': {
                studentId: 'student-2', studentName: 'Student Two', activity: '', notes: '',
                goalData: {'goal-3': {}}, originalGoalHeaders: mockStudents[1].goals
            }
        }
    });

    render(<DataEntryPage />);
    const removeButtons = screen.getAllByRole('button', { name: /Remove Student Slot/i });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[1]);
    expect(setDataEntrySelectedStudentIds).toHaveBeenCalledWith(['student-1']);
  });


  // 4. Changing session date and time.
  test('should update session date and time', () => {
    const setDataEntrySessionDate = jest.fn();
    const setDataEntrySessionTime = jest.fn();
    setup({
        dataEntrySessionDate: new Date('2023-01-01'),
        dataEntrySessionTime: '09:00',
    });
    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        setDataEntrySessionDate,
        setDataEntrySessionTime,
    });
    render(<DataEntryPage />);

    const datePicker = screen.getByTestId('datepicker');
    fireEvent.change(datePicker, { target: { value: '2023-01-15' } });
    expect(setDataEntrySessionDate).toHaveBeenCalledWith(new Date('2023-01-15T00:00:00.000Z'));

    const timeInput = screen.getByLabelText(/Session Time/i);
    fireEvent.change(timeInput, { target: { value: '14:30' } });
    expect(setDataEntrySessionTime).toHaveBeenCalledWith('14:30');
  });


  // 5. Handling input changes for activity and notes.
  test('should handle input changes for activity and notes', () => {
    const setDataEntryStudentSessionStates = jest.fn();
    setup({
        students: mockStudents,
        dataEntrySelectedStudentIds: ['student-1'],
        dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
    });

    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        setDataEntryStudentSessionStates
    });
    render(<DataEntryPage />);

    const activityInput = screen.getByPlaceholderText('Describe the session activity');
    fireEvent.change(activityInput, { target: { value: 'New Activity' } });

    expect(setDataEntryStudentSessionStates).toHaveBeenCalled();
  });


  // 6. Test AI suggestion fetch.
  test('should fetch AI activity suggestions when button is clicked', async () => {
    const fetchAiActivitySuggestions = jest.fn();
    setup({
        students: mockStudents,
        dataEntrySelectedStudentIds: ['student-1'],
        dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
    });
    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        fetchAiActivitySuggestions
    });
    render(<DataEntryPage />);

    const aiButton = screen.getByText('Get AI Activity Suggestions');
    fireEvent.click(aiButton);

    await waitFor(() => {
        expect(fetchAiActivitySuggestions).toHaveBeenCalledWith('student-1');
    });
  });

  // 7. Save session data.
  test('should save session data on button click', async () => {
    const saveDataEntrySession = jest.fn().mockResolvedValue(undefined);
    setup({
        students: mockStudents,
        dataEntrySelectedStudentIds: ['student-1'],
        dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
    });
    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        saveDataEntrySession,
    });

    render(<DataEntryPage/>)

    const saveButton = screen.getByText('Save Session(s)');
    fireEvent.click(saveButton);

    await waitFor(() => {
        expect(saveButton).toBeDisabled();
    });

    await waitFor(() => {
        expect(saveDataEntrySession).toHaveBeenCalled();
        expect(saveButton).not.toBeDisabled();
    });
  });


  // 8. Resetting the session data.
  test('should open confirmation and reset data', async () => {
    const resetDataEntrySession = jest.fn();
    setup({
        students: mockStudents,
        dataEntrySelectedStudentIds: ['student-1'],
        dataEntryStudentSessionStates: mockInitialDataEntryStudentSessionStates,
    });

    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        resetDataEntrySession
    });
    render(<DataEntryPage />);

    const resetButton = screen.getByText('Reset Current Data');
    fireEvent.click(resetButton);

    const confirmationModal = await screen.findByTestId('confirmation-modal');
    expect(confirmationModal).toBeInTheDocument();

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    expect(resetDataEntrySession).toHaveBeenCalled();
  });


  // 9. Displaying archived goals.
  test('should toggle display of archived goals', () => {
    const setDataEntryShowArchivedByStudentId = jest.fn();
    const archivedStudent = {
        ...mockStudents[0],
        goals: [...mockStudents[0].goals, { id: 'goal-archived', name: 'Archived Goal', type: 'Tally', isArchived: true, order: 2, prompt: '', data: {} }]
    };
    const sessionStates = {
        'student-1': { ...mockInitialDataEntryStudentSessionStates['student-1'], originalGoalHeaders: archivedStudent.goals }
    };

    setup({
        students: [archivedStudent, mockStudents[1]],
        dataEntrySelectedStudentIds: ['student-1'],
        dataEntryStudentSessionStates: sessionStates,
        dataEntryShowArchivedByStudentId: { 'student-1': false }
    });
    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        setDataEntryShowArchivedByStudentId,
        dataEntryShowArchivedByStudentId: { 'student-1': false },
    });

    render(<DataEntryPage />);

    expect(screen.queryByText('Archived Goal')).not.toBeInTheDocument();

    // Re-setup with the toggle on
    mockUseStudentData.mockReturnValueOnce({
        ...mockUseStudentData(),
        setDataEntryShowArchivedByStudentId,
        dataEntryShowArchivedByStudentId: { 'student-1': true },
        students: [archivedStudent, mockStudents[1]],
        dataEntrySelectedStudentIds: ['student-1'],
        dataEntryStudentSessionStates: sessionStates,
    });

    render(<DataEntryPage />);
    expect(screen.getByText('Archived Goal')).toBeInTheDocument();
  });

});
