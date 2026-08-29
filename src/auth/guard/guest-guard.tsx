import { useState, useEffect } from 'react';
import { safeReturnUrl } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';

import { useSearchParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';
import { FboSelectDialog } from '../components/fbo-select-dialog';

// ----------------------------------------------------------------------

type GuestGuardProps = {
  children: React.ReactNode;
};

export function GuestGuard({ children }: GuestGuardProps) {
  const { loading, authenticated, user } = useAuthContext();

  const [isChecking, setIsChecking] = useState(true);

  const searchParams = useSearchParams();
  const redirectUrl = safeReturnUrl(searchParams.get('returnTo'), CONFIG.auth.redirectPath);

  const checkPermissions = async (): Promise<void> => {
    if (loading) {
      return;
    }

    if (authenticated) {
      // Redirect authenticated users to the returnTo path
      // Using `window.location.href` instead of `router.replace` to avoid unnecessary re-rendering
      // that might be caused by the AuthGuard component
      window.location.href = redirectUrl;
      return;
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, loading]);

  if (isChecking) {
    return <SplashScreen />;
  }

  // User exists but has multiple FBOs and none selected yet
  if (user && user.fbos.length > 1) {
    return (
      <Box sx={{ p: 4 }}>
        <FboSelectDialog open />
      </Box>
    );
  }

  // User exists but has no FBO assigned
  if (user && user.fbos.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          No FBO is assigned to your profile. Please contact the system admin to gain access.
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
