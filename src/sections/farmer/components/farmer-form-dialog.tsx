import type { Dispatch, SetStateAction } from 'react';
import type { Farmer } from '../types';

import { z } from 'zod';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { uploadAttachment } from 'src/utils/upload-attachment';

import axios from 'src/lib/axios';

import { Iconify } from 'src/components/iconify';
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
  Address: z.string().min(1, { message: 'Required' }),
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

type VillageRecord = {
  id: string;
  village?: string;
  parish?: string;
  subCounty?: string;
  district?: string;
  region?: string;
  summary?: string;
};

type Attachment = { id: string; url: string; filename?: string };

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
    Address: f?.Address?.[0] ?? '',
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

export function FarmerFormDialog({ open, farmer, fpoId, onClose, onSaved }: FarmerFormDialogProps) {
  const isEdit = Boolean(farmer);
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [crops, setCrops] = useState<{ id: string; name: string }[]>([]);
  const [villages, setVillages] = useState<VillageRecord[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<File[]>([]);

  const methods = useForm<FormValues>({
    defaultValues: getDefaultValues(farmer),
    resolver: zodResolver(schema),
  });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const renderAutocomplete = (
    name: keyof FormValues,
    label: string,
    options: { value: string; label: string }[],
    required?: boolean,
    helperText?: string
  ) => (
    <Field.Autocomplete
      name={name}
      label={label}
      options={options}
      getOptionLabel={(opt: any) => opt?.label ?? ''}
      isOptionEqualToValue={(a: any, b: any) => a?.value === b?.value}
      value={options.find((o) => o.value === watch(name)) ?? null}
      onChange={(_e: any, opt: any) => setValue(name, opt?.value ?? '', { shouldValidate: true })}
      slotProps={{ textField: { required, helperText } }}
    />
  );

  const selectedAddress = watch('Address');
  const selectedVillage = villages.find((v) => v.id === selectedAddress);

  // Derived address parts come from the Village/Parish table when a link is
  // picked, otherwise fall back to the farmer's legacy free-text values.
  const lf = farmer?.fields;
  const lookup = (key: string) => (Array.isArray(lf?.[key]) ? lf?.[key]?.[0] : lf?.[key]);
  const derived = {
    parish: selectedVillage?.parish ?? lookup('Parish Name') ?? lf?.Parish ?? '',
    subCounty: selectedVillage?.subCounty ?? lookup('Sub-County Name') ?? lf?.['Sub-county'] ?? '',
    district: selectedVillage?.district ?? lookup('District Name') ?? lf?.['District (form)'] ?? '',
    region: selectedVillage?.region ?? lookup('Region Name') ?? lf?.Region ?? '',
  };

  const existingAttachments: Attachment[] = Array.isArray(lf?.['Farmer ID (front back)'])
    ? lf['Farmer ID (front back)']
    : [];

  const existingReceipts: Attachment[] = Array.isArray(lf?.['Receipts of these sales to Coop'])
    ? lf['Receipts of these sales to Coop']
    : [];

  useEffect(() => {
    if (!open) return;
    reset(getDefaultValues(farmer));
    setPendingFiles([]);
    setPendingReceipts([]);

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

    axios
      .get('/api/v1/villages')
      .then(({ data }) =>
        setVillages(
          (data.records || []).map((v: any) => ({
            id: v.id,
            village: v.fields['Village Name'],
            parish: v.fields['Parish Name'],
            subCounty: v.fields['Sub-County Name'],
            district: v.fields['District Name'],
            region: v.fields.Region,
            summary: v.fields.Summary,
          }))
        )
      )
      .catch(() => setVillages([]));
  }, [open, farmer, reset]);

  // Uploads straight to Airtable, in parallel; returns how many files
  // failed so the caller can warn without losing the saved farmer.
  const uploadPendingFiles = async (farmerId: string, fieldName: string, files: File[]) => {
    const results = await Promise.allSettled(
      files.map((file) => uploadAttachment(`/api/v1/farmers/${farmerId}`, fieldName, file))
    );
    results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .forEach((r) => console.error('Attachment upload failed:', r.reason?.message ?? r.reason));
    return results.filter((r) => r.status === 'rejected').length;
  };

  const onSubmit = handleSubmit(async (data) => {
    const payload: Record<string, any> = { ...data };

    // Village/Parish record drives the Address link and keeps the legacy
    // text fields in sync.
    const village = villages.find((v) => v.id === data.Address);
    if (village) {
      payload.Address = [village.id];
      payload.Village = village.village;
      payload.Parish = village.parish;
      payload['Sub-county'] = village.subCounty;
      payload['District (form)'] = village.district;
      payload.Region = village.region;
    } else {
      payload.Address = data.Address ? [data.Address] : [];
    }

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
      const savedId = farmer?.id ?? response?.data?.record?.id;
      let failedUploads = 0;
      if (savedId) {
        const [idFailures, receiptFailures] = await Promise.all([
          uploadPendingFiles(savedId, 'Farmer ID (front back)', pendingFiles),
          uploadPendingFiles(savedId, 'Receipts of these sales to Coop', pendingReceipts),
        ]);
        failedUploads = idFailures + receiptFailures;
      }
      // The record is saved at this point — always close, even if some
      // attachments failed (resubmitting a create would duplicate it).
      onSaved?.(response?.data?.record);
      onClose();
      if (failedUploads) {
        toast.error(
          `Farmer saved, but ${failedUploads} attachment${failedUploads > 1 ? 's' : ''} failed to upload — add them again from the farmer page.`
        );
      }
    } catch (error: any) {
      console.error('Farmer save error:', error?.response?.data || error?.message);
      const message =
        error?.response?.data?.message || error?.message || 'Failed to save farmer';
      alert(message);
    }
  });

  const renderAttachmentBlock = (
    label: string,
    existing: Attachment[],
    files: File[],
    setFiles: Dispatch<SetStateAction<File[]>>
  ) => (
    <>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      {existing.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {existing.map((a) => (
            <MuiLink
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener"
              variant="body2"
              sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {a.filename || 'Attachment'}
            </MuiLink>
          ))}
        </Stack>
      )}
      {files.map((file, index) => (
        <Stack key={`${file.name}-${index}`} direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
          >
            <Iconify icon={'solar:close-circle-bold' as any} width={16} />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <Button
          size="small"
          component="label"
          startIcon={<Iconify icon={'solar:camera-bold' as any} width={16} />}
        >
          Take photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              if (picked.length) setFiles((prev) => [...prev, ...picked]);
              e.target.value = '';
            }}
          />
        </Button>
        <Button
          size="small"
          component="label"
          startIcon={<Iconify icon={'solar:upload-bold' as any} width={16} />}
        >
          Attach file
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              if (picked.length) setFiles((prev) => [...prev, ...picked]);
              e.target.value = '';
            }}
          />
        </Button>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
        Files are uploaded when the farmer is saved
      </Typography>
    </>
  );

  const form = (
    <Form methods={methods} onSubmit={onSubmit}>
      <DialogContent dividers>
          <Grid container spacing={2}>
            <SectionHeader title="Identity" />

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text required name="Given Name" label="Given Name" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text required name="Surname" label="Surname" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text required name="NIN (National Identification Number)" label="NIN" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Farmer Code" label="Farmer Code" helperText="Mandatory for some cooperatives" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.DatePicker
                name="Birth date"
                label="Birth date"
                slotProps={{ textField: { required: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Select required name="Gender" label="Gender">
                <MenuItem value="">Select...</MenuItem>
                {GENDERS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Field.Select>
            </Grid>

            <Grid size={{ xs: 12 }}>
              {renderAttachmentBlock(
                'Farmer ID (front back)',
                existingAttachments,
                pendingFiles,
                setPendingFiles
              )}
            </Grid>

            <SectionHeader title="Contact" />

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text required name="Phone Number" label="Phone Number" placeholder="256xxxxxxxxx" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text
                required
                name="Mobile Money Number"
                label="Mobile Money Number"
                placeholder="256xxxxxxxxx"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Text name="Email" label="Email" />
            </Grid>

            <SectionHeader title="Address" />

            <Grid size={{ xs: 12 }}>
              {renderAutocomplete(
                'Address',
                'Village',
                villages.map((v) => ({ value: v.id, label: v.summary || v.village || v.id })),
                true,
                'Parish, sub-county, district and region are filled in automatically'
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="Parish" value={derived.parish} disabled />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="Sub-county" value={derived.subCounty} disabled />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="District" value={derived.district} disabled />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" label="Region" value={derived.region} disabled />
            </Grid>

            <SectionHeader title="Membership and Product" />

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.DatePicker
                name="Member since (date)"
                label="Member since (date)"
                slotProps={{ textField: { required: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {renderAutocomplete(
                'Main product sold to Partner',
                'Main product sold to partner',
                crops.map((crop) => ({ value: crop.id, label: crop.name })),
                false,
                'Mandatory for PayLater (loan)'
              )}
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

            <Grid size={{ xs: 12 }}>
              {renderAttachmentBlock(
                'Receipts of these sales to Partner',
                existingReceipts,
                pendingReceipts,
                setPendingReceipts
              )}
            </Grid>

            <SectionHeader title="Workers" />

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
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{isEdit ? 'Edit farmer' : 'Enter new farmer data'}</DialogTitle>
      {form}
    </Dialog>
  );
}
