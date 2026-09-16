import type { ReactNode } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------

type DetailDialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function DetailDialog({ open, onClose, children }: DetailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          '& > .MuiCard-root': {
            flexGrow: 1,
            boxShadow: 'none',
            borderRadius: 0,
          },
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
