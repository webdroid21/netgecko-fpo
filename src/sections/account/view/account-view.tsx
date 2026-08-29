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

import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { useAuthContext } from 'src/auth/hooks';
import { changePassword, updateUserProfile } from 'src/auth/context/action';

// ----------------------------------------------------------------------

const profileSchema = z.object({
  displayName: z.string().min(1, { message: 'Name is required' }),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required' }),
    newPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string().min(1, { message: 'Please confirm your new password' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

// ----------------------------------------------------------------------

export function AccountView() {
  const { user, activeFbo, checkUserSession } = useAuthContext();

  const profileMethods = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { displayName: user?.displayName ?? '' },
  });

  const passwordMethods = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSaveProfile = profileMethods.handleSubmit(async (data) => {
    try {
      await updateUserProfile({ displayName: data.displayName });
      await checkUserSession?.();
      toast.success('Profile updated!');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Unable to update profile.');
    }
  });

  const onChangePassword = passwordMethods.handleSubmit(async (data) => {
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordMethods.reset();
      toast.success('Password changed!');
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect.');
      } else {
        toast.error(error?.message || 'Unable to change password.');
      }
    }
  });

  return (
    <DashboardContent maxWidth="lg">
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Account Settings
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
        Manage your profile details and login credentials
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
              FPO memberships
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
                title="Profile"
                subheader="Your display name is shown across the app"
                avatar={<Iconify icon={'solar:user-rounded-bold' as any} width={24} />}
              />
              <CardContent>
                <Form methods={profileMethods} onSubmit={onSaveProfile}>
                  <Stack spacing={3}>
                    <Field.Text name="displayName" label="Display name" />

                    <TextField
                      label="Email address"
                      value={user?.email ?? ''}
                      disabled
                      fullWidth
                      helperText="Your email is used to sign in and cannot be changed here."
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <LoadingButton
                        type="submit"
                        variant="contained"
                        loading={profileMethods.formState.isSubmitting}
                      >
                        Save changes
                      </LoadingButton>
                    </Box>
                  </Stack>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Change password"
                subheader="Choose a strong password of at least 6 characters"
                avatar={<Iconify icon={'solar:shield-check-bold' as any} width={24} />}
              />
              <CardContent>
                <Form methods={passwordMethods} onSubmit={onChangePassword}>
                  <Stack spacing={3}>
                    <Field.Text
                      name="currentPassword"
                      label="Current password"
                      type="password"
                    />
                    <Field.Text name="newPassword" label="New password" type="password" />
                    <Field.Text
                      name="confirmPassword"
                      label="Confirm new password"
                      type="password"
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <LoadingButton
                        type="submit"
                        variant="contained"
                        loading={passwordMethods.formState.isSubmitting}
                      >
                        Update password
                      </LoadingButton>
                    </Box>
                  </Stack>
                </Form>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
