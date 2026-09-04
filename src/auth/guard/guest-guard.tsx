import { useState, useEffect } from 'react';
import { safeReturnUrl } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { useSearchParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { Logo } from 'src/components/logo';
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
      setIsChecking(true);
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

  // User exists but has no FBO (Partner) assigned
  if (user && user.fbos.length === 0) {
    return (
      <Stack
        spacing={3}
        alignItems="center"
        justifyContent="center"
        sx={{ p: 4, textAlign: 'center' }}
      >
        <Logo width={160} height={64} />

        <Typography variant="h5">No access</Typography>

        <Typography variant="body2" color="text.secondary">
          There is no Partner assigned to your profile. Please contact{' '}
          <Link href="mailto:support@netgecko.net">support@netgecko.net</Link> to gain access.
        </Typography>

        <Button
          fullWidth
          size="large"
          color="primary"
          variant="contained"
          href="mailto:support@netgecko.net"
        >
          Contact support
        </Button>
      </Stack>
    );
  }

  return <>{children}</>;
}
