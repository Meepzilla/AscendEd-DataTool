import { render, screen } from '@testing-library/react';
import { useAuth } from '@/hooks/use-auth';
import Page from './page';
import { useRouter } from 'next/navigation';

jest.mock('@/hooks/use-auth');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('Page', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockUseRouter = useRouter as jest.Mock;
  const mockPush = jest.fn();

  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: mockPush,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading skeleton when loading', () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      user: null,
    });

    render(<Page />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('should redirect to dashboard when loading is complete and user is logged in', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'test-user' },
    });

    render(<Page />);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('should redirect to login when loading is complete and no user is logged in', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: null,
    });

    render(<Page />);

    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});