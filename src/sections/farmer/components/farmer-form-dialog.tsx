import type { Farmer } from '../types';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import axios from 'src/lib/axios';

import { Form, Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const GENDERS = ['Male', 'Female'];

const schema = z.object({
  'Given Name': z.string().min(1, { message: 'Required' }),
  Surname: z.string().min(1, { message: 'Required' }),
  'NIN (National Identification Number)': z.string().min(1, { message: 'Required' }),
  'Farmer Code': z.string().optional(),
  'Birth date': z.string().min(1, { message: 'Required' }),
  Gender: z.string().min(1, { message: 'Required' }),
  'Phone Number': z.string().min(1, { message: 'Required' }),
  'Mobile Money Number': z.string().min(1, { message: 'Required' }),
  Email: z.string().optional(),
  Village: z.string().min(1, { message: 'Required' }),
  Parish: z.string().min(1, { message: 'Required' }),
  'Sub-county': z.string().min(1, { message: 'Required' }),
  'District (form)': z.string().min(1, { message: 'Required' }),
  Region: z.string().optional(),
  'Member since (date)': z.string().min(1, { message: 'Required' }),
  'Main product sold to Partner': z.string().optional(),
  'Quantity sold last season A to Partner (units, kg, liter)': z.number().optional(),
  'Quantity sold last season B to Partner (units, kg, liter)': z.number().optional(),
  '# seasonal/temporary workers hired & paid by farmer': z.number().optional(),
  '# permanent workers hired & paid by farmer': z.number().optional(),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

type FarmerFormDialogProps = {
  open: boolean;
  farmer?: Farmer | null;
  fpoId?: string;
  onClose: () => void;
  onSaved?: (farmer?: Farmer) => void;
};

function getDefaultValues(farmer?: Farmer | null): FormValues {
  const f = farmer?.fields;
  return {
    'Given Name': f?.['Given Name'] ?? '',
    Surname: f?.Surname ?? '',
    'NIN (National Identification Number)': f?.['NIN (National Identification Number)'] ?? '',
    'Farmer Code': f?.['Farmer Code'] ?? '',
    'Birth date': f?.['Birth date'] ?? '',
    Gender: f?.Gender ?? '',
    'Phone Number': f?.['Phone Number'] ?? '',
    'Mobile Money Number': f?.['Mobile Money Number'] ?? '',
    Email: f?.Email ?? '',
    Village: f?.Village ?? '',
    Parish: f?.Parish ?? '',
    'Sub-county': f?.['Sub-county'] ?? '',
    'District (form)': f?.['District (form)'] ?? '',
    Region: f?.Region ?? '',
    'Member since (date)': f?.['Member since (date)'] ?? '',
    'Main product sold to Partner': f?.['Main product sold to Partner']?.[0] ?? '',
    'Quantity sold last season A to Partner (units, kg, liter)':
      f?.['Quantity sold last season A to Partner (units, kg, liter)'] ?? undefined,
    'Quantity sold last season B to Partner (units, kg, liter)':
      f?.['Quantity sold last season B to Partner (units, kg, liter)'] ?? undefined,
    '# seasonal/temporary workers hired & paid by farmer':
      f?.['# seasonal/temporary workers hired & paid by farmer'] ?? undefined,
    '# permanent workers hired & paid by farmer': f?.['# permanent workers hired & paid by farmer'] ?? undefined,
  };
}

export function FarmerFormDialog({ open, farmer, fpoId, onClose, onSaved }: FarmerFormDialogProps) {
  const isEdit = Boolean(farmer);
  const [crops, setCrops] = useState<{ id: string; name: string }[]>([]);

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(farmer),
    resolver: zodResolver(schema),
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(farmer));
      axios
        .get('/api/v1/crops')
        .then(({ data }) =>
          setCrops(
            (data.records || []).map((c: any) => ({
              id: c.id,
              name: String(c.fields['Crop Name'] ?? c.id),
            }))
          )
        )
        .catch(() => setCrops([]));
    }
  }, [open, farmer, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload: Record<string, any> = { ...data };

    // Not persisted to Airtable without a public file URL.
    delete payload['Farmer Picture'];

    // Link fields expect an array of record ids.
    if (payload['Main product sold to Partner']) {
      payload['Main product sold to Partner'] = [payload['Main product sold to Partner']];
    } else {
      delete payload['Main product sold to Partner'];
    }

    try {
      let response;
      if (isEdit && farmer) {
        response = await axios.patch(`/api/v1/farmers/${farmer.id}`, { fields: payload });
      } else {
        response = await axios.post('/api/v1/farmers', { fpoId, fields: payload });
      }
      onSaved?.(response?.data?.record);
      onClose();
    } catch (error: any) {
      console.error('Farmer save error:', error?.message);
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? 'Edit farmer' : 'Enter new farmer data'}</DialogTitle>

      <Form methods={methods} onSubmit={onSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Given Name" label="Given Name" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Surname" label="Surname" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="NIN (National Identification Number)" label="NIN" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Farmer Code" label="Farmer Code" helperText="Mandatory for some cooperatives" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.DatePicker name="Birth date" label="Birth date" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Select name="Gender" label="Gender">
                <MenuItem value="">Select...</MenuItem>
                {GENDERS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Field.Select>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Phone Number" label="Phone Number" placeholder="256xxxxxxxxx" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                name="Mobile Money Number"
                label="Mobile Money Number"
                placeholder="256xxxxxxxxx"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Email" label="Email" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Village" label="Village" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Parish" label="Parish" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Sub-county" label="Sub-county" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="District (form)" label="District" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Region" label="Region" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.DatePicker name="Member since (date)" label="Member since (date)" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Select
                name="Main product sold to Partner"
                label="Main produce sold to Partner"
                helperText="Mandatory for PayLater (loan)"
              >
                <MenuItem value="">None</MenuItem>
                {crops.map((crop) => (
                  <MenuItem key={crop.id} value={crop.id}>
                    {crop.name}
                  </MenuItem>
                ))}
              </Field.Select>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Quantity sold last season A to Partner (units, kg, liter)"
                label="Quantity sold last season A to Partner"
                helperText="Mandatory for PayLater (loan)"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="Quantity sold last season B to Partner (units, kg, liter)"
                label="Quantity sold last season B to Partner"
                helperText="Mandatory for PayLater (loan)"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="# seasonal/temporary workers hired & paid by farmer"
                label="# seasonal/temporary workers hired & paid by farmer"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                type="number"
                name="# permanent workers hired & paid by farmer"
                label="# permanent workers hired & paid by farmer"
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Field.Upload
              name="Farmer Picture"
              helperText="Farmer Picture preview only — full upload will be enabled later"
            />
          </Box>
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
