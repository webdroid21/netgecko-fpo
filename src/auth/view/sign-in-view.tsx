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
import { useTranslate } from 'src/locales';

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

type FormValues = {
  email: string;
  phone: string;
  otp: string;
};

export function SignInView() {
  const { t } = useTranslate('auth');
  const { error } = useAuthContext();

  const tabs = useTabs('email');
  const isSubmitting = useBoolean();

  const [otpSent, setOtpSent] = useState(false);
  const [otpSession, setOtpSession] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const methods = useForm<FormValues>({
    defaultValues: { email: '', phone: '', otp: '' },
  });

  const { watch } = methods;
  const email = watch('email');
  const phone = watch('phone');
  const otp = watch('otp');

  const tabOptions = [
    { value: 'email', label: t('emailTab') },
    { value: 'phone', label: t('phoneTab') },
  ];

  useEffect(() => {
    if (isSignInWithEmailLink(AUTH, window.location.href)) {
      const storedEmail = window.localStorage.getItem('emailForSignIn');
      if (storedEmail) {
        handleEmailLinkSignIn(storedEmail);
      } else {
        setLocalError(t('magicLinkMissingEmail'));
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
      // Keep the button loading until the redirect happens.
    } catch (err: any) {
      setLocalError(err?.message || t('failedEmailLink'));
      isSubmitting.onFalse();
    }
  };

  const handleSendMagicLink = async () => {
    setLocalError(null);
    setInfo(null);
    if (!email) {
      setLocalError(t('enterEmail'));
      return;
    }
    isSubmitting.onTrue();
    try {
      const continueUrl = `${window.location.origin}${paths.auth.firebase.signIn}`;
      await sendMagicLink(email, continueUrl);
      setInfo(t('magicLinkSent'));
    } catch (err: any) {
      setLocalError(err?.response?.data?.message || err?.message || t('failedMagicLink'));
    } finally {
      isSubmitting.onFalse();
    }
  };

  const handleSendPhoneOtp = async () => {
    setLocalError(null);
    setInfo(null);
    if (!phone) {
      setLocalError(t('enterPhone'));
      return;
    }
    isSubmitting.onTrue();
    try {
      const session = await sendPhoneOtp(phone);
      setOtpSession(session);
      setOtpSent(true);
      setInfo(t('otpSent'));
    } catch (err: any) {
      setLocalError(err?.response?.data?.message || err?.message || t('failedOtp'));
    } finally {
      isSubmitting.onFalse();
    }
  };

  const handleVerifyOtp = async () => {
    setLocalError(null);
    if (!otpSent) {
      setLocalError(t('requestOtpFirst'));
      return;
    }
    if (otp.length < 6) {
      setLocalError(t('enterOtp'));
      return;
    }
    isSubmitting.onTrue();
    try {
      await verifyPhoneOtp({ phone, otp, otpSession });
      // AuthProvider/GuestGuard will handle the redirect once the session is verified.
      // Keep the button loading until the redirect happens.
    } catch (err: any) {
      setLocalError(err?.response?.data?.message || err?.message || t('invalidOtp'));
      isSubmitting.onFalse();
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    isSubmitting.onTrue();
    try {
      await signInWithGoogle();
      // AuthProvider/GuestGuard will handle the redirect once the session is verified.
      // Keep the button loading until the redirect happens.
    } catch (err: any) {
      setLocalError(err?.message || t('failedGoogle'));
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
            label={t('emailLabel')}
            placeholder={t('emailPlaceholder')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="primary"
            loading={isSubmitting.value}
            onClick={handleSendMagicLink}
          >
            {t('sendLoginLink')}
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
        {otpSent ? (
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
              {t('verifyCode')}
            </Button>
          </>
        ) : (
          <>
            <Field.Phone name="phone" label={t('phoneLabel')} defaultCountry="UG" />
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="inherit"
              loading={isSubmitting.value}
              onClick={handleSendPhoneOtp}
            >
              {t('sendOtp')}
            </Button>
          </>
        )}
      </Box>
    );
  };

  return (
    <>
      <FormHead
        title={t('title')}
        description={t('description')}
        logoWidth={160}
        logoHeight={64}
        sx={{ textAlign: 'center', mb: 3 }}
      />

      {!!(localError || error) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {localError || error}
        </Alert>
      )}

      {!!info && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            color: 'primary.contrastText',
            bgcolor: 'primary.main',
            '& .MuiAlert-icon': { color: 'primary.contrastText' },
            '& .MuiAlert-message': { color: 'primary.contrastText' },
          }}
        >
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
        {tabOptions.map((tab) => (
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
          {t('or')}
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
        {t('signInWithGoogle')}
      </Button>

      <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary', textAlign: 'center' }}>
        {t('noAccess')}
      </Typography>
    </>
  );
}
