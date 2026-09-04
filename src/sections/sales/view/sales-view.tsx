import type { Buyer, SalesOrder, InventoryItem } from '../types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { SalesFormDialog } from '../components/sales-form-dialog';

// ----------------------------------------------------------------------

function SummaryCard({
  title,
  total,
  subtext,
  color,
  icon,
}: {
  title: string;
  total: number;
  subtext: string;
  color: 'primary' | 'success' | 'info' | 'warning' | 'error';
  icon: string;
}) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box sx={{ color: `${color}.main` }}>
          <Iconify icon={icon as any} width={28} />
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ my: 0.5 }}>
            {fNumber(total)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {subtext}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value?: any }) {
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{value ?? '—'}</Typography>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function SalesView() {
  const { t } = useTranslate('sales');
  const { t: tCommon } = useTranslate('common');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/v1/sales-orders');
      setOrders(data.records || []);
    } catch (error: any) {
      console.error('Fetch sales orders error:', error?.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBuyers = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/buyers');
      setBuyers(data.records || []);
    } catch (error: any) {
      console.error('Fetch buyers error:', error?.message);
      setBuyers([]);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/inventory');
      setInventory(data.records || []);
    } catch (error: any) {
      console.error('Fetch inventory error:', error?.message);
      setInventory([]);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchBuyers();
    fetchInventory();
  }, [fetchOrders, fetchBuyers, fetchInventory]);

  useEffect(() => {
    if (selectedId || !orders.length) return;
    setSelectedId(orders[0]?.id);
  }, [orders, selectedId]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((o) => {
      const text = `${o.fields.Date ?? ''} ${(o.fields['Name (from Buyer)'] || []).join(' ')}`.toLowerCase();
      return text.includes(term);
    });
  }, [orders, search]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [orders, filteredOrders, selectedId]
  );

  const stats = useMemo(() => {
    const total = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.fields.Revenue) || 0),
      0
    );
    const quantity = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.fields['Quantity (kg)']) || 0),
      0
    );
    return { total, quantity, count: filteredOrders.length };
  }, [filteredOrders]);

  const handleAdd = () => {
    setEditingOrder(null);
    setFormOpen(true);
  };

  const handleEdit = (order: SalesOrder) => {
    setEditingOrder(order);
    setFormOpen(true);
  };

  const handleDelete = async (order: SalesOrder) => {
    const date = order.fields.Date ?? order.fields['Order Date'] ?? '';
    if (!confirm(t('confirmDeleteOrder', { date }))) return;
    try {
      await axios.delete(`/api/v1/sales-orders/${order.id}`);
      fetchOrders();
    } catch (error: any) {
      console.error('Delete sales order error:', error?.message);
    }
  };

  const handleBuyerCreated = (buyer: Buyer) => {
    setBuyers((prev) => [...prev, buyer]);
  };

  const buyerName = (id?: string) => buyers.find((b) => b.id === id)?.fields.Name || '—';
  const productName = (id?: string) => inventory.find((i) => i.id === id)?.fields['Product ID'] || inventory.find((i) => i.id === id)?.fields.Name || '—';

  const renderSummary = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <SummaryCard
          title={t('summary.totalOrders.title')}
          total={stats.count}
          subtext={t('summary.totalOrders.subtext')}
          color="primary"
          icon="solar:cart-4-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <SummaryCard
          title={t('summary.totalRevenue.title')}
          total={stats.total}
          subtext={t('summary.totalRevenue.subtext')}
          color="success"
          icon="solar:tag-price-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <SummaryCard
          title={t('summary.totalQuantity.title')}
          total={stats.quantity}
          subtext={t('summary.totalQuantity.subtext')}
          color="info"
          icon="solar:scale-bold-duotone"
        />
      </Grid>
    </Grid>
  );

  const renderList = () => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: (theme) => `1px solid ${theme.vars.palette.divider}` }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Iconify icon={'solar:magnifer-bold-duotone' as any} sx={{ mr: 1, color: 'text.disabled' }} />,
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>{tCommon('loading')}</Box>
        ) : (
          <List disablePadding>
            {filteredOrders.map((order) => {
              const isSelected = order.id === selectedOrder?.id;

              return (
                <ListItemButton
                  key={order.id}
                  selected={isSelected}
                  onClick={() => setSelectedId(order.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <ListItemText
                    primary={order.fields.Date || `${t('fields.orderNumber')} ${order.fields['Order #']}`}
                    primaryTypographyProps={{ variant: 'subtitle2' }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {buyerName(order.fields.Buyer?.[0])} · {productName(order.fields.Product?.[0])}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {fNumber(order.fields['Quantity (kg)'])} kg · {fNumber(order.fields.Revenue)} UGX
                  </Typography>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Card>
  );

  const renderDetail = () => {
    if (!selectedOrder) {
      return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('emptyDetail')}
          </Typography>
        </Card>
      );
    }

    const f = selectedOrder.fields;

    return (
      <Card sx={{ height: '100%', overflow: 'auto' }}>
        <CardContent>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography variant="h5">{f.Date || `${t('fields.orderNumber')} ${f['Order #']}`}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {f['Order Date']} · {buyerName(f.Buyer?.[0])}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleEdit(selectedOrder)}>
                {t('actions.edit')}
              </Button>
              <IconButton color="error" onClick={() => handleDelete(selectedOrder)}>
                <Iconify icon={'solar:trash-bin-trash-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.orderNumber')} value={f['Order #']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.orderDate')} value={f['Order Date']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.buyer')} value={buyerName(f.Buyer?.[0])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.product')} value={productName(f.Product?.[0])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.quantityKg')} value={f['Quantity (kg)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.pricePerKg')} value={f['Price per KG (UGX)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.revenue')} value={f.Revenue} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.year')} value={f.Year} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardContent maxWidth="xl">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" color="primary">{t('page.title')}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('page.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
          onClick={handleAdd}
        >
          {t('page.newOrder')}
        </Button>
      </Stack>

      {renderSummary()}

      <Grid container spacing={2} sx={{ height: { md: 'calc(100vh - 320px)' } }}>
        <Grid size={{ xs: 12, md: 4 }} sx={{ height: 1 }}>
          {renderList()}
        </Grid>

        <Grid size={{ xs: 12, md: 8 }} sx={{ height: 1 }}>
          {renderDetail()}
        </Grid>
      </Grid>

      <SalesFormDialog
        open={formOpen}
        order={editingOrder}
        buyers={buyers}
        inventory={inventory}
        onClose={() => setFormOpen(false)}
        onSaved={fetchOrders}
        onBuyerCreated={handleBuyerCreated}
      />
    </DashboardContent>
  );
}
