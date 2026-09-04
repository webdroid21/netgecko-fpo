import type { BoxProps } from '@mui/material/Box';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { Logo } from 'src/components/logo';

// ----------------------------------------------------------------------

type FormHeadProps = BoxProps & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  logoWidth?: number;
  logoHeight?: number;
};

export function FormHead({
  sx,
  icon,
  title,
  description,
  logoWidth,
  logoHeight,
  ...other
}: FormHeadProps) {
  return (
    <>
      {icon && (
        <Box component="span" sx={{ mb: 3, mx: 'auto', display: 'inline-flex' }}>
          {icon}
        </Box>
      )}

      <Box
        sx={[
          () => ({
            mb: 5,
            gap: 1.5,
            display: 'flex',
            textAlign: 'center',
            whiteSpace: 'pre-line',
            flexDirection: 'column',
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        <Box sx={{ display: 'flex', width: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Logo width={logoWidth} height={logoHeight} />
        </Box>

        <Typography variant="h5">{title}</Typography>

        {description && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {description}
          </Typography>
        )}
      </Box>
    </>
  );
}
