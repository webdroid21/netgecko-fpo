import { useState, useEffect } from 'react';
import { isSignInWithEmailLink } from 'firebase/auth';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { MuiOtpInput } from 'mui-one-time-password-input';

import { paths } from 'src/routes/paths';

import { AUTH } from 'src/lib/firebase';

import { useAuthContext } from '../hooks';
import { FormHead } from '../components/form-head';
import {
  signInWithGoogle,
  sendMagicLink,
  completeMagicLinkSignIn,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '../context';

// ----------------------------------------------------------------------

type TabValue = 'email' | 'phone' | 'google';

export function SignInView() {
  const { error } = useAuthContext();

  const [tab, setTab] = useState<TabValue>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const isSubmitting = useBoolean();

  useEffect(() => {
    if (isSignInWithEmailLink(AUTH, window.location.href)) {
      const storedEmail = window.localStorage.getItem('emailForSignIn');
      if (storedEmail) {
        handleEmailLinkSignIn(storedEmail);
      } else {
        setLocalError('Magic link detected but email is missing. Please enter the same email to continue.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailLinkSignIn = async (linkEmail: string) => {
    setLocalError(null);
    isSubmitting.onTrue();
    try {
      await completeMagicLinkSignIn(linkEmail, window.location.href);
      // AuthProvider/GuestGuard will handle the redirect once the session is verified.
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to sign in with email link.');
    } finally {
      isSubmitting.onFalse();
    }
  };

  const handleSendMagicLink = async () => {
    setLocalError(null);
    setInfo(null);
    if (!email) {
      setLocalError('Please enter your email address.');
      return;
    }
    isSubmitting.onTrue();
    try {
      const continueUrl = `${window.location.origin}${paths.auth.firebase.signIn}`;
      await sendMagicLink(email, continueUrl);
      setInfo('A login link has been sent to your email. Open it in this browser to sign in.');
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to send magic link.');
    } finally {
      isSubmitting.onFalse();
    }
  };

  const handleSendPhoneOtp = async () => {
    setLocalError(null);
    setInfo(null);
    if (!phone) {
      setLocalError('Please enter your phone number.');
      return;
    }
    isSubmitting.onTrue();
    try {
      const result = await sendPhoneOtp(phone, 'recaptcha-signin');
      setConfirmation(result);
      setInfo('OTP sent. Please enter the code.');
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to send OTP.');
    } finally {
      isSubmitting.onFalse();
    }
  };

  const handleVerifyOtp = async () => {
    setLocalError(null);
    if (!confirmation) {
      setLocalError('Request OTP first.');
      return;
    }
    if (otp.length < 6) {
      setLocalError('Enter the 6-digit OTP.');
      return;
    }
    isSubmitting.onTrue();
    try {
      await verifyPhoneOtp({ confirmationResult: confirmation, otp });
      // AuthProvider/GuestGuard will handle the redirect once the session is verified.
    } catch (err: any) {
      setLocalError(err?.message || 'Invalid OTP.');
    } finally {
      isSubmitting.onFalse();
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    isSubmitting.onTrue();
    try {
      await signInWithGoogle();
      // AuthProvider/GuestGuard will handle the redirect once the session is verified.
    } catch (err: any) {
      setLocalError(err?.message || 'Google sign in failed.');
    } finally {
      isSubmitting.onFalse();
    }
  };

  const renderTabContent = () => {
    if (tab === 'email') {
      return (
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <TextField
            fullWidth
            type="email"
            label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="inherit"
            loading={isSubmitting.value}
            onClick={handleSendMagicLink}
          >
            Send login link
          </Button>
        </Box>
      );
    }

    if (tab === 'phone') {
      return (
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          {confirmation ? (
            <>
              <MuiOtpInput
                value={otp}
                onChange={(value) => setOtp(value ?? '')}
                length={6}
              />
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="inherit"
                loading={isSubmitting.value}
                onClick={handleVerifyOtp}
              >
                Verify OTP
              </Button>
            </>
          ) : (
            <>
              <TextField
                fullWidth
                type="tel"
                label="Phone number"
                placeholder="+256700000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <div id="recaptcha-signin" />
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="inherit"
                loading={isSubmitting.value}
                onClick={handleSendPhoneOtp}
              >
                Send OTP
              </Button>
            </>
          )}
        </Box>
      );
    }

    return (
      <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
        <Button
          fullWidth
          size="large"
          variant="outlined"
          color="inherit"
          loading={isSubmitting.value}
          onClick={handleGoogle}
        >
          Sign in with Google
        </Button>
      </Box>
    );
  };

  return (
    <>
      <FormHead
        title="Sign in to FPO App"
        description="Choose how you want to sign in."
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {!!(localError || error) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {localError || error}
        </Alert>
      )}

      {!!info && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {info}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_e, value) => setTab(value)}
        variant="fullWidth"
        sx={{ mb: 3 }}
      >
        <Tab value="email" label="Email" />
        <Tab value="phone" label="Phone" />
        <Tab value="google" label="Google" />
      </Tabs>

      {renderTabContent()}

      <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary', textAlign: 'center' }}>
        Don&apos;t have access? Contact the system admin.
      </Typography>
    </>
  );
}
