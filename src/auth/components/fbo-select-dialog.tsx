import type { FboType } from '../types';

import List from '@mui/material/List';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import ListItemButton from '@mui/material/ListItemButton';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

type FboSelectDialogProps = {
  open: boolean;
};

export function FboSelectDialog({ open }: FboSelectDialogProps) {
  const { user, selectFbo } = useAuthContext();

  if (!user) return null;

  const handleSelect = (fbo: FboType) => {
    selectFbo(fbo);
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      onClose={(_event, _reason) => {
        // prevent closing without selection
      }}
    >
      <DialogTitle>Select NetGecko Partner to manage</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Your profile has access to multiple NetGecko Partners. Please choose one to continue.
        </Typography>

        <List>
          {user.fbos.map((fbo) => (
            <ListItemButton
              key={fbo.id}
              onClick={() => handleSelect(fbo)}
              sx={{ justifyContent: 'space-between' }}
            >
              <ListItemText primary={fbo.name} />
              <Typography variant="body2" color="primary" sx={{ fontWeight: 'fontWeightMedium' }}>
                Select
              </Typography>
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
