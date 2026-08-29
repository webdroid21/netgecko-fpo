import type { Buyer, SalesOrder, InventoryItem } from '../types';

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
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';

import { Form, Field } from 'src/components/hook-form';

import { BuyerFormDialog } from './buyer-form-dialog';

// ----------------------------------------------------------------------

const schema = z.object({
  'Order Date': z.date({ message: 'Required' }),
  Buyer: z.string().min(1, { message: 'Required' }),
  Product: z.string().min(1, { message: 'Required' }),
  'Quantity (kg)': z.number().min(1, { message: 'Required' }),
  'Price per KG (UGX)': z.number().min(1, { message: 'Required' }),
});

type FormValues = z.infer<typeof schema>;

// ----------------------------------------------------------------------

type SalesFormDialogProps = {
  open: boolean;
  order?: SalesOrder | null;
  buyers: Buyer[];
  inventory: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
  onBuyerCreated?: (buyer: Buyer) => void;
};

function itemLabel(item: InventoryItem) {
  return item.fields['Product ID'] || item.fields.Name || 'Unnamed';
}

function getDefaultValues(order?: SalesOrder | null): FormValues {
  const f = order?.fields;
  return {
    'Order Date': f?.['Order Date'] ? dayjs(f['Order Date']).toDate() : (undefined as any),
    Buyer: f?.Buyer?.[0] ?? '',
    Product: f?.Product?.[0] ?? '',
    'Quantity (kg)': f?.['Quantity (kg)'] ?? undefined,
    'Price per KG (UGX)': f?.['Price per KG (UGX)'] ?? undefined,
  };
}

export function SalesFormDialog({
  open,
  order,
  buyers,
  inventory,
  onClose,
  onSaved,
  onBuyerCreated,
}: SalesFormDialogProps) {
  const isEdit = Boolean(order);
  const [buyerFormOpen, setBuyerFormOpen] = useState(false);

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

    if (data['Order Date']) {
      payload['Order Date'] = dayjs(data['Order Date']).format('YYYY-MM-DD');
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

  const handleNewBuyer = (buyer?: Buyer) => {
    setBuyerFormOpen(false);
    if (buyer) {
      setValue('Buyer', buyer.id, { shouldValidate: true });
      onBuyerCreated?.(buyer);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? t('form.title.edit') : t('form.title.new')}</DialogTitle>

      <Form methods={methods} onSubmit={onSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flexGrow: 1 }}>
                  <Field.Select name="Buyer" label={t('form.buyer')} required>
                    <MenuItem value="">
                      <em>{t('form.selectPlaceholder')}</em>
                    </MenuItem>
                    {buyers.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.fields.Name || 'Unnamed'}
                      </MenuItem>
                    ))}
                  </Field.Select>
                </Box>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => setBuyerFormOpen(true)}
                  startIcon={
                    <Box component="span" sx={{ fontSize: 20 }}>
                      +
                    </Box>
                  }
                >
                  {t('form.addNewBuyer')}
                </Button>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.Select name="Product" label={t('form.product')} required>
                <MenuItem value="">
                  <em>{t('form.selectPlaceholder')}</em>
                </MenuItem>
                {inventory.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {itemLabel(item)}
                  </MenuItem>
                ))}
              </Field.Select>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Field.DatePicker name="Order Date" label={t('form.orderDate')} />
            </Grid>

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

      <BuyerFormDialog
        open={buyerFormOpen}
        onClose={() => setBuyerFormOpen(false)}
        onSaved={handleNewBuyer}
      />
    </Dialog>
  );
}
