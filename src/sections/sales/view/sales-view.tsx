import type { SalesOrder } from '../types';
import type { Crop } from 'src/sections/land/types';
import type { Farmer } from 'src/sections/farmer/types';
import type { Season } from 'src/sections/input-order/types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { RouterLink } from 'src/routes/components/router-link';
import { useSearchParams } from 'src/routes/hooks/use-search-params';

import { fDate } from 'src/utils/format-time';
import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { SalesFormDialog } from '../components/sales-form-dialog';

// ----------------------------------------------------------------------

function SummaryCard({
  title,
  total,
  subtext,
  trend,
  color,
  icon,
}: {
  title: string;
  total: number;
  subtext?: string;
  trend?: { value: number; label: string };
  color: 'primary' | 'success' | 'info' | 'warning' | 'error';
  icon: string;
}) {
  const trendIcon = trend ? (trend.value > 0 ? 'solar:arrow-up-bold-duotone' : trend.value < 0 ? 'solar:arrow-down-bold-duotone' : 'solar:arrow-right-bold-duotone') : null;

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
          {trend ? (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Iconify icon={trendIcon as any} width={14} sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {trend.value}% {trend.label}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {subtext}
            </Typography>
          )}
        </Box>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

function DetailRow({
  label,
  value,
  href,
  numberOptions,
}: {
  label: string;
  value?: any;
  href?: string;
  numberOptions?: Intl.NumberFormatOptions;
}) {
  let display = value ?? '—';
  if (typeof value === 'number') {
    display = fNumber(value, numberOptions);
  } else if (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))) {
    display = fNumber(Number(value), numberOptions);
  }

  const content = (
    <>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={href ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}
      >
        {display}
      </Typography>
    </>
  );

  if (href) {
    return (
      <MuiLink
        component={RouterLink}
        href={href}
        underline="none"
        color="text.primary"
        sx={{
          p: 1,
          display: 'block',
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>{content}</Box>
          <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ flexShrink: 0 }} />
        </Stack>
      </MuiLink>
    );
  }

  return <Box sx={{ p: 1 }}>{content}</Box>;
}

const yearTrend = (current: number, previous: number) =>
  previous !== 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;

// ----------------------------------------------------------------------

