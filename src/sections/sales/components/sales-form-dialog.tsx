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
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

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
  'Price per KG (UGX)': z.number().min(1, { message: 'Required' }),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

type SalesFormDialogProps = {
  open: boolean;
  order?: SalesOrder | null;
  fpoId?: string;
  embedded?: boolean;
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
    'Price per KG (UGX)': f?.['Price per KG (UGX)'] ?? undefined,
  };
}

export function SalesFormDialog({
  open,
  order,
  fpoId,
  embedded,
  farmers,
  crops,
  seasons,
  onClose,
  onSaved,
  onFarmerCreated,
}: SalesFormDialogProps) {
  const isEdit = Boolean(order);
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);

  const { t } = useTranslate('sales');
  const { t: tCommon } = useTranslate('common');

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(order),
    resolver: zodResolver(schema),
  });

  const { reset, setValue, handleSubmit, formState } = methods;
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

  const renderSelect = (
    name: keyof FormValues,
    label: string,
    options: { value: string; label: string }[],
    required = false
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

  const form = (
    <Form
      methods={methods}
      onSubmit={onSubmit}
      style={embedded ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}
    >
      {embedded && (
        <DialogTitle>{isEdit ? t('form.title.edit') : t('form.title.new')}</DialogTitle>
      )}
      <DialogContent dividers sx={embedded ? { flexGrow: 1, overflow: 'auto' } : undefined}>
          <Grid container spacing={2}>
            <SectionHeader title={t('sections.order')} />

            <Grid size={{ xs: 12 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flexGrow: 1 }}>
                  {renderSelect(
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
              {renderSelect(
                'Season',
                t('form.season'),
                seasons.map((s) => ({ value: s.id, label: s.fields.Name || 'Unnamed' })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelect(
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
              <Field.DatePicker
                name="Date Received"
                label={t('form.dateReceived')}
                slotProps={{ textField: { required: true } }}
              />
            </Grid>

            <SectionHeader title={t('sections.payment')} />

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
                name="Price per KG (UGX)"
                label={t('form.pricePerKg')}
                required
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

  if (embedded) {
    return (
      <>
        {form}
        {nested}
      </>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? t('form.title.edit') : t('form.title.new')}</DialogTitle>
      {form}
      {nested}
    </Dialog>
  );
}
