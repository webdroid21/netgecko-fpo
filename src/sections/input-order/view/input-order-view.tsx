import type { Farmer } from 'src/sections/farmer/types';
import type { Season, InputOrder, InputProduct } from '../types';

import { useMemo, Fragment, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ToggleButton from '@mui/material/ToggleButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { RouterLink } from 'src/routes/components/router-link';
import { useSearchParams } from 'src/routes/hooks/use-search-params';

import { fDate } from 'src/utils/format-time';
import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { ListFilters } from 'src/components/list-filters';

import { InlineEditField } from 'src/sections/farmer/components/farmer-inline-field';

import { useAuthContext } from 'src/auth/hooks';

import {
  PAY_OPTIONS,
  firstInputValue,
  InputOrderFormDialog,
  getInputProductOptions,
} from '../components/input-order-form-dialog';

// ----------------------------------------------------------------------

const STATUS_CARDS = [
  { key: 'Open', label: 'Open', color: 'warning' as const },
  { key: 'Active', label: 'Active', color: 'info' as const },
  { key: 'Closed', label: 'Closed', color: 'success' as const },
];

// Formula ids like "Input Order #633 - RICHARD SENGENDO - CM60047107K9FG"
// are displayed verbatim — the client wants the column value as it is.
function farmerName(value: unknown): string {
  return (Array.isArray(value) ? value : [value])
    .map((v) => String(v ?? ''))
    .filter(Boolean)
    .join(', ');
}

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
          ) : subtext ? (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {subtext}
            </Typography>
          ) : null}
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
  helper,
  numberOptions,
}: {
  label: string;
  value?: any;
  href?: string;
  helper?: string;
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
      {helper && (
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {helper}
        </Typography>
      )}
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

// ----------------------------------------------------------------------

function getInputProductName(inputIds: string[], allProducts: InputProduct[]) {
  if (!inputIds?.length) return '';
  return inputIds
    .map((id) => {
      const product = allProducts.find((p) => p.id === id);
      return product?.fields['Product ID'] || product?.fields['Product Name'] || product?.fields.Name || id;
    })
    .join(', ');
}

function getInputProductImage(inputIds: string[], allProducts: InputProduct[]) {
  if (!inputIds?.length) return null;
  const product = allProducts.find((p) => p.id === inputIds[0]);
  const image = product?.fields.Image;
  return Array.isArray(image) ? image[0] : image;
}

// ----------------------------------------------------------------------

export function InputOrderView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('inputOrders');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');
  const inputOrderId = searchParams.get('inputOrderId');

  const [orders, setOrders] = useState<InputOrder[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [products, setProducts] = useState<InputProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<InputOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!activeFbo) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/input-orders?${query}`);
      setOrders(data.records || []);
    } catch (error: any) {
      console.error('Fetch orders error:', error?.message);
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

  const fetchSeasons = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/seasons');
      setSeasons(data.records || []);
    } catch (error: any) {
      console.error('Fetch seasons error:', error?.message);
      setSeasons([]);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!activeFbo) return;
    try {
      const query = new URLSearchParams({ fpoId: activeFbo.id }).toString();
      const { data } = await axios.get(`/api/v1/input-products?${query}`);
      setProducts(data.records || []);
    } catch (error: any) {
      console.error('Fetch products error:', error?.message);
      setProducts([]);
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchOrders();
    fetchFarmers();
    fetchSeasons();
    fetchProducts();
  }, [fetchOrders, fetchFarmers, fetchSeasons, fetchProducts]);

  const orderFilterFields = useMemo(
    () => [
      { key: 'orderNumber', label: t('fields.orderNumber') },
      {
        key: 'payNowPayLater',
        label: t('fields.payNowPayLater'),
        options: PAY_OPTIONS.map((o) => ({ value: o, label: o })),
      },
      { key: 'orderDate', label: t('fields.orderDate') },
      { key: 'orderDelivery', label: t('fields.orderDelivery') },
      {
        key: 'orderStatus',
        label: t('fields.orderStatus'),
        options: STATUS_CARDS.map((s) => ({ value: s.key, label: s.label })),
      },
      {
        key: 'season',
        label: t('fields.season'),
        options: seasons.map((s) => ({ value: s.id, label: s.fields.Name || 'Unnamed' })),
      },
      {
        key: 'farmer',
        label: t('fields.farmer'),
        options: farmers.map((farmer) => ({
          value: farmer.id,
          label: farmer.fields.Name || 'Unnamed',
        })),
      },
    ],
    [t, seasons, farmers]
  );

  const orderFilterValue = (o: InputOrder, key: string): any => {
    switch (key) {
      case 'orderNumber':
        return o.fields['Order number'];
      case 'payNowPayLater':
        return o.fields['PayNow PayLater'];
      case 'orderDate':
        return o.fields['Order date'];
      case 'orderDelivery':
        return `${o.fields['Order Delivery'] ?? ''} ${o.fields.Delivered ?? ''} ${o.fields['Delivery date'] ?? ''}`;
      case 'orderStatus':
        return o.fields['Order Status'];
      case 'season':
        return o.fields.Season;
      case 'farmer':
        return o.fields.Farmer;
      default:
        return '';
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = orders;

    if (farmerFilter) {
      list = list.filter((o) => (o.fields.Farmer ?? []).includes(farmerFilter));
    }

    return list.filter((o) => {
      if (term) {
        const text = `${o.fields['Order number'] ?? ''} ${o.fields['PayNow PayLater'] ?? ''} ${o.fields['Order date'] ?? ''} ${o.fields['Order Status'] ?? ''} ${(o.fields['Name (from Farmers)'] || []).join(' ')} ${(o.fields['Name (from Season)'] || []).join(' ')} ${o.fields['Total Order Value (UGX)'] ?? ''}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return orderFilterFields.every(({ key, options }) => {
        const value = filters[key];
        if (!value) return true;
        const fieldValue = orderFilterValue(o, key);
        if (options) {
          return Array.isArray(fieldValue) ? fieldValue.includes(value) : fieldValue === value;
        }
        return String(fieldValue ?? '').toLowerCase().includes(value.toLowerCase());
      });
    });
  }, [orders, search, filters, farmerFilter, orderFilterFields]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [filteredOrders, selectedId]
  );

  useEffect(() => {
    if (inputOrderId && filteredOrders.some((o) => o.id === inputOrderId)) {
      setSelectedId(inputOrderId);
      return;
    }
    if (selectedId || !filteredOrders.length) return;
    setSelectedId(filteredOrders[0]?.id);
  }, [filteredOrders, selectedId, inputOrderId]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const value = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.fields['Total Order Value (UGX)']) || 0),
      0
    );
    const weight = filteredOrders.reduce(
      (sum, o) => sum + (Number(o.fields['Total Weight (kg)']) || 0),
      0
    );
    return { total, value, weight };
  }, [filteredOrders]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_CARDS.forEach((s) => (counts[s.key] = 0));
    orders.forEach((o) => {
      const status = o.fields['Order Status'];
      if (status && counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
  }, [orders]);

  const handleAdd = () => {
    setEditingOrder(null);
    setFormOpen(true);
  };

  const handleEdit = (order: InputOrder) => {
    setEditingOrder(order);
    setFormOpen(true);
  };

  const handleStatusChange = async (order: InputOrder, newStatus: string) => {
    if (order.fields['Order Status'] === newStatus) return;
    try {
      await axios.patch(`/api/v1/input-orders/${order.id}`, {
        fields: { 'Order Status': newStatus },
      });
      fetchOrders();
    } catch (error: any) {
      console.error('Update status error:', error?.message);
      alert(error?.response?.data?.error?.message || error?.message || t('statusUpdateFailed'));
    }
  };

  const handleFarmerCreated = (farmer: Farmer) => {
    setFarmers((prev) => [...prev, farmer]);
  };

  const statusColor = (status?: string) => {
    if (status === 'Open') return 'warning';
    if (status === 'Active') return 'info';
    if (status === 'Closed') return 'success';
    if (status === 'Cancelled') return 'error';
    return 'default';
  };

  const renderSummary = () => (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SummaryCard
            title={t('summary.totalOrders.title')}
            total={stats.total}
            trend={{ value: 0, label: t('summary.trendLabel') }}
            color="primary"
            icon="solar:cart-4-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SummaryCard
            title={t('summary.totalValue.title')}
            total={stats.value}
            trend={{ value: 0, label: t('summary.trendLabel') }}
            color="success"
            icon="solar:tag-price-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SummaryCard
            title={t('summary.totalWeight.title')}
            total={stats.weight}
            trend={{ value: 0, label: t('summary.trendLabel') }}
            color="info"
            icon="solar:scale-bold-duotone"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STATUS_CARDS.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.key}>
            <SummaryCard
              title={t(`summary.statusCardTitles.${s.key}`)}
              total={statusCounts[s.key]}
              color={s.color}
              icon="solar:notes-bold-duotone"
            />
          </Grid>
        ))}
      </Grid>
    </>
  );

  const renderList = () => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: (theme) => `1px solid ${theme.vars.palette.divider}` }}>
        <Stack direction="row" spacing={1} alignItems="center">
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
          <ListFilters
            fields={orderFilterFields}
            values={filters}
            onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
            onClear={() => setFilters({})}
          />
        </Stack>
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
                      primary={String(order.fields['Order number'] ?? '') || t('unnamedOrder')}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    {order.fields['Order Status'] && (
                      <Label color={statusColor(order.fields['Order Status'])}>
                        {order.fields['Order Status']}
                      </Label>
                    )}
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {farmerName(order.fields['Name (from Farmers)'])}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {(order.fields['Name (from Season)'] || []).join(', ')} ·{' '}
                    {fNumber(order.fields['Total Order Value (UGX)'])} UGX · {order.fields['PayNow PayLater']}
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
          <InputOrderFormDialog
            embedded
            open={formOpen}
            order={editingOrder}
            fpoId={activeFbo?.id}
            farmers={farmers}
            seasons={seasons}
            products={products}
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
    const orderDate = f['Order date'] || f['Created time'];
    const formattedDate = orderDate ? fDate(orderDate) : '—';

    const editable = f['Order Status'] === 'Open';
    const productOptions = getInputProductOptions(products, selectedOrder);

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
              <Typography variant="h5">{String(f['Order number'] ?? '') || t('unnamedOrder')}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {formattedDate}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Tooltip
                title={f['Order Status'] !== 'Open' ? t('fields.orderStatusHelper') : ''}
                disableHoverListener={f['Order Status'] === 'Open'}
              >
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={f['Order Status'] !== 'Open'}
                    onClick={() => handleEdit(selectedOrder)}
                  >
                    {t('actions.edit')}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          <Box sx={{ mb: 3 }}>
            <ToggleButtonGroup
              value={f['Order Status']}
              exclusive
              fullWidth
              onChange={(_, value) => value && selectedOrder && handleStatusChange(selectedOrder, value)}
              aria-label={t('fields.orderStatus')}
            >
              {STATUS_CARDS.map((s) => (
                <ToggleButton
                  key={s.key}
                  value={s.key}
                  color="primary"
                  aria-label={s.label}
                >
                  {t(`summary.statusCards.${s.key}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
              {t('fields.orderStatusHelper')}
            </Typography>
          </Box>

          <Grid container spacing={3} key={selectedOrder.id}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1 }}>
                {t('sections.order')}
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="input-orders"
                recordId={selectedOrder.id}
                name="Farmer"
                label={t('fields.farmer')}
                required
                type="select"
                      searchable
                options={farmers.map((farmer) => ({
                  value: farmer.id,
                  label: farmer.fields.Name || 'Unnamed',
                }))}
                value={f.Farmer?.[0]}
                displayValue={(f['Name (from Farmers)'] || []).join(', ') || '—'}
                arrayValue
                readOnly={!editable}
                onSaved={fetchOrders}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="input-orders"
                recordId={selectedOrder.id}
                name="Season"
                label={t('fields.season')}
                required
                type="select"
                      searchable
                options={seasons.map((s) => ({
                  value: s.id,
                  label: s.fields.Name || 'Unnamed',
                }))}
                value={f.Season?.[0]}
                displayValue={(f['Name (from Season)'] || []).join(', ') || '—'}
                arrayValue
                readOnly={!editable}
                onSaved={fetchOrders}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="input-orders"
                recordId={selectedOrder.id}
                name="PayNow PayLater"
                label={t('fields.payNowPayLater')}
                required
                type="select"
                options={PAY_OPTIONS}
                value={f['PayNow PayLater']}
                readOnly={!editable}
                onSaved={fetchOrders}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.orderDate')} value={formattedDate} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.totalOrderValue')}
                value={f['Total Order Value (UGX)']}
                helper={t('fields.willBeUpdatedByNetGecko')}
                numberOptions={{ minimumFractionDigits: 2 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.totalWeight')} value={f['Total Weight (kg)']} />
            </Grid>

            {[1, 2, 3, 4, 5].map((idx) => {
              const inputIds = f[`Input ${idx}`] || [];
              const qty = f[`Quantity Input ${idx}`];
              const lookupName = (
                f[`Product ID (from Input ${idx})`] ||
                f[`Product Name (from Input ${idx})`] ||
                []
              ).join(', ');
              const resolvedName = getInputProductName(inputIds, products);
              const productName = lookupName || resolvedName;
              const lookupImage = f[`Image Input ${idx}`]?.[0];
              const resolvedImage = !lookupImage ? getInputProductImage(inputIds, products) : null;
              const image = lookupImage || resolvedImage;

              if ((!inputIds?.length && !productName) || !qty) return null;

              return (
                <Fragment key={idx}>
                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1 }}>
                      {t('fields.input', { index: idx })}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 1,
                      }}
                    >
                      {image?.url ? (
                        <Box
                          component="img"
                          src={image.url}
                          alt={productName}
                          sx={{ width: 1, height: 1, objectFit: 'cover' }}
                        />
                      ) : (
                        <Iconify icon={'solar:gallery-wide-bold-duotone' as any} width={24} />
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('fields.imageInput', { index: idx })}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <InlineEditField
                      resource="input-orders"
                      recordId={selectedOrder.id}
                      name={`Input ${idx}`}
                      label={t('fields.input', { index: idx })}
                      required={idx === 1}
                      type="select"
                      searchable
                      options={
                        idx === 1
                          ? productOptions
                          : [{ value: '', label: t('form.noneOption') }, ...productOptions]
                      }
                      value={firstInputValue(f[`Input ${idx}`])}
                      displayValue={productName || '—'}
                      arrayValue
                      readOnly={!editable}
                      onSaved={fetchOrders}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <InlineEditField
                      resource="input-orders"
                      recordId={selectedOrder.id}
                      name={`Quantity Input ${idx}`}
                      label={t('fields.quantityInput', { index: idx })}
                      required={idx === 1}
                      type="number"
                      value={qty}
                      readOnly={!editable}
                      onSaved={fetchOrders}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailRow
                      label={t('fields.retailPriceInput', { index: idx })}
                      value={f[`Retail Price Input ${idx}`]}
                      helper={t('fields.willBeUpdatedByNetGecko')}
                      numberOptions={{ minimumFractionDigits: 2 }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailRow
                      label={t('fields.totalValueInput', { index: idx })}
                      value={f[`Total Value Input ${idx}`]}
                      helper={t('fields.willBeUpdatedByNetGecko')}
                      numberOptions={{ minimumFractionDigits: 2 }}
                    />
                  </Grid>
                </Fragment>
              );
            })}
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

      <Grid container spacing={2} sx={{ height: { md: 'calc(100vh - 360px)' } }}>
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
