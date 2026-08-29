import type { BoxProps } from '@mui/material/Box';

import { m } from 'framer-motion';
import { useState, useCallback } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';
import { signOut } from 'src/auth/context/action';

// ----------------------------------------------------------------------

export function NavUpgrade({ sx, ...other }: BoxProps) {
  const router = useRouter();
  const { user, checkUserSession } = useAuthContext();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleAccount = () => {
    handleClose();
    router.push(paths.dashboard.fpo.account);
  };

  const handleLogout = useCallback(async () => {
    try {
      handleClose();
      await signOut();
      await checkUserSession?.();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error('Unable to logout!');
    }
  }, [checkUserSession, router]);

  const renderAvatar = (size = 36) => (
    <Avatar
      src={user?.photoURL}
      alt={user?.displayName}
      sx={{
        width: size,
        height: size,
        fontSize: size / 2.25,
        fontWeight: 600,
        color: 'success.darker',
        bgcolor: 'success.lighter',
      }}
    >
      {user?.displayName?.charAt(0).toUpperCase()}
    </Avatar>
  );

  return (
    <Box
      sx={[{ px: 2, pb: 2, pt: 1.5, mt: 'auto' }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <ButtonBase
          onClick={handleOpen}
          sx={{
            gap: 1.5,
            flexGrow: 1,
            minWidth: 0,
            borderRadius: 1.5,
            p: 0.75,
            justifyContent: 'flex-start',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {renderAvatar()}

          <Typography
            variant="subtitle2"
            noWrap
            sx={{ color: 'var(--layout-nav-text-primary-color)' }}
          >
            {user?.displayName}
          </Typography>
        </ButtonBase>

        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            borderRadius: 1,
            bgcolor: 'action.hover',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: (theme) => theme.transitions.create('transform'),
          }}
        >
          <Iconify icon={'solar:double-alt-arrow-up-bold-duotone' as any} width={18} />
        </IconButton>
      </Stack>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: { sx: { width: 300, mt: -1.5, borderRadius: 2 } },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2.5 }}>
          {renderAvatar(48)}

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {user?.displayName}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
              {user?.email}
            </Typography>
          </Box>
        </Stack>

        <Divider />

        <MenuList sx={{ p: 1 }}>
          <MenuItem onClick={handleAccount} sx={{ borderRadius: 1, py: 1 }}>
            <Iconify icon={'solar:settings-bold' as any} width={20} sx={{ mr: 1.5 }} />
            Account settings
          </MenuItem>

          <MenuItem
            onClick={handleLogout}
            sx={{ borderRadius: 1, py: 1, color: 'error.main' }}
          >
            <Iconify icon={'solar:export-bold' as any} width={20} sx={{ mr: 1.5 }} />
            Log out
          </MenuItem>
        </MenuList>
      </Popover>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function UpgradeBlock({ sx, ...other }: BoxProps) {
  return (
    <Box
      sx={[
        (theme) => ({
          ...theme.mixins.bgGradient({
            images: [
              `linear-gradient(135deg, ${varAlpha(theme.vars.palette.error.lightChannel, 0.92)}, ${varAlpha(theme.vars.palette.secondary.darkChannel, 0.92)})`,
              `url(${CONFIG.assetsDir}/assets/background/background-7.webp)`,
            ],
          }),
          px: 3,
          py: 4,
          borderRadius: 2,
          position: 'relative',
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        sx={(theme) => ({
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          borderRadius: 2,
          position: 'absolute',
          border: `solid 3px ${varAlpha(theme.vars.palette.common.whiteChannel, 0.16)}`,
        })}
      />

      <Box
        component={m.img}
        animate={{ y: [12, -12, 12] }}
        transition={{
          duration: 8,
          ease: 'linear',
          repeat: Infinity,
          repeatDelay: 0,
        }}
        alt="Small Rocket"
        src={`${CONFIG.assetsDir}/assets/illustrations/illustration-rocket-small.webp`}
        sx={{
          right: 0,
          width: 112,
          height: 112,
          position: 'absolute',
        }}
      />

      <Box
        sx={{
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <Box component="span" sx={{ typography: 'h5', color: 'common.white' }}>
          35% OFF
        </Box>

        <Box
          component="span"
          sx={{
            mb: 2,
            mt: 0.5,
            color: 'common.white',
            typography: 'subtitle2',
          }}
        >
          Power up Productivity!
        </Box>

        <Button variant="contained" size="small" color="warning">
          Upgrade to Pro
        </Button>
      </Box>
    </Box>
  );
}
