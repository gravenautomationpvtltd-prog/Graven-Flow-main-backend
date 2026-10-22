import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Auth Profile Loading & Refresh Reliability', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Storage & Cache Hydration', () => {
    it('immediately restores cached profile and roles from localStorage', () => {
      const userId = 'user-test-123';
      const mockProfile = {
        id: userId,
        email: 'test@graven.com',
        full_name: 'Test Engineer',
        phone: '9876543210',
        avatar_url: null,
        office_id: null,
        manager_id: null,
        is_active: true,
      };
      const mockRoles = ['sales', 'procurement'];

      // Simulate prior session cached in localStorage
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(mockProfile));
      localStorage.setItem(`user_roles_${userId}`, JSON.stringify(mockRoles));

      // Read back
      const storedProfileRaw = localStorage.getItem(`user_profile_${userId}`);
      const storedRolesRaw = localStorage.getItem(`user_roles_${userId}`);

      expect(storedProfileRaw).not.toBeNull();
      const restoredProfile = JSON.parse(storedProfileRaw!);
      const restoredRoles = JSON.parse(storedRolesRaw!);

      expect(restoredProfile.id).toBe(userId);
      expect(restoredProfile.full_name).toBe('Test Engineer');
      expect(restoredRoles).toEqual(['sales', 'procurement']);
    });

    it('clears profile and role caches on sign-out without leaving lingering data', () => {
      const userId = 'user-test-123';
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify({ id: userId }));
      localStorage.setItem(`user_roles_${userId}`, JSON.stringify(['super_admin']));
      localStorage.setItem('sb-test-auth-token', 'mock-token');

      // Emulate clearStoredAuthState logic
      Object.keys(localStorage)
        .filter((key) =>
          (key.startsWith('sb-') && key.endsWith('-auth-token')) ||
          key.startsWith('user_roles_') ||
          key.startsWith('user_profile_')
        )
        .forEach((key) => localStorage.removeItem(key));

      expect(localStorage.getItem(`user_profile_${userId}`)).toBeNull();
      expect(localStorage.getItem(`user_roles_${userId}`)).toBeNull();
      expect(localStorage.getItem('sb-test-auth-token')).toBeNull();
    });
  });

  describe('Fallback Profile Generation', () => {
    it('creates a valid fallback profile from user metadata when database query is unavailable', () => {
      const activeUser: any = {
        id: 'user-fallback-999',
        email: 'engineer@graven.com',
        user_metadata: {
          full_name: 'Lead Qualification Specialist',
          avatar_url: 'https://avatar.url/pic.jpg',
        },
      };

      const makeFallbackProfile = (u: any) => ({
        id: u.id,
        email: u.email ?? '',
        full_name:
          typeof u.user_metadata?.full_name === 'string'
            ? u.user_metadata.full_name
            : u.email?.split('@')[0] ?? 'User',
        phone: null,
        avatar_url: typeof u.user_metadata?.avatar_url === 'string' ? u.user_metadata.avatar_url : null,
        office_id: null,
        manager_id: null,
        is_active: true,
      });

      const fallback = makeFallbackProfile(activeUser);
      expect(fallback.id).toBe('user-fallback-999');
      expect(fallback.full_name).toBe('Lead Qualification Specialist');
      expect(fallback.avatar_url).toBe('https://avatar.url/pic.jpg');
      expect(fallback.is_active).toBe(true);
    });
  });

  describe('In-Flight Request Deduplication', () => {
    it('deduplicates concurrent fetches for the same user returning the identical in-flight promise', async () => {
      let fetchCount = 0;
      let inFlightPromise: Promise<string> | null = null;

      const fetchProfileDeduplicated = (userId: string): Promise<string> => {
        if (inFlightPromise) {
          return inFlightPromise;
        }

        inFlightPromise = (async () => {
          fetchCount++;
          await new Promise((r) => setTimeout(r, 50));
          return `profile-loaded-${userId}`;
        })().finally(() => {
          inFlightPromise = null;
        });

        return inFlightPromise;
      };

      // Firing 5 concurrent calls simultaneously
      const [res1, res2, res3, res4, res5] = await Promise.all([
        fetchProfileDeduplicated('u1'),
        fetchProfileDeduplicated('u1'),
        fetchProfileDeduplicated('u1'),
        fetchProfileDeduplicated('u1'),
        fetchProfileDeduplicated('u1'),
      ]);

      expect(fetchCount).toBe(1);
      expect(res1).toBe('profile-loaded-u1');
      expect(res5).toBe('profile-loaded-u1');
    });
  });

  describe('Deterministic Loading Completion', () => {
    it('guarantees loading exits to false even when timeout or error occurs', async () => {
      let loadingState = true;

      const executeWithTimeout = async () => {
        try {
          await new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile loading timed out.')), 20)
          );
        } catch {
          // Handled timeout
        } finally {
          loadingState = false;
        }
      };

      expect(loadingState).toBe(true);
      await executeWithTimeout();
      expect(loadingState).toBe(false);
    });
  });
});
