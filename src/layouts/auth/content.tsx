import type { BoxProps } from '@mui/material/Box';

import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';

import { layoutClasses } from '../core';

// ----------------------------------------------------------------------

export type AuthCenteredContentProps = BoxProps;

export function AuthCenteredContent({
  sx,
  children,
  className,
  ...other
}: AuthCenteredContentProps) {
  return (
    <Box
      className={mergeClasses([layoutClasses.content, className])}
      sx={[
        (theme) => ({
          p: 4,
          width: 1,
          zIndex: 2,
          mx: 'auto',
          display: 'flex',
          borderRadius: 3,
          alignSelf: 'center',
          flexDirection: 'column',
          boxShadow: theme.shadows[16],
          maxWidth: 'var(--layout-auth-content-width, 420px)',
          bgcolor: theme.vars.palette.background.paper,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {children}
    </Box>
  );
}
