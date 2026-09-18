import type { SalesOrder } from '../types';
import type { Crop } from 'src/sections/land/types';
import type { Farmer } from 'src/sections/farmer/types';
import type { Season } from 'src/sections/input-order/types';

import { z } from 'zod';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import useMediaQuery from '@mui/material/useMediaQuery';

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';

import { Form, Field } from 'src/components/hook-form';

import { FarmerFormDialog } from 'src/sections/farmer/components/farmer-form-dialog';

// ----------------------------------------------------------------------

const schema = z.object({
  Farmers: z.string().min(1, { message: 'Required' }),
  Season: z.string().min(1, { message: 'Required' }),
  Product: z.string().min(1, { message: 'Required' }),
  'Date Received': z.date({ message: 'Required' }),
  'Quantity (kg)': z.number().min(1, { message: 'Required' }),
  'Price per Quantity (UGX)': z.number().min(1, { message: 'Required' }),
  'Transport Fee (UGX)': z.number().optional(),
  'Other Fee (UGX)': z.number().optional(),
  'Amount Cash': z.number().optional(),
  'Amount Mobile Money?': z.number().optional(),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

type SalesFormDialogProps = {
  open: boolean;
  order?: SalesOrder | null;
  fpoId?: string;
  farmers: Farmer[];
  crops: Crop[];
  seasons: Season[];
  onClose: () => void;
  onSaved: () => void;
  onFarmerCreated?: (farmer: Farmer) => void;
};

function SectionHeader({ title }: { title: string }) {
  return (
    <Grid size={{ xs: 12 }}>
      <Typography variant="subtitle2" sx={{ pt: 1, color: 'primary.main' }}>
        {title}
      </Typography>
      <Divider sx={{ mt: 0.5 }} />
    </Grid>
  );
}

function getDefaultValues(order?: SalesOrder | null): FormValues {
  const f = order?.fields;
  return {
    Farmers: f?.Farmers?.[0] ?? '',
    Season: f?.Season?.[0] ?? '',
    Product: f?.Product?.[0] ?? '',
    'Date Received': f?.['Date Received'] ? dayjs(f['Date Received']).toDate() : (undefined as any),
    'Quantity (kg)': f?.['Quantity (kg)'] ?? undefined,
    'Price per Quantity (UGX)': f?.['Price per Quantity (UGX)'] ?? undefined,
    'Transport Fee (UGX)': f?.['Transport Fee (UGX)'] ?? undefined,
    'Other Fee (UGX)': f?.['Other Fee (UGX)'] ?? undefined,
    'Amount Cash': f?.['Amount Cash'] ?? undefined,
    'Amount Mobile Money?': f?.['Amount Mobile Money?'] ?? undefined,
  };
}

export function SalesFormDialog({
  open,
  order,
  fpoId,
  farmers,
  crops,
  seasons,
  onClose,
  onSaved,
  onFarmerCreated,
}: SalesFormDialogProps) {
  const isEdit = Boolean(order);
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);

  const { t } = useTranslate('sales');
  const { t: tCommon } = useTranslate('common');

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(order),
    resolver: zodResolver(schema),
  });

  const { reset, watch, setValue, handleSubmit, formState } = methods;
  const { isSubmitting } = formState;

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(order));
    }
  }, [open, order, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: Record<string, any> = { ...data };

    if (data['Date Received']) {
      payload['Date Received'] = dayjs(data['Date Received']).format('YYYY-MM-DD');
    }

    if (!isEdit && fpoId) {
      payload.FPOs = fpoId;
    }

    try {
      if (isEdit && order) {
        await axios.patch(`/api/v1/sales-orders/${order.id}`, { fields: payload });
      } else {
        await axios.post('/api/v1/sales-orders', { fields: payload });
      }
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Sales order save error:', error?.message);
    }
  });

  const handleNewFarmer = (farmer?: Farmer) => {
    setFarmerFormOpen(false);
    if (farmer) {
      setValue('Farmers', farmer.id, { shouldValidate: true });
      onFarmerCreated?.(farmer);
    }
  };

  // Airtable computes {Total Price} = {Price per Quantity} * {Quantity} — show a
  // live preview while the user types; the value itself is never submitted.
  const totalPrice =
    (Number(watch('Price per Quantity (UGX)')) || 0) * (Number(watch('Quantity (kg)')) || 0);

  const renderAutocomplete = (
    name: keyof FormValues,
    label: string,
    options: { value: string; label: string }[],
    required?: boolean
  ) => (
    <Field.Autocomplete
      name={name}
      label={label}
      options={options}
      getOptionLabel={(opt: any) => opt?.label ?? ''}
      isOptionEqualToValue={(a: any, b: any) => a?.value === b?.value}
      value={options.find((o) => o.value === watch(name)) ?? null}
      onChange={(_e: any, opt: any) => setValue(name, opt?.value ?? '', { shouldValidate: true })}
      slotProps={{ textField: { required } }}
    />
  );

  const form = (
    <Form methods={methods} onSubmit={onSubmit}>
      <DialogContent dividers>
          <Grid container spacing={2}>
            <SectionHeader title={t('sections.order')} />

            <Grid size={{ xs: 12 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flexGrow: 1 }}>
                  {renderAutocomplete(
                    'Farmers',
                    t('form.farmer'),
                    farmers.map((f) => ({
                      value: f.id,
                      label:
                        `${f.fields['Given Name'] || ''} ${f.fields.Surname || ''}`.trim() ||
                        f.fields.Name ||
                        'Unnamed',
                    })),
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
              {renderAutocomplete(
                'Season',
                t('form.season'),
                seasons.map((s) => ({ value: s.id, label: s.fields.Name || 'Unnamed' })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.DatePicker
                name="Date Received"
                label={t('form.dateReceived')}
                slotProps={{ textField: { required: true } }}
              />
            </Grid>

            <SectionHeader title={t('sections.product')} />

            <Grid size={{ xs: 12, md: 6 }}>
              {renderAutocomplete(
                'Product',
                t('form.product'),
                crops.map((c) => ({
                  value: c.id,
                  label: c.fields['Crop Name'] ?? c.fields['Product Name'] ?? 'Unnamed',
                })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Quantity (kg)"
                label={t('form.quantityKg')}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Price per Quantity (UGX)"
                label={t('form.pricePerQuantity')}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={t('form.totalPrice')}
                value={totalPrice ? fNumber(totalPrice) : ''}
                helperText={t('form.totalPriceHelper')}
                slotProps={{ input: { readOnly: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Transport Fee (UGX)"
                label={t('form.transportFee')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Other Fee (UGX)"
                label={t('form.otherFee')}
              />
            </Grid>

            <SectionHeader title={t('sections.payment')} />

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text type="number" name="Amount Cash" label={t('form.amountCash')} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Amount Mobile Money?"
                label={t('form.amountMobileMoney')}
              />
            </Grid>
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
  );

  const nested = (
    <FarmerFormDialog
      open={farmerFormOpen}
      fpoId={fpoId}
      onClose={() => setFarmerFormOpen(false)}
      onSaved={handleNewFarmer}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{isEdit ? t('form.title.edit') : t('form.title.new')}</DialogTitle>
      {form}
      {nested}
    </Dialog>
  );
}
