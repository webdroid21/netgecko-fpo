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

const OWNERSHIP_OPTIONS = ['Owned', 'Rented'];

const schema = z.object({
  Farmer: z.string().min(1, { message: 'Required' }),
  'Land Size (Acres)': z.number().min(0, { message: 'Required' }),
  'Land Ownership': z.string().min(1, { message: 'Required' }),
  Latitude: z.number().optional(),
  Longitude: z.number().optional(),
  'Main Product (1)': z.string().min(1, { message: 'Required' }),
  'Number of plants (Product 1)': z.number().optional(),
  'Product 1 Estimated Harvest (KG) Season A': z.number().min(0, { message: 'Required' }),
  'Product 1 Estimated Harvest (KG) Season B': z.number().min(0, { message: 'Required' }),
  'Other product (2)': z.string().optional(),
  'Number of plants (Product 2)': z.number().optional(),
  'Product 2 Estimated Harvest (KG) Season A': z.number().optional(),
  'Product 2 Estimated Harvest (KG) Season B': z.number().optional(),
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
    'Main Product (1)': f?.['Main Product (1)']?.[0] ?? f?.['Main Crop (1)']?.[0] ?? '',
    'Number of plants (Product 1)': f?.['Number of plants (Product 1)'] ?? f?.['Number of plants (Crop 1)'] ?? undefined,
    'Product 1 Estimated Harvest (KG) Season A': f?.['Product 1 Estimated Harvest (KG) Season A'] ?? f?.['Crop 1 Estimated Harvest (KG) Season A'] ?? undefined,
    'Product 1 Estimated Harvest (KG) Season B': f?.['Product 1 Estimated Harvest (KG) Season B'] ?? f?.['Crop 1 Estimated Harvest (KG) Season B'] ?? undefined,
    'Other product (2)': f?.['Other product (2)']?.[0] ?? f?.['Other crop (2)']?.[0] ?? '',
    'Number of plants (Product 2)': f?.['Number of plants (Product 2)'] ?? f?.['Number of plants (Crop 2)'] ?? undefined,
    'Product 2 Estimated Harvest (KG) Season A': f?.['Product 2 Estimated Harvest (KG) Season A'] ?? f?.['Crop 2 Estimated Harvest (KG) Season A'] ?? undefined,
    'Product 2 Estimated Harvest (KG) Season B': f?.['Product 2 Estimated Harvest (KG) Season B'] ?? f?.['Crop 2 Estimated Harvest (KG) Season B'] ?? undefined,
  };
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
  const [farmerFormOpen, setFarmerFormOpen] = useState(false);

  const { t } = useTranslate('lands');
  const { t: tCommon } = useTranslate('common');

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(land),
    resolver: zodResolver(schema),
  });

  const {
    reset,
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

    // Omit empty optional product fields.
    if (!payload['Other product (2)']) {
      delete payload['Other product (2)'];
      delete payload['Number of plants (Product 2)'];
      delete payload['Product 2 Estimated Harvest (KG) Season A'];
      delete payload['Product 2 Estimated Harvest (KG) Season B'];
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? t('form.title.edit') : t('form.title.new')}</DialogTitle>

      <Form methods={methods} onSubmit={onSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flexGrow: 1 }}>
                  {renderSelectField(
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
              <Field.Text
                type="number"
                name="Land Size (Acres)"
                label={t('form.landSize')}
              />
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
              <Field.Text type="number" name="Latitude" label={t('form.latitude')} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text type="number" name="Longitude" label={t('form.longitude')} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelectField(
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
                label={t('form.numPlantsProduct1')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Product 1 Estimated Harvest (KG) Season A"
                label={t('form.product1HarvestSeasonA')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Product 1 Estimated Harvest (KG) Season B"
                label={t('form.product1HarvestSeasonB')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelectField(
                'Other product (2)',
                t('form.otherProduct'),
                [
                  { value: '', label: t('form.noneOption') },
                  ...crops.map((c) => ({ value: c.id, label: c.fields['Crop Name'] ?? c.fields['Product Name'] ?? c.id })),
                ]
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Number of plants (Product 2)"
                label={t('form.numPlantsProduct2')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Product 2 Estimated Harvest (KG) Season A"
                label={t('form.product2HarvestSeasonA')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Product 2 Estimated Harvest (KG) Season B"
                label={t('form.product2HarvestSeasonB')}
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

      <FarmerFormDialog
        open={farmerFormOpen}
        fpoId={fpoId}
        onClose={() => setFarmerFormOpen(false)}
        onSaved={handleNewFarmer}
      />
    </Dialog>
  );
}
