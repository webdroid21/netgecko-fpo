import type { FboType, UserType, AuthState } from '../types';

import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';
import { getIdToken, onAuthStateChanged } from 'firebase/auth';

import axios from 'src/lib/axios';
import { AUTH } from 'src/lib/firebase';

import { signOut } from './action';
import { AuthContext } from './auth-context';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

function getErrorMessage(error: any): string {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.data?.error) return error.response.data.error;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}

export function AuthProvider({ children }: Props) {
  const { state, setState } = useSetState<AuthState>({
    user: null,
    activeFbo: null,
    loading: true,
    error: null,
  });

  const selectFbo = useCallback(
    (fbo: FboType) => {
      window.localStorage.setItem('activeFboId', fbo.id);
      setState({ activeFbo: fbo });
    },
    [setState]
  );

  const verifyUser = useCallback(
    async (firebaseUser: any) => {
      try {
        const idToken = await getIdToken(firebaseUser, true);
        localStorage.setItem('firebaseIdToken', idToken);
        axios.defaults.headers.common.Authorization = `Bearer ${idToken}`;

        const response = await axios.post('/api/v1/auth/verify', {}, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const user = response.data.user as UserType;

        if (!user) throw new Error('User verification failed.');

        const enrichedUser: UserType = {
          ...user,
          displayName: user.displayName || user.name,
          photoURL: user.photoURL || '',
        };

        const storedFboId = window.localStorage.getItem('activeFboId');

        const activeFbo =
          enrichedUser.fbos.length === 1
            ? enrichedUser.fbos[0]
            : enrichedUser.fbos.find((fbo) => fbo.id === storedFboId) || null;

        setState({ user: enrichedUser, activeFbo, loading: false, error: null });
      } catch (error) {
        console.error('Auth verify error:', error);
        const message = getErrorMessage(error);
        await signOut();
        localStorage.removeItem('firebaseIdToken');
        delete axios.defaults.headers.common.Authorization;
        setState({ user: null, activeFbo: null, loading: false, error: message });
      }
    },
    [setState]
  );

  const checkUserSession = useCallback(async () => {
    onAuthStateChanged(AUTH, async (firebaseUser) => {
      if (firebaseUser) {
        await verifyUser(firebaseUser);
      } else {
        localStorage.removeItem('firebaseIdToken');
        localStorage.removeItem('activeFboId');
        delete axios.defaults.headers.common.Authorization;
        setState({ user: null, activeFbo: null, loading: false, error: null });
      }
    });
  }, [setState, verifyUser]);

  useEffect(() => {
    const storedToken = localStorage.getItem('firebaseIdToken');
    if (storedToken) {
      axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
    }
    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------------

  const authenticated = !!state.user && !!state.activeFbo;
  const status = state.loading ? 'loading' : authenticated ? 'authenticated' : 'unauthenticated';

  const memoizedValue = useMemo(
    () => ({
      user: state.user,
      activeFbo: state.activeFbo,
      error: state.error,
      selectFbo,
      checkUserSession,
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
    }),
    [state.user, state.activeFbo, state.error, selectFbo, checkUserSession, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
