import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the db service module
vi.mock('@/services/db', () => ({
  initDatabase: vi.fn().mockResolvedValue({}),
  databaseExists: vi.fn().mockResolvedValue(false),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
  saveSettings: vi.fn().mockResolvedValue({ id: 'settings', setupComplete: true }),
  getSettings: vi.fn().mockResolvedValue({ id: 'settings', setupComplete: true }),
}));

// T018: Tests for auth state management
describe('useAuth Hook', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear localStorage between tests
    localStorage.clear();

    // Reset the module cache to get fresh state
    vi.resetModules();

    // Re-setup the db mock with fresh functions
    const { databaseExists, getSettings } = await import('@/services/db');
    vi.mocked(databaseExists).mockResolvedValue(false);
    vi.mocked(getSettings).mockResolvedValue(null);
  });

  describe('Initial State', () => {
    it('should start with isLoading true', async () => {
      const { useAuth } = await import('@/hooks/useAuth');
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
    });

    it('should determine isFirstTime based on salt existence', async () => {
      const { useAuth } = await import('@/hooks/useAuth');

      // No salt = first time
      const { result } = renderHook(() => useAuth());
      // After loading completes, should be first time
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Password Setup', () => {
    it('should setup password and create salt', async () => {
      const { useAuth } = await import('@/hooks/useAuth');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.setupPassword('test-password-123');
      });

      // Should have stored salt
      expect(localStorage.getItem('reflekt_salt')).toBeTruthy();
    });

    it('should authenticate after setup', async () => {
      const { useAuth } = await import('@/hooks/useAuth');
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.setupPassword('test-password');
      });

      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Password Unlock', () => {
    it('should unlock with correct password when settings exist', async () => {
      // Mock getSettings to return valid settings
      const { getSettings } = await import('@/services/db');
      vi.mocked(getSettings).mockResolvedValue({
        id: 'settings',
        setupComplete: true,
        timezone: 'UTC',
        createdAt: Date.now(),
      });

      const { useAuth } = await import('@/hooks/useAuth');
      const { result } = renderHook(() => useAuth());

      // Setup first
      await act(async () => {
        await result.current.setupPassword('my-password');
      });

      // Simulate logout
      act(() => {
        result.current.lock();
      });

      expect(result.current.isAuthenticated).toBe(false);

      // Unlock - should succeed when getSettings returns valid data
      await act(async () => {
        const success = await result.current.unlock('my-password');
        expect(success).toBe(true);
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should fail to unlock when no salt exists', async () => {
      const { useAuth } = await import('@/hooks/useAuth');
      const { result } = renderHook(() => useAuth());

      // Don't setup, just try to unlock
      // No salt in localStorage
      await act(async () => {
        const success = await result.current.unlock('any-password');
        expect(success).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('No password has been set up');
    });
  });

  describe('Lock', () => {
    it('should clear authentication on lock', async () => {
      const { useAuth } = await import('@/hooks/useAuth');
      const { result } = renderHook(() => useAuth());

      // Setup and authenticate
      await act(async () => {
        await result.current.setupPassword('password');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Lock
      act(() => {
        result.current.lock();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