export function SalesView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('sales');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');
  const salesOrderId = searchParams.get('salesOrderId');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!activeFbo) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/sales-orders?${query}`);
      setOrders(data.records || []);
    } catch (error: any) {
      console.error('Fetch sales orders error:', error?.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [activeFbo]);

  const fetchFarmers = useCallback(async () => {
    if (!activeFbo) return;
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/farmers?${query}`);
      setFarmers(data.records || []);
    } catch (error: any) {
      console.error('Fetch farmers error:', error?.message);
      setFarmers([]);
    }
  }, [activeFbo]);

  const fetchCrops = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/crops');
      setCrops(data.records || []);
    } catch (error: any) {
      console.error('Fetch crops error:', error?.message);
      setCrops([]);
    }
  }, []);

  const fetchSeasons = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/seasons');
      setSeasons(data.records || []);
    } catch (error: any) {
      console.error('Fetch seasons error:', error?.message);
      setSeasons([]);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchFarmers();
    fetchCrops();
    fetchSeasons();
  }, [fetchOrders, fetchFarmers, fetchCrops, fetchSeasons]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = orders;

    if (farmerFilter) {
      list = list.filter((o) => {
        const farmerIds = o.fields.Farmers;
        return Array.isArray(farmerIds) ? farmerIds.includes(farmerFilter) : farmerIds === farmerFilter;
      });
    }

    if (!term) return list;

    return list.filter((o) => {
      const text = `${o.fields.Name ?? ''} ${o.fields['Order #'] ?? ''} ${(o.fields['Name (from Season)'] || []).join(' ')}`.toLowerCase();
      return text.includes(term);
    });
  }, [orders, search, farmerFilter]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [filteredOrders, selectedId]
  );

  useEffect(() => {
    if (salesOrderId && filteredOrders.some((o) => o.id === salesOrderId)) {
      setSelectedId(salesOrderId);
      return;
    }
    if (selectedId || !filteredOrders.length) return;
    setSelectedId(filteredOrders[0]?.id);
  }, [filteredOrders, selectedId, salesOrderId]);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const s = {
      count: filteredOrders.length,
      value: 0,
      quantity: 0,
      countThisYear: 0,
      valueThisYear: 0,
      quantityThisYear: 0,
      countLastYear: 0,
      valueLastYear: 0,
      quantityLastYear: 0,
    };

    filteredOrders.forEach((o) => {
      const amount = Number(o.fields['Total Price']) || 0;
      const qty = Number(o.fields['Quantity (kg)']) || 0;
      s.value += amount;
      s.quantity += qty;
      const year = Number(o.fields['Arrive Year']) || new Date(o.fields['Date Received']).getFullYear();
      if (year === currentYear) {
        s.countThisYear += 1;
        s.valueThisYear += amount;
        s.quantityThisYear += qty;
      } else if (year === lastYear) {
        s.countLastYear += 1;
        s.valueLastYear += amount;
        s.quantityLastYear += qty;
      }
    });

    return s;
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
    const date = order.fields['Date Received'] ?? order.fields.Name ?? '';
    if (!confirm(t('confirmDeleteOrder', { date }))) return;
    try {
      await axios.delete(`/api/v1/sales-orders/${order.id}`);
      fetchOrders();
    } catch (error: any) {
      console.error('Delete sales order error:', error?.message);
    }
  };

  const handleFarmerCreated = (farmer: Farmer) => {
    setFarmers((prev) => [...prev, farmer]);
  };

  const farmerName = (id?: string) => {
    const farmer = farmers.find((f) => f.id === id);
    if (!farmer) return '—';
    return (
      `${farmer.fields['Given Name'] || ''} ${farmer.fields.Surname || ''}`.trim() ||
      farmer.fields.Name ||
      '—'
    );
  };
  const productName = (id?: string) =>
    crops.find((c) => c.id === id)?.fields['Crop Name'] ||
    crops.find((c) => c.id === id)?.fields['Product Name'] ||
    '—';

  const renderSummary = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <SummaryCard
          title={t('summary.totalOrders.title')}
          total={stats.countThisYear}
          trend={{
            value: yearTrend(stats.countThisYear, stats.countLastYear),
            label: t('summary.vsLastYear'),
          }}
          color="primary"
          icon="solar:cart-4-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <SummaryCard
          title={t('summary.totalValue.title')}
          total={stats.valueThisYear}
          trend={{
            value: yearTrend(stats.valueThisYear, stats.valueLastYear),
            label: t('summary.vsLastYear'),
          }}
          color="success"
          icon="solar:tag-price-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <SummaryCard
          title={t('summary.totalQuantity.title')}
          total={stats.quantityThisYear}
          trend={{
            value: yearTrend(stats.quantityThisYear, stats.quantityLastYear),
            label: t('summary.vsLastYear'),
          }}
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
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={`${t('fields.orderNumber')} ${order.fields['Order #'] ?? ''}`}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {[
                      farmerName(order.fields.Farmers?.[0]),
                      productName(order.fields.Product?.[0]),
                      (order.fields['Name (from Season)'] || []).join(', '),
                    ]
                      .filter((part) => part && part !== '—')
                      .join(' · ')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {fNumber(order.fields['Quantity (kg)'])} kg · {fNumber(order.fields['Total Price'])} UGX
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
    if (formOpen) {
      return (
        <Card sx={{ height: '100%', overflow: 'hidden' }}>
          <SalesFormDialog
            embedded
            open={formOpen}
            order={editingOrder}
            fpoId={activeFbo?.id}
            farmers={farmers}
            crops={crops}
            seasons={seasons}
            onClose={() => setFormOpen(false)}
            onSaved={fetchOrders}
            onFarmerCreated={handleFarmerCreated}
          />
        </Card>
      );
    }

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
    const farmerHref = f.Farmers?.[0]
      ? `/dashboard/farmers?farmerId=${f.Farmers[0]}&fpoName=${encodeURIComponent(activeFbo?.name ?? '')}`
      : undefined;

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
              <Typography variant="h5">{`${t('fields.orderNumber')} ${f['Order #'] ?? ''}`}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {fDate(f['Date Received'])} · {(f['Name (from Season)'] || []).join(', ')}
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
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                {t('sections.order')}
              </Typography>
              <Divider sx={{ mt: 0.5 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.orderNumber')} value={f['Order #']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.dateReceived')} value={fDate(f['Date Received'])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.farmer')}
                value={farmerName(f.Farmers?.[0])}
                href={farmerHref}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.product')} value={productName(f.Product?.[0])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.season')}
                value={(f['Name (from Season)'] || []).join(', ')}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', pt: 1 }}>
                {t('sections.payment')}
              </Typography>
              <Divider sx={{ mt: 0.5 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.quantityKg')} value={f['Quantity (kg)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.pricePerKg')} value={f['Price per KG (UGX)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.totalPrice')} value={f['Total Price']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.millingFee')} value={f['Milling Fee (UGX)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.transportFee')} value={f['Transport Fee (UGX)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.voucherTotal')} value={f['Voucher Total (UGX)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.paid')} value={f.Paid ? t('fields.paidYes') : t('fields.paidNo')} />
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
          color="primary"
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
    </DashboardContent>
  );
}
