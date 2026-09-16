import { useRef, useState } from 'react';

import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Popover from '@mui/material/Popover';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { useTranslate } from 'src/locales';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type ListFilterField = {
  key: string;
  label: string;
  /** When provided the filter renders a select with these options, otherwise a text input. */
  options?: { value: string; label: string }[];
};

type ListFiltersProps = {
  fields: ListFilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
};

export function ListFilters({ fields, values, onChange, onClear }: ListFiltersProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const { t } = useTranslate('common');

  const activeCount = fields.filter((f) => values[f.key]).length;

  return (
    <>
      <IconButton
        ref={anchorRef}
        onClick={() => setOpen((prev) => !prev)}
        color={activeCount ? 'primary' : 'default'}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <Badge badgeContent={activeCount} color="primary">
          <Iconify icon={'solar:tuning-2-bold-duotone' as any} width={20} />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorEl={anchorRef.current}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 320, maxHeight: '70vh' } } }}
      >
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
              {t('filters')}
            </Typography>
            <Button
              size="small"
              color="inherit"
              disabled={!activeCount}
              onClick={onClear}
              startIcon={<Iconify icon={'solar:trash-bin-trash-bold' as any} width={16} />}
            >
              {t('clearFilters')}
            </Button>
          </Stack>

          {fields.map((field) =>
            field.options ? (
              <FormControl key={field.key} size="small" fullWidth>
                <InputLabel>{field.label}</InputLabel>
                <Select
                  label={field.label}
                  value={values[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, String(e.target.value))}
                >
                  <MenuItem value="">
                    <em>{t('all')}</em>
                  </MenuItem>
                  {field.options.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                key={field.key}
                size="small"
                fullWidth
                label={field.label}
                value={values[field.key] ?? ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )
          )}
        </Stack>
      </Popover>
    </>
  );
}
