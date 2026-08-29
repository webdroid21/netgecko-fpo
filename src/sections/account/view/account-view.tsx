import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';
import { getSignInMethods } from 'src/auth/context/action';

// ----------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  phone: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

// ----------------------------------------------------------------------

function SignInMethodRow({
  icon,
  titleKey,
  description,
  connected,
}: {
  icon: string;
  titleKey: string;
  description: string;
  connected: boolean;
}) {
  const { t } = useTranslate('account');

  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1.5 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: 'flex',
          borderRadius: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          color: connected ? 'success.dark' : 'text.disabled',
          bgcolor: (theme) =>
            connected ? theme.vars.palette.success.lighter : theme.vars.palette.action.hover,
        }}
      >
        <Iconify icon={icon as any} width={24} />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2">{t(titleKey)}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {description}
        </Typography>
      </Box>

      <Label color={connected ? 'success' : 'default'}>
        {connected ? t('connected') : t('notConnected')}
      </Label>
    </Stack>
  );
}

// ----------------------------------------------------------------------

export function AccountView() {
  const { t } = useTranslate('account');
  const { user, activeFbo, checkUserSession } = useAuthContext();

  const methods = getSignInMethods();

  const profileMethods = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? '', phone: user?.phone ?? '' },
  });

  const onSaveProfile = profileMethods.handleSubmit(async (data) => {
    try {
      await axios.patch('/api/v1/auth/profile', {
        name: data.name,
        phone: data.phone ?? '',
      });
      await checkUserSession?.();
      toast.success(t('updateSuccess'));
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || t('updateError'));
    }
  });

  const googleEmail = user?.email ? ` (${user.email})` : '';
  const phoneText = user?.phone
    ? t('phoneOtpDescription', { phone: user.phone })
    : t('phoneOtpPlaceholder');

  return (
    <DashboardContent maxWidth="lg">
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        {t('title')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
        {t('subtitle')}
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              src={user?.photoURL}
              alt={user?.displayName}
              sx={{
                mx: 'auto',
                width: 96,
                height: 96,
                fontSize: 40,
                fontWeight: 600,
                color: 'success.darker',
                bgcolor: 'success.lighter',
              }}
            >
              {user?.displayName?.charAt(0).toUpperCase()}
            </Avatar>

            <Typography variant="h6" sx={{ mt: 2 }}>
              {user?.displayName}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {user?.email}
            </Typography>

            {user?.role && (
              <Label color="info" sx={{ mt: 1.5 }}>
                {user.role}
              </Label>
            )}

            <Divider sx={{ my: 3, borderStyle: 'dashed' }} />

            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              {t('fpoMemberships')}
            </Typography>

            <Stack
              direction="row"
              flexWrap="wrap"
              justifyContent="center"
              spacing={1}
              sx={{ mt: 1.5 }}
            >
              {user?.fbos.map((fbo) => (
                <Chip
                  key={fbo.id}
                  label={fbo.name}
                  size="small"
                  color={fbo.id === activeFbo?.id ? 'primary' : 'default'}
                  variant={fbo.id === activeFbo?.id ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            <Card>
              <CardHeader
                title={t('profile')}
                subheader={t('profileSubheader')}
                avatar={<Iconify icon={'solar:user-rounded-bold' as any} width={24} />}
              />
              <CardContent>
                <Form methods={profileMethods} onSubmit={onSaveProfile}>
                  <Stack spacing={3}>
                    <Field.Text name="name" label={t('fullName')} />

                    <Field.Text
                      name="phone"
                      label={t('phoneNumber')}
                      placeholder="+256..."
                    />

                    <TextField
                      label={t('email')}
                      value={user?.email ?? ''}
                      disabled
                      fullWidth
                      helperText={t('emailHelper')}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <LoadingButton
                        type="submit"
                        variant="contained"
                        loading={profileMethods.formState.isSubmitting}
                      >
                        {t('save')}
                      </LoadingButton>
                    </Box>
                  </Stack>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title={t('signInMethods')}
                subheader={t('signInMethodsSubheader')}
                avatar={<Iconify icon={'solar:shield-check-bold' as any} width={24} />}
              />
              <CardContent>
                <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
                  <SignInMethodRow
                    icon="solar:check-circle-bold"
                    titleKey="google"
                    description={t('googleDescription', { email: googleEmail })}
                    connected={methods.google}
                  />
                  <SignInMethodRow
                    icon="solar:letter-bold"
                    titleKey="emailLink"
                    description={t('emailLinkDescription')}
                    connected={methods.emailLink || Boolean(user?.email)}
                  />
                  <SignInMethodRow
                    icon="solar:phone-bold"
                    titleKey="phoneOtp"
                    description={phoneText}
                    connected={methods.phone}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
