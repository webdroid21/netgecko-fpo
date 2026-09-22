import dayjs from 'dayjs';
import { useRef, useState } from 'react';

import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { fNumber } from 'src/utils/format-number';

import { useTranslate } from 'src/locales';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type ListFilterField = {
  key: string;
  label: string;
  /** When provided the filter renders a select with these options, otherwise a text input. */
  options?: { value: string; label: string }[];
  /** Render a date picker; the stored value is an ISO day string (YYYY-MM-DD). */
  type?: 'date';
  /** Render a multi-select; the stored value is a string array of option values. */
  multiple?: boolean;
};

export type ListFilterValues = Record<string, string | string[]>;

type ListFiltersProps = {
  fields: ListFilterField[];
  values: ListFilterValues;
  onChange: (key: string, value: string | string[]) => void;
  onClear: () => void;
};

const hasValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.length > 0 : Boolean(value);

/**
 * Shared list-filter matching used by all master/detail views.
 * - text fields: case-insensitive substring over the raw field value
 * - option fields: exact match against any of the record's values
 * - multiple fields: any overlap between the record's values and the selection
 * - date fields: day-level equality (falls back to substring on unparseable values)
 */
export function matchesListFilters<T>(
  item: T,
  fields: ListFilterField[],
  values: ListFilterValues,
  getValue: (item: T, key: string) => any
): boolean {
  return fields.every((field) => {
    const raw = values[field.key];
    if (!hasValue(raw)) return true;

    const fieldValue = getValue(item, field.key);
    const vals = Array.isArray(fieldValue) ? fieldValue : [fieldValue];

    if (field.type === 'date') {
      const target = String(raw);
      return vals.some((v) => {
        const parsed = dayjs(v);
        if (parsed.isValid()) return parsed.format('YYYY-MM-DD') === target;
        return String(v ?? '').includes(target);
      });
    }

    if (field.multiple) {
      const selected = Array.isArray(raw) ? raw : [raw];
      return vals.some((v) => selected.includes(String(v)));
    }

    if (field.options) {
      return vals.some((v) => String(v) === String(raw));
    }

    return vals.some((v) =>
      String(v ?? '')
        .toLowerCase()
        .includes(String(raw).toLowerCase())
    );
  });
}

/**
 * Builds the lowercase free-text search haystack for a record: every field
 * value is included so the search box covers all of the item's data, not
 * just the columns shown in the list.
 * - arrays/lookups are flattened recursively
 * - numbers are added both raw and thousand-separated ("1200000" and "1,200,000")
 * - attachment objects contribute their filename
 */
export function recordSearchText(fields: Record<string, unknown>): string {
  const parts: string[] = [];

  const push = (value: unknown) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === 'number') {
      parts.push(String(value));
      const formatted = fNumber(value);
      if (formatted !== String(value)) parts.push(formatted);
      return;
    }
    if (typeof value === 'object') {
      const filename = (value as { filename?: unknown }).filename;
      if (typeof filename === 'string') parts.push(filename);
      return;
    }
    parts.push(String(value));
  };

  Object.values(fields).forEach(push);
  return parts.join(' ').toLowerCase();
}

export function ListFilters({ fields, values, onChange, onClear }: ListFiltersProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const { t } = useTranslate('common');

  const activeCount = fields.filter((f) => hasValue(values[f.key])).length;

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

          {fields.map((field) => {
            if (field.type === 'date') {
              const raw = values[field.key];
              return (
                <DatePicker
                  key={field.key}
                  label={field.label}
                  format="DD/MM/YYYY"
                  value={typeof raw === 'string' && raw ? dayjs(raw) : null}
                  onChange={(newValue) =>
                    onChange(field.key, newValue ? dayjs(newValue).format('YYYY-MM-DD') : '')
                  }
                  slotProps={{
                    textField: { size: 'small', fullWidth: true },
                    field: { clearable: true },
                  }}
                />
              );
            }

            if (field.options && field.multiple) {
              const raw = values[field.key];
              const selectedValues = Array.isArray(raw) ? raw : raw ? [raw] : [];
              return (
                <Autocomplete
                  key={field.key}
                  size="small"
                  fullWidth
                  multiple
                  autoHighlight
                  disableCloseOnSelect
                  options={field.options}
                  getOptionLabel={(opt) => opt.label}
                  isOptionEqualToValue={(opt, val) => opt.value === val.value}
                  value={field.options.filter((opt) => selectedValues.includes(opt.value))}
                  onChange={(_event, opts) => onChange(field.key, opts.map((o) => o.value))}
                  renderInput={(params) => (
                    <TextField {...params} label={field.label} placeholder={t('all')} />
                  )}
                />
              );
            }

            if (field.options) {
              const raw = values[field.key];
              return (
                <Autocomplete
                  key={field.key}
                  size="small"
                  fullWidth
                  autoHighlight
                  options={field.options}
                  getOptionLabel={(opt) => opt.label}
                  isOptionEqualToValue={(opt, val) => opt.value === val.value}
                  value={field.options.find((opt) => opt.value === raw) ?? null}
                  onChange={(_event, opt) => onChange(field.key, opt?.value ?? '')}
                  renderInput={(params) => (
                    <TextField {...params} label={field.label} placeholder={t('all')} />
                  )}
                />
              );
            }

            const raw = values[field.key];
            return (
              <TextField
                key={field.key}
                size="small"
                fullWidth
                label={field.label}
                value={typeof raw === 'string' ? raw : ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            );
          })}
        </Stack>
      </Popover>
    </>
  );
}
