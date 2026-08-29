import type { Loan, LoanType } from '../types';
import type { Farmer } from 'src/sections/farmer/types';
import type { Season, InputOrder } from 'src/sections/input-order/types';

import { z } from 'zod';
import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';

import { Form, Field } from 'src/components/hook-form';

import { FarmerFormDialog } from 'src/sections/farmer/components/farmer-form-dialog';

// ----------------------------------------------------------------------

const LOAN_STATUS_OPTIONS = ['Active', 'Open', 'Closed', 'Cancelled'];

const baseSchema = z.object({
  Farmer: z.string().min(1, { message: 'Required' }),
  'Loan Type': z.string().min(1, { message: 'Required' }),
  'Loan Status': z.string().min(1, { message: 'Required' }),
  'Issue Date': z.date({ message: 'Required' }),
  'Downpayment Due Date': z.date({ message: 'Required' }),
  'Repayment Due Date': z.date({ message: 'Required' }),
  'Orders (Input)': z.string().optional(),
  'Season Cash Advance': z.string().optional(),
  'Amount (cash advance only)': z.number().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

// ----------------------------------------------------------------------

type LoanFormDialogProps = {
  open: boolean;
  loan?: Loan | null;
  fpoId?: string;
  farmers: Farmer[];
  loanTypes: LoanType[];
  inputOrders: InputOrder[];
  seasons: Season[];
  onClose: () => void;
  onSaved: () => void;
  onFarmerCreated?: (farmer: Farmer) => void;
};

function getLoanObject(type: LoanType | undefined) {
  const value = type?.fields['Loan Object'];
  if (Array.isArray(value)) return value[0];
  return value;
}

function getDefaultValues(loan?: Loan | null): FormValues {
  const f = loan?.fields;
  return {
    Farmer: f?.Farmer?.[0] ?? '',
    'Loan Type': f?.['Loan Type']?.[0] ?? '',
    'Loan Status': f?.['Loan Status'] ?? 'Active',
    'Issue Date': f?.['Issue Date'] ? dayjs(f['Issue Date']).toDate() : undefined as any,
    'Downpayment Due Date': f?.['Downpayment Due Date']
      ? dayjs(f['Downpayment Due Date']).toDate()
      : undefined as any,
    'Repayment Due Date': f?.['Repayment Due Date']
      ? dayjs(f['Repayment Due Date']).toDate()
      : undefined as any,
    'Orders (Input)': f?.['Orders (Input)']?.[0] ?? '',
    'Season Cash Advance': f?.['Season Cash Advance']?.[0] ?? '',
    'Amount (cash advance only)': f?.['Amount (cash advance only)'] ?? undefined,
  };
}

export function LoanFormDialog({
  open,
  loan,
  fpoId,
  farmers,
  loanTypes,
  inputOrders,
  seasons,
  onClose,
  onSaved,
  onFarmerCreated,
}: LoanFormDialogProps) {
  const isEdit = Boolean(loan);
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);

  const { t } = useTranslate('loans');
  const { t: tCommon } = useTranslate('common');

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(loan),
    resolver: zodResolver(baseSchema),
  });

  const { reset, setValue, handleSubmit, formState, control } = methods;
  const { isSubmitting } = formState;

  const loanTypeId = useWatch({ control, name: 'Loan Type' });
  const selectedLoanType = loanTypes.find((t) => t.id === loanTypeId);
  const loanObject = getLoanObject(selectedLoanType);
  const isInputLoan = loanObject === 'Input Loan';

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(loan));
    }
  }, [open, loan, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: Record<string, any> = { ...data };

    if (!isEdit && fpoId && !isInputLoan) {
      payload['FPO Cash Advance'] = fpoId;
    }

    // Convert dates to ISO strings.
    if (data['Issue Date']) payload['Issue Date'] = dayjs(data['Issue Date']).format('YYYY-MM-DD');
    if (data['Downpayment Due Date'])
      payload['Downpayment Due Date'] = dayjs(data['Downpayment Due Date']).format('YYYY-MM-DD');
    if (data['Repayment Due Date'])
      payload['Repayment Due Date'] = dayjs(data['Repayment Due Date']).format('YYYY-MM-DD');

    // Drop fields not applicable to this loan type.
    if (isInputLoan) {
      delete payload['Season Cash Advance'];
      delete payload['Amount (cash advance only)'];
      if (!payload['Orders (Input)']) delete payload['Orders (Input)'];
    } else {
      delete payload['Orders (Input)'];
      if (!payload['Season Cash Advance']) delete payload['Season Cash Advance'];
    }

    try {
      if (isEdit && loan) {
        await axios.patch(`/api/v1/loans/${loan.id}`, { fields: payload });
      } else {
        await axios.post('/api/v1/loans', { fields: payload });
      }
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Loan save error:', error?.message);
    }
  });

  const handleNewFarmer = (farmer?: Farmer) => {
    setFarmerFormOpen(false);
    if (farmer) {
      setValue('Farmer', farmer.id, { shouldValidate: true });
      onFarmerCreated?.(farmer);
    }
  };

  const renderSelect = (
    name: keyof FormValues,
    label: string,
    options: { value: string; label: string }[],
    required?: boolean
  ) => (
    <Field.Select name={name} label={label} required={required}>
      <MenuItem value="">
        <em>{t('form.selectPlaceholder')}</em>
      </MenuItem>
      {options.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </Field.Select>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? t('form.title.edit') : t('form.title.new')}</DialogTitle>

      <Form methods={methods} onSubmit={onSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flexGrow: 1 }}>
                  {renderSelect(
                    'Farmer',
                    t('form.farmer'),
                    farmers.map((f) => ({ value: f.id, label: f.fields.Name || 'Unnamed' })),
                    true
                  )}
                </Box>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => setFarmerFormOpen(true)}
                  startIcon={
                    <Box component="span" sx={{ fontSize: 20 }}>
                      +
                    </Box>
                  }
                >
                  {t('form.addNew')}
                </Button>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelect(
                'Loan Type',
                t('form.loanType'),
                loanTypes.map((type) => ({
                  value: type.id,
                  label: getLoanObject(type) || 'Unnamed',
                })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelect(
                'Loan Status',
                t('form.loanStatus'),
                LOAN_STATUS_OPTIONS.map((o) => ({ value: o, label: o })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Field.DatePicker name="Issue Date" label={t('form.issueDate')} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Field.DatePicker
                name="Downpayment Due Date"
                label={t('form.downpaymentDueDate')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Field.DatePicker
                name="Repayment Due Date"
                label={t('form.repaymentDueDate')}
              />
            </Grid>

            {isInputLoan && (
              <Grid size={{ xs: 12 }}>
                {renderSelect(
                  'Orders (Input)',
                  t('form.ordersInput'),
                  inputOrders.map((o) => ({
                    value: o.id,
                    label: o.fields['Order number'] || 'Unnamed',
                  }))
                )}
              </Grid>
            )}

            {!isInputLoan && selectedLoanType && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  {renderSelect(
                    'Season Cash Advance',
                    t('form.seasonCashAdvance'),
                    seasons.map((s) => ({ value: s.id, label: s.fields.Name || 'Unnamed' }))
                  )}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field.Text
                    type="number"
                    name="Amount (cash advance only)"
                    label={t('form.amountCashAdvanceOnly')}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            {tCommon('cancel')}
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {tCommon('save')}
          </LoadingButton>
        </DialogActions>
      </Form>

      <FarmerFormDialog
        open={farmerFormOpen}
        fpoId={fpoId}
        onClose={() => setFarmerFormOpen(false)}
        onSaved={handleNewFarmer}
      />
    </Dialog>
  );
}
