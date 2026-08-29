import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { isSignInWithEmailLink } from 'firebase/auth';
import { useTabs, useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { AUTH } from 'src/lib/firebase';

import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from '../hooks';
import { FormHead } from '../components/form-head';
import {
  sendPhoneOtp,
  sendMagicLink,
  verifyPhoneOtp,
  signInWithGoogle,
  completeMagicLinkSignIn,
} from '../context';

// ----------------------------------------------------------------------

const TABS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

type FormValues = {
  email: string;
  phone: string;
  otp: string;
};

export function SignInView() {
  const { error } = useAuthContext();

  const tabs = useTabs('email');
  const isSubmitting = useBoolean();

  const [confirmation, setConfirmation] = useState<any>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const methods = useForm<FormValues>({
    defaultValues: { email: '', phone: '', otp: '' },
  });

  const { watch } = methods;
  const email = watch('email');
  const phone = watch('phone');
  const otp = watch('otp');

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
    if (tabs.value === 'email') {
      return (
        <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
          <Field.Text
            name="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
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

    return (
      <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
        {confirmation ? (
          <>
            <Field.Code name="otp" length={6} />
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="inherit"
              loading={isSubmitting.value}
              onClick={handleVerifyOtp}
            >
              Verify code
            </Button>
          </>
        ) : (
          <>
            <Field.Phone name="phone" label="Phone number" defaultCountry="UG" />
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
  };

  return (
    <>
      <FormHead
        title="Sign in"
        description="Access your FPO dashboard"
        sx={{ textAlign: 'center', mb: 3 }}
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
        value={tabs.value}
        onChange={tabs.onChange}
        variant="fullWidth"
        indicatorColor="custom"
        sx={{ borderRadius: 1, mb: 3 }}
      >
        {TABS.map((tab) => (
          <Tab key={tab.value} value={tab.value} label={tab.label} />
        ))}
      </Tabs>

      <Form methods={methods} onSubmit={() => {}}>
        {renderTabContent()}
      </Form>

      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ my: 3 }}
      >
        <Divider sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          or
        </Typography>
        <Divider sx={{ flex: 1 }} />
      </Stack>

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

      <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary', textAlign: 'center' }}>
        Don&apos;t have access? Contact the system admin.
      </Typography>
    </>
  );
}
