import type { Land, Crop } from '../types';
import type { Farmer } from 'src/sections/farmer/types';

import { z } from 'zod';
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
import useMediaQuery from '@mui/material/useMediaQuery';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';

import { Form, Field } from 'src/components/hook-form';

import { FarmerFormDialog } from 'src/sections/farmer/components/farmer-form-dialog';

// ----------------------------------------------------------------------

export const OWNERSHIP_OPTIONS = ['Owned', 'Rented'];

export const PROD_A = 'Product 1 Estimated Production Season A (kg, heads, litres, units)';
export const PROD_B = 'Product 1 Estimated Production Season B (kg, heads, litres, units)';
export const PROD2_A = 'Product 2 Estimated Production Season A (kg, heads, litres, units)';
export const PROD2_B = 'Product 2 Estimated Production Season B (kg, heads, litres, units)';

const schema = z.object({
  Farmer: z.string().min(1, { message: 'Required' }),
  'Land Size (Acres)': z.number().min(0, { message: 'Required' }),
  'Land Ownership': z.string().min(1, { message: 'Required' }),
  Latitude: z.number().optional(),
  Longitude: z.number().optional(),
  'Main Product (1)': z.string().min(1, { message: 'Required' }),
  'Number of plants (Product 1)': z.number().optional(),
  [PROD_A]: z.number().min(0, { message: 'Required' }),
  [PROD_B]: z.number().min(0, { message: 'Required' }),
  'Other product (2)': z.string().optional(),
  'Number of plants (Product 2)': z.number().optional(),
  [PROD2_A]: z.number().optional(),
  [PROD2_B]: z.number().optional(),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

type LandFormDialogProps = {
  open: boolean;
  land?: Land | null;
  fpoId?: string;
  farmers: Farmer[];
  crops: Crop[];
  onClose: () => void;
  onSaved: () => void;
  onFarmerCreated?: (farmer: Farmer) => void;
};

function getDefaultValues(land?: Land | null): FormValues {
  const f = land?.fields;
  return {
    Farmer: f?.Farmer?.[0] ?? '',
    'Land Size (Acres)': f?.['Land Size (Acres)'] ?? undefined,
    'Land Ownership': f?.['Land Ownership'] ?? '',
    Latitude: f?.Latitude ?? undefined,
    Longitude: f?.Longitude ?? undefined,
    'Main Product (1)': f?.['Main Product (1)']?.[0] ?? '',
    'Number of plants (Product 1)': f?.['Number of plants (Product 1)'] ?? undefined,
    [PROD_A]: f?.[PROD_A] ?? undefined,
    [PROD_B]: f?.[PROD_B] ?? undefined,
    'Other product (2)': f?.['Other product (2)']?.[0] ?? '',
    'Number of plants (Product 2)': f?.['Number of plants (Product 2)'] ?? undefined,
    [PROD2_A]: f?.[PROD2_A] ?? undefined,
    [PROD2_B]: f?.[PROD2_B] ?? undefined,
  };
}

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

export function LandFormDialog({
  open,
  land,
  fpoId,
  farmers,
  crops,
  onClose,
  onSaved,
  onFarmerCreated,
}: LandFormDialogProps) {
  const isEdit = Boolean(land);
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);

  const { t } = useTranslate('lands');
  const { t: tCommon } = useTranslate('common');

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(land),
    resolver: zodResolver(schema),
  });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(land));
    }
  }, [open, land, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: Record<string, any> = { ...data };

    // Airtable linked-record fields expect arrays of record IDs.
    payload.Farmer = payload.Farmer ? [payload.Farmer] : [];
    payload['Main Product (1)'] = payload['Main Product (1)'] ? [payload['Main Product (1)']] : [];
    payload['Other product (2)'] = payload['Other product (2)'] ? [payload['Other product (2)']] : [];

    // Omit undefined values so optional fields are not cleared.
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
    });

    // Product 2 is optional: omit it entirely when creating, but send explicit
    // empty values when editing so a previously set product 2 gets cleared.
    if (!payload['Other product (2)']?.length) {
      if (isEdit) {
        payload['Other product (2)'] = [];
        payload['Number of plants (Product 2)'] = null;
        payload[PROD2_A] = null;
        payload[PROD2_B] = null;
      } else {
        delete payload['Other product (2)'];
        delete payload['Number of plants (Product 2)'];
        delete payload[PROD2_A];
        delete payload[PROD2_B];
      }
    }

    try {
      if (isEdit && land) {
        await axios.patch(`/api/v1/lands/${land.id}`, { fields: payload });
      } else {
        await axios.post('/api/v1/lands', { fields: payload });
      }
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Land save error:', error?.message);
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to save land';
      alert(message);
    }
  });

  const handleNewFarmer = (farmer?: Farmer) => {
    setFarmerFormOpen(false);
    if (farmer) {
      setValue('Farmer', farmer.id, { shouldValidate: true });
      onFarmerCreated?.(farmer);
    }
  };

  const renderSelectField = (
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
            <SectionHeader title={t('sections.land')} />

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
                    <Typography component="span" sx={{ fontSize: 20, lineHeight: 1 }}>
                      +
                    </Typography>
                  }
                >
                  {t('form.addNew')}
                </Button>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelectField(
                'Land Ownership',
                t('form.landOwnership'),
                OWNERSHIP_OPTIONS.map((o) => ({ value: o, label: o })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                required
                type="number"
                name="Land Size (Acres)"
                label={t('form.landSize')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text type="number" name="Latitude" label={t('form.latitude')} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text type="number" name="Longitude" label={t('form.longitude')} />
            </Grid>

            <SectionHeader title={t('sections.product1')} />

            <Grid size={{ xs: 12, md: 6 }}>
              {renderAutocomplete(
                'Main Product (1)',
                t('form.mainProduct'),
                crops.map((c) => ({ value: c.id, label: c.fields['Crop Name'] ?? c.fields['Product Name'] ?? c.id })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Number of plants (Product 1)"
                label={t('form.numberOfPlants')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                required
                type="number"
                name={PROD_A}
                label={t('form.product1ProductionSeasonA')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                required
                type="number"
                name={PROD_B}
                label={t('form.product1ProductionSeasonB')}
              />
            </Grid>

            <SectionHeader title={t('sections.product2')} />

            <Grid size={{ xs: 12, md: 6 }}>
              {renderAutocomplete(
                'Other product (2)',
                t('form.otherProduct'),
                crops.map((c) => ({ value: c.id, label: c.fields['Crop Name'] ?? c.fields['Product Name'] ?? c.id }))
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Number of plants (Product 2)"
                label={t('form.numberOfPlants')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name={PROD2_A}
                label={t('form.product2ProductionSeasonA')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name={PROD2_B}
                label={t('form.product2ProductionSeasonB')}
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
