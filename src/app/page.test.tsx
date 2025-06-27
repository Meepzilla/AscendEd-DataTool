import { render, screen } from '@testing-library/react';
import { useAuth } from '@/hooks/use-auth';
import HomePage from './page';
import { useRouter } from 'next/navigation';

jest.mock('@/hooks/use-auth');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('HomePage', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockUseRouter = useRouter as jest.Mock;
  const mockReplace = jest.fn();

  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      replace: mockReplace,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading message when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      loading: true,
      currentUser: null,
    });

    render(<HomePage />);

    expect(screen.getByTestId('loading-message')).toBeInTheDocument();
    expect(screen.getByText('Loading application, please wait...')).toBeInTheDocument();
  });

  it('should not redirect when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      loading: true,
      currentUser: null,
    });

    render(<HomePage />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('should redirect to dashboard when loading is complete and user is logged in', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      currentUser: { id: 'test-user' },
    });

    render(<HomePage />);

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('should redirect to login when loading is complete and no user is logged in', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      currentUser: null,
    });

    render(<HomePage />);

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
