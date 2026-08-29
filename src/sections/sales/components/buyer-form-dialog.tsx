import type { Buyer } from '../types';

import { z } from 'zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Grid from '@mui/material/Grid';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import axios from 'src/lib/axios';

import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = z.object({
  Name: z.string().min(1, { message: 'Required' }),
  'TIN Number': z.string().optional(),
  'Contact Name': z.string().optional(),
  Email: z.string().email().optional().or(z.literal('')),
  Phone: z.string().optional(),
  Address: z.string().optional(),
  'Bank Account Number': z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

type BuyerFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (buyer: Buyer) => void;
};

function getDefaultValues(): FormValues {
  return {
    Name: '',
    'TIN Number': '',
    'Contact Name': '',
    Email: '',
    Phone: '',
    Address: '',
    'Bank Account Number': '',
  };
}

export function BuyerFormDialog({ open, onClose, onSaved }: BuyerFormDialogProps) {
  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schema),
  });

  const { reset, handleSubmit, formState } = methods;
  const { isSubmitting } = formState;

  useEffect(() => {
    if (open) reset(getDefaultValues());
  }, [open, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== '' && v !== undefined)
      );
      const { data: res } = await axios.post('/api/v1/buyers', { fields: payload });
      onSaved(res.record);
      onClose();
    } catch (error: any) {
      console.error('Buyer save error:', error?.message);
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add a new buyer</DialogTitle>

      <Form methods={methods} onSubmit={onSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Field.Text name="Name" label="Name" required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="TIN Number" label="TIN Number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Contact Name" label="Contact Name" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Email" label="Email" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Phone" label="Phone" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Field.Text name="Address" label="Address" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Field.Text name="Bank Account Number" label="Bank Account Number" />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            Save
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
