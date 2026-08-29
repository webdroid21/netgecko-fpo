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
  'Main Crop (1)': z.string().min(1, { message: 'Required' }),
  'Number of plants (Crop 1)': z.number().optional(),
  'Crop 1 Estimated Harvest (KG) Season A': z.number().min(0, { message: 'Required' }),
  'Crop 1 Estimated Harvest (KG) Season B': z.number().min(0, { message: 'Required' }),
  'Other crop (2)': z.string().optional(),
  'Number of plants (Crop 2)': z.number().optional(),
  'Crop 2 Estimated Harvest (KG) Season A': z.number().optional(),
  'Crop 2 Estimated Harvest (KG) Season B': z.number().optional(),
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
    'Main Crop (1)': f?.['Main Crop (1)']?.[0] ?? '',
    'Number of plants (Crop 1)': f?.['Number of plants (Crop 1)'] ?? undefined,
    'Crop 1 Estimated Harvest (KG) Season A': f?.['Crop 1 Estimated Harvest (KG) Season A'] ?? undefined,
    'Crop 1 Estimated Harvest (KG) Season B': f?.['Crop 1 Estimated Harvest (KG) Season B'] ?? undefined,
    'Other crop (2)': f?.['Other crop (2)']?.[0] ?? '',
    'Number of plants (Crop 2)': f?.['Number of plants (Crop 2)'] ?? undefined,
    'Crop 2 Estimated Harvest (KG) Season A': f?.['Crop 2 Estimated Harvest (KG) Season A'] ?? undefined,
    'Crop 2 Estimated Harvest (KG) Season B': f?.['Crop 2 Estimated Harvest (KG) Season B'] ?? undefined,
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

    // Omit empty optional crop fields.
    if (!payload['Other crop (2)']) {
      delete payload['Other crop (2)'];
      delete payload['Number of plants (Crop 2)'];
      delete payload['Crop 2 Estimated Harvest (KG) Season A'];
      delete payload['Crop 2 Estimated Harvest (KG) Season B'];
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
        <em>Select...</em>
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
      <DialogTitle>{isEdit ? 'Edit land' : 'Enter a new land'}</DialogTitle>

      <Form methods={methods} onSubmit={onSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flexGrow: 1 }}>
                  {renderSelectField(
                    'Farmer',
                    'Farmer',
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
                  Add New
                </Button>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Land Size (Acres)"
                label="Land Size (Acres)"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelectField(
                'Land Ownership',
                'Land Ownership',
                OWNERSHIP_OPTIONS.map((o) => ({ value: o, label: o })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text type="number" name="Latitude" label="Latitude" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text type="number" name="Longitude" label="Longitude" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelectField(
                'Main Crop (1)',
                'Main Crop (1)',
                crops.map((c) => ({ value: c.id, label: c.fields['Crop Name'] ?? c.id })),
                true
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Number of plants (Crop 1)"
                label="Number of plants (Crop 1)"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Crop 1 Estimated Harvest (KG) Season A"
                label="Crop 1 Estimated Harvest (KG) Season A"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Crop 1 Estimated Harvest (KG) Season B"
                label="Crop 1 Estimated Harvest (KG) Season B"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderSelectField(
                'Other crop (2)',
                'Other crop (2)',
                [{ value: '', label: 'None' }, ...crops.map((c) => ({ value: c.id, label: c.fields['Crop Name'] ?? c.id }))]
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Number of plants (Crop 2)"
                label="Number of plants (Crop 2)"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Crop 2 Estimated Harvest (KG) Season A"
                label="Crop 2 Estimated Harvest (KG) Season A"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Crop 2 Estimated Harvest (KG) Season B"
                label="Crop 2 Estimated Harvest (KG) Season B"
              />
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

      <FarmerFormDialog
        open={farmerFormOpen}
        fpoId={fpoId}
        onClose={() => setFarmerFormOpen(false)}
        onSaved={handleNewFarmer}
      />
    </Dialog>
  );
}
