import type { Farmer } from 'src/sections/farmer/types';
import type { Season, InputOrder, InputProduct } from '../types';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';
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
import useMediaQuery from '@mui/material/useMediaQuery';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';

import { Form, Field } from 'src/components/hook-form';

import { FarmerFormDialog } from 'src/sections/farmer/components/farmer-form-dialog';

// ----------------------------------------------------------------------

export const PAY_OPTIONS = ['PayNow (cash)', 'PayLater (loan)'];

const INPUT_KEYS = ['Input 1', 'Input 2', 'Input 3', 'Input 4', 'Input 5'] as const;
const QUANTITY_KEYS = [
  'Quantity Input 1',
  'Quantity Input 2',
  'Quantity Input 3',
  'Quantity Input 4',
  'Quantity Input 5',
] as const;
const RETAIL_KEYS = [
  'Retail Price Input 1',
  'Retail Price Input 2',
  'Retail Price Input 3',
  'Retail Price Input 4',
  'Retail Price Input 5',
] as const;

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

const schema = z.object({
  Farmer: z.string().min(1, { message: 'Required' }),
  Season: z.string().min(1, { message: 'Required' }),
  'PayNow PayLater': z.string().min(1, { message: 'Required' }),
  'Input 1': z.string().min(1, { message: 'Required' }),
  'Quantity Input 1': z.number().min(1, { message: 'Required' }),
  'Input 2': z.string().optional(),
  'Quantity Input 2': z.number().optional(),
  'Input 3': z.string().optional(),
  'Quantity Input 3': z.number().optional(),
  'Input 4': z.string().optional(),
  'Quantity Input 4': z.number().optional(),
  'Input 5': z.string().optional(),
  'Quantity Input 5': z.number().optional(),
  'Retail Price Input 1': z.number().optional(),
  'Retail Price Input 2': z.number().optional(),
  'Retail Price Input 3': z.number().optional(),
  'Retail Price Input 4': z.number().optional(),
  'Retail Price Input 5': z.number().optional(),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

export function getInputProductOptions(products: InputProduct[], order?: InputOrder | null) {
  const baseOptions = products.map((p) => ({ value: p.id, label: productLabel(p) }));
  const seen = new Set(baseOptions.map((o) => o.value));

  if (order) {
    INPUT_KEYS.forEach((key, idx) => {
      const value = firstInputValue(order.fields[key]);
      if (value && !seen.has(value)) {
        const label =
          (order.fields[`Product ID (from ${key})`] || order.fields[`Product Name (from ${key})`] || [])[0] ||
          order.fields[`Input ${idx + 1}`]?.[0] ||
          value;
        baseOptions.push({ value, label });
        seen.add(value);
      }
    });
  }

  return baseOptions;
}

type InputOrderFormDialogProps = {
  open: boolean;
  order?: InputOrder | null;
  fpoId?: string;
  farmers: Farmer[];
  seasons: Season[];
  products: InputProduct[];
  onClose: () => void;
  onSaved: () => void;
  onFarmerCreated?: (farmer: Farmer) => void;
};

function productLabel(product?: InputProduct | null) {
  return product?.fields['Product ID'] || product?.fields['Product Name'] || product?.fields.Name || product?.fields['Crop Name'] || 'Unnamed';
}

export function firstInputValue(value?: any) {
  if (Array.isArray(value)) return value[0] ?? '';
  if (typeof value === 'string') return value;
  return '';
}

function getDefaultValues(order?: InputOrder | null): FormValues {
  const f = order?.fields;
  return {
    Farmer: f?.Farmer?.[0] ?? '',
    Season: f?.Season?.[0] ?? '',
    'PayNow PayLater': f?.['PayNow PayLater'] ?? '',
    'Input 1': firstInputValue(f?.['Input 1']),
    'Quantity Input 1': f?.['Quantity Input 1'] ?? undefined,
    'Input 2': firstInputValue(f?.['Input 2']),
    'Quantity Input 2': f?.['Quantity Input 2'] ?? undefined,
    'Input 3': firstInputValue(f?.['Input 3']),
    'Quantity Input 3': f?.['Quantity Input 3'] ?? undefined,
    'Input 4': firstInputValue(f?.['Input 4']),
    'Quantity Input 4': f?.['Quantity Input 4'] ?? undefined,
    'Input 5': firstInputValue(f?.['Input 5']),
    'Quantity Input 5': f?.['Quantity Input 5'] ?? undefined,
    'Retail Price Input 1': f?.['Retail Price Input 1'] ?? undefined,
    'Retail Price Input 2': f?.['Retail Price Input 2'] ?? undefined,
    'Retail Price Input 3': f?.['Retail Price Input 3'] ?? undefined,
    'Retail Price Input 4': f?.['Retail Price Input 4'] ?? undefined,
    'Retail Price Input 5': f?.['Retail Price Input 5'] ?? undefined,
  };
}

export function InputOrderFormDialog({
  open,
  order,
  fpoId,
  farmers,
  seasons,
  products,
  onClose,
  onSaved,
  onFarmerCreated,
}: InputOrderFormDialogProps) {
  const isEdit = Boolean(order);
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);

  const { t } = useTranslate('inputOrders');
  const { t: tCommon } = useTranslate('common');

  const productOptions = useMemo(() => getInputProductOptions(products, order), [products, order]);

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

    if (!isEdit && fpoId) {
      payload.FPO = fpoId;
    }

    // Clear optional inputs that have no product selected.
    INPUT_KEYS.forEach((key, idx) => {
      if (!payload[key]) {
        delete payload[key];
        delete payload[QUANTITY_KEYS[idx]];
        delete payload[RETAIL_KEYS[idx]];
      }
    });

    try {
      if (isEdit && order) {
        await axios.patch(`/api/v1/input-orders/${order.id}`, { fields: payload });
      } else {
        await axios.post('/api/v1/input-orders', { fields: payload });
      }
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Input order save error:', error?.message);
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
              {renderAutocomplete(
                'Season',
                t('form.season'),
                seasons.map((s) => ({ value: s.id, label: s.fields.Name || 'Unnamed' })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelect(
                'PayNow PayLater',
                t('form.payOption'),
                PAY_OPTIONS.map((o) => ({ value: o, label: o })),
                true
              )}
            </Grid>

            <SectionHeader title={t('sections.inputs')} />

            {[0, 1, 2, 3, 4].map((idx) => (
              <Grid size={{ xs: 12 }} key={INPUT_KEYS[idx]}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    {renderAutocomplete(
                      INPUT_KEYS[idx],
                      t('fields.input', { index: idx + 1 }),
                      productOptions,
                      idx === 0
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Field.Text
                      required={idx === 0}
                      type="number"
                      name={QUANTITY_KEYS[idx]}
                      label={t('fields.quantityInput', { index: idx + 1 })}
                    />
                  </Box>
                </Stack>
              </Grid>
            ))}
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
      <DialogTitle>
        {isEdit ? t('form.title.edit') : t('form.title.new')}
      </DialogTitle>
      {form}
      {nested}
    </Dialog>
  );
}
