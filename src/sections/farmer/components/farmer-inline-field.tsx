import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useRef, useState, type ReactNode } from 'react';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { fDate } from 'src/utils/format-time';
import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type SelectOption = string | { value: string; label: string };

type InlineEditFieldProps = {
  recordId: string;
  resource: string;
  name: string;
  label: string;
  value?: any;
  displayValue?: ReactNode;
  type?: 'text' | 'date' | 'number' | 'select';
  options?: SelectOption[];
  /** Render the select as a searchable autocomplete for long option lists. */
  searchable?: boolean;
  arrayValue?: boolean;
  readOnly?: boolean;
  required?: boolean;
  helperText?: ReactNode;
  onSaved: () => void;
};

export function InlineEditField({
  recordId,
  resource,
  name,
  label,
  value,
  displayValue,
  type = 'text',
  options,
  searchable,
  arrayValue,
  readOnly,
  required,
  helperText,
  onSaved,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState<any>(value ?? '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const previousValue = useRef(value);

  const shown =
    displayValue ??
    (type === 'date' && value
      ? fDate(value)
      : type === 'number' && value !== '' && value != null
        ? fNumber(value)
        : (value ?? '—'));

  const handleStart = () => {
    if (readOnly) return;
    previousValue.current = value;
    setDraft(value ?? '');
    setDirty(false);
    setEditing(true);
  };

  const handleChange = (newValue: any) => {
    setDraft(newValue);
    setDirty(true);
  };

  const handleCancel = () => {
    setDraft(value ?? '');
    setDirty(false);
    setEditing(false);
  };

  const save = async (nextValue: any) => {
    if (saving) return;

    if (required && (nextValue === '' || nextValue === null || nextValue === undefined)) {
      toast.error(`${label} is required`);
      return;
    }

    // Don't save if nothing changed.
    if (nextValue === value) {
      setEditing(false);
      setDirty(false);
      return;
    }

    setSaving(true);
    try {
      const fields: Record<string, any> = { [name]: nextValue };

      if (type === 'number' && (nextValue === '' || nextValue === null || nextValue === undefined)) {
        fields[name] = null;
      }

      if (arrayValue) {
        fields[name] = nextValue ? [nextValue] : [];
      }

      await axios.patch(`/api/v1/${resource}/${recordId}`, { fields });

      toast.success(`${label} updated successfully`, {
        action: {
          label: 'Click to revert changes',
          onClick: () => save(previousValue.current),
        },
      });

      setEditing(false);
      setDirty(false);
      onSaved();
    } catch (error: any) {
      toast.error(error?.message || `Failed to update ${label}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBlur = () => {
    if (dirty) {
      save(draft);
    }
  };

  const renderInput = () => {
    if (type === 'date') {
      return (
        <DatePicker
          format="DD/MM/YYYY"
          value={dayjs(draft)}
          onChange={(newValue) => {
            const next = newValue ? dayjs(newValue).format('YYYY-MM-DD') : '';
            setDraft(next);
            save(next);
          }}
          slotProps={{
            textField: { fullWidth: true, size: 'small' },
          }}
        />
      );
    }

    if (type === 'select' && options?.length) {
      const normalized = options.map((option) =>
        typeof option === 'string' ? { value: option, label: option } : option
      );
      if (searchable) {
        return (
          <Autocomplete
            size="small"
            fullWidth
            options={normalized}
            value={normalized.find((o) => o.value === draft) ?? null}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(a, b) => a.value === b.value}
            onChange={(_e, option) => {
              const next = option?.value ?? '';
              setDraft(next);
              setDirty(true);
              save(next);
            }}
            disabled={saving}
            renderInput={(params) => <TextField {...params} size="small" />}
          />
        );
      }
      return (
        <TextField
          select
          fullWidth
          size="small"
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            setDirty(true);
            save(next);
          }}
          disabled={saving}
        >
          {normalized.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    return (
      <TextField
        fullWidth
        size="small"
        type={type === 'number' ? 'number' : 'text'}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            save(draft);
          } else if (e.key === 'Escape') {
            handleCancel();
          }
        }}
        disabled={saving}
        autoFocus
      />
    );
  };

  return (
    <Box
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleStart}
      sx={{
        p: 1,
        borderRadius: 1,
        cursor: readOnly ? 'default' : 'pointer',
        '&:hover': readOnly
          ? undefined
          : {
              bgcolor: 'action.hover',
            },
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
        {required && (
          <Box component="span" sx={{ color: 'error.main' }}>
            {' *'}
          </Box>
        )}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {editing ? (
          <Box sx={{ flexGrow: 1 }} onClick={(e) => e.stopPropagation()}>
            {renderInput()}
          </Box>
        ) : (
          <Typography variant="body1" sx={{ flexGrow: 1 }}>
            {shown}
          </Typography>
        )}

        {editing && dirty && type !== 'date' && type !== 'select' && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              save(draft);
            }}
            disabled={saving}
          >
            <Iconify icon={'solar:check-circle-bold' as any} width={20} />
          </IconButton>
        )}

        {editing && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}
            disabled={saving}
          >
            <Iconify icon={'solar:close-circle-bold' as any} width={20} />
          </IconButton>
        )}

        {!editing && hover && !readOnly && (
          <Iconify
            icon={'solar:pen-bold' as any}
            width={18}
            sx={{ color: 'text.disabled' }}
          />
        )}
      </Box>

      {helperText && (
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
