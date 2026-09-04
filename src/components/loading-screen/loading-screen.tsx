import type { Theme, SxProps } from '@mui/material/styles';
import type { LinearProgressProps } from '@mui/material/LinearProgress';

import { Fragment } from 'react';

import Stack from '@mui/material/Stack';
import Portal from '@mui/material/Portal';
import { styled } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';

import { Logo } from 'src/components/logo';

// ----------------------------------------------------------------------

export type LoadingScreenProps = React.ComponentProps<'div'> & {
  portal?: boolean;
  sx?: SxProps<Theme>;
  slots?: {
    logo?: React.ReactNode;
    progress?: React.ReactNode;
  };
  slotsProps?: {
    progress?: LinearProgressProps;
  };
};

export function LoadingScreen({ portal, slots, slotsProps, sx, ...other }: LoadingScreenProps) {
  const PortalWrapper = portal ? Portal : Fragment;

  return (
    <PortalWrapper>
      <LoadingContent sx={sx} {...other}>
        <Stack spacing={3} alignItems="center" justifyContent="center" width={1}>
          {slots?.logo ?? <Logo width={160} height={64} disabled />}

          {slots?.progress ?? (
            <LinearProgress
              color="inherit"
              sx={[
                { width: 1, maxWidth: 360 },
                ...(Array.isArray(slotsProps?.progress?.sx)
                  ? slotsProps.progress.sx
                  : [slotsProps?.progress?.sx]),
              ]}
              {...slotsProps?.progress}
            />
          )}
        </Stack>
      </LoadingContent>
    </PortalWrapper>
  );
}

// ----------------------------------------------------------------------

const LoadingContent = styled('div')(({ theme }) => ({
  flexGrow: 1,
  width: '100%',
  display: 'flex',
  minHeight: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: theme.spacing(5),
  paddingRight: theme.spacing(5),
}));
