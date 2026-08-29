import type { Payment } from '../types';
import type { Loan } from 'src/sections/loan/types';

import { z } from 'zod';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Grid from '@mui/material/Grid';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import axios from 'src/lib/axios';

import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const SOURCE_OPTIONS = [
  'BOA Merchant Airtel',
  'BOA Merchant MTN',
  'BOA Bank account',
  'Deduct from FPO guarantee',
];

const schema = z.object({
  Loans: z.string().min(1, { message: 'Required' }),
  Source: z.string().min(1, { message: 'Required' }),
  'Payment Amount (UGX)': z.number(),
  'Payment Date': z.date({ message: 'Required' }),
  'Payment reference': z.string().optional(),
  'Mobile Money Number Used': z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

type PaymentFormDialogProps = {
  open: boolean;
  payment?: Payment | null;
  loans: Loan[];
  onClose: () => void;
  onSaved: () => void;
};

function getDefaultValues(payment?: Payment | null): FormValues {
  const f = payment?.fields;
  return {
    Loans: f?.Loans?.[0] ?? '',
    Source: f?.Source ?? '',
    'Payment Amount (UGX)': f?.['Payment Amount (UGX)'] ?? undefined,
    'Payment Date': f?.['Payment Date'] ? dayjs(f['Payment Date']).toDate() : (undefined as any),
    'Payment reference': f?.['Payment reference'] ?? '',
    'Mobile Money Number Used': f?.['Mobile Money Number Used'] ?? '',
  };
}

export function PaymentFormDialog({ open, payment, loans, onClose, onSaved }: PaymentFormDialogProps) {
  const isEdit = Boolean(payment);

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(payment),
    resolver: zodResolver(schema),
  });

  const { reset, handleSubmit, formState } = methods;
  const { isSubmitting } = formState;

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(payment));
    }
  }, [open, payment, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: Record<string, any> = { ...data };

    if (data['Payment Date']) {
      payload['Payment Date'] = dayjs(data['Payment Date']).format('YYYY-MM-DD');
    }

    try {
      if (isEdit && payment) {
        await axios.patch(`/api/v1/payments/${payment.id}`, { fields: payload });
      } else {
        await axios.post('/api/v1/payments', { fields: payload });
      }
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Payment save error:', error?.message);
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? 'Edit payment' : 'Enter a new payment'}</DialogTitle>

      <Form methods={methods} onSubmit={onSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Field.Select name="Loans" label="Loan" required>
                <MenuItem value="">
                  <em>Select...</em>
                </MenuItem>
                {loans.map((loan) => (
                  <MenuItem key={loan.id} value={loan.id}>
                    {loan.fields['Loan ID'] || 'Unnamed'} ·{' '}
                    {(loan.fields['Name (from Farmer)'] || []).join(', ')}
                  </MenuItem>
                ))}
              </Field.Select>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Select name="Source" label="Source" required>
                <MenuItem value="">
                  <em>Select...</em>
                </MenuItem>
                {SOURCE_OPTIONS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </Field.Select>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Payment Amount (UGX)"
                label="Payment Amount (UGX)"
                required
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.DatePicker name="Payment Date" label="Payment Date" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Payment reference" label="Payment reference" />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Field.Text name="Mobile Money Number Used" label="Mobile Money Number Used" />
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
