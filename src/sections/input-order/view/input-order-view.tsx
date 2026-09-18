import type { Farmer } from 'src/sections/farmer/types';
import type { Season, InputOrder, InputProduct } from '../types';
import type { ListFilterField, ListFilterValues } from 'src/components/list-filters';

import { varAlpha } from 'minimal-shared/utils';
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
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import ListItemButton from '@mui/material/ListItemButton';

import { RouterLink } from 'src/routes/components/router-link';
import { useSearchParams } from 'src/routes/hooks/use-search-params';

import { useRefetchOnVisible } from 'src/hooks/use-refetch-on-visible';

import { fDate } from 'src/utils/format-time';
import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { DetailDialog } from 'src/components/detail-dialog';
import { ListFilters, matchesListFilters } from 'src/components/list-filters';

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
  if (Array.isArray(value)) {
    // Airtable lookup/rollup fields arrive as arrays — format each numeric
    // element so amounts keep thousand separators.
    display =
      value
        .map((v) =>
          typeof v === 'number' || (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)))
            ? fNumber(Number(v), numberOptions)
            : typeof v === 'object'
              ? ''
              : String(v ?? '')
        )
        .filter(Boolean)
        .join(', ') || '—';
  } else if (typeof value === 'number') {
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
  const { activeFbo, canEdit } = useAuthContext();
  const { t } = useTranslate('inputOrders');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');
  const inputOrderId = searchParams.get('inputOrderId');
  const mdUp = useMediaQuery((theme) => theme.breakpoints.up('md'));

  const [orders, setOrders] = useState<InputOrder[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [products, setProducts] = useState<InputProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListFilterValues>({});
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
    }
  }, [activeFbo]);

  const fetchSeasons = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/seasons');
      setSeasons(data.records || []);
    } catch (error: any) {
      console.error('Fetch seasons error:', error?.message);
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
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchOrders();
    fetchFarmers();
    fetchSeasons();
    fetchProducts();
  }, [fetchOrders, fetchFarmers, fetchSeasons, fetchProducts]);

  const refetchAll = useCallback(() => {
    fetchOrders();
    fetchFarmers();
    fetchSeasons();
    fetchProducts();
  }, [fetchOrders, fetchFarmers, fetchSeasons, fetchProducts]);

  useRefetchOnVisible(refetchAll, 5_000);

  // Only "Display in App" products are pickable, but keep the full list for
  // resolving product names/images on orders that already link hidden ones.
  const displayProducts = useMemo(
    () => products.filter((p) => p.fields['Display in App']),
    [products]
  );

  const orderFilterFields = useMemo(
    (): ListFilterField[] => [
      {
        key: 'farmer',
        label: t('fields.farmer'),
        options: farmers.map((farmer) => ({
          value: farmer.id,
          label: farmer.fields.Name || 'Unnamed',
        })),
      },
      { key: 'orderNumber', label: t('fields.orderNumber') },
      {
        key: 'payNowPayLater',
        label: t('fields.payNowPayLater'),
        options: PAY_OPTIONS.map((o) => ({ value: o, label: o })),
      },
      { key: 'orderDate', label: t('fields.orderDate'), type: 'date' },
      { key: 'orderDelivery', label: t('fields.orderDelivery'), type: 'date' },
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
        return [o.fields['Order Delivery'], o.fields.Delivered, o.fields['Delivery date']];
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
        const text = `${o.fields['Order number'] ?? ''} ${o.fields['PayNow PayLater'] ?? ''} ${o.fields['Order date'] ?? ''} ${o.fields['Order Status'] ?? ''} ${(o.fields['Name (from Farmers)'] || []).join(' ')} ${(o.fields['Name (from Season)'] || []).join(' ')} ${o.fields['Order Delivery'] ?? ''} ${o.fields['Delivery date'] ?? ''} ${o.fields['Total Order Value (UGX)'] ?? ''} ${fNumber(o.fields['Total Order Value (UGX)'])}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return matchesListFilters(o, orderFilterFields, filters, orderFilterValue);
    });
  }, [orders, search, filters, farmerFilter, orderFilterFields]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [filteredOrders, selectedId]
  );

  useEffect(() => {
    if (inputOrderId && filteredOrders.some((o) => o.id === inputOrderId)) {
      setSelectedId(inputOrderId);
      if (!mdUp) setDetailOpen(true);
      return;
    }
    if (selectedId || !filteredOrders.length) return;
    setSelectedId(filteredOrders[0]?.id);
  }, [filteredOrders, selectedId, inputOrderId, mdUp]);


  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_CARDS.forEach((s) => (counts[s.key] = 0));
    orders.forEach((o) => {
      const status = o.fields['Order Status'];
      if (status && counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
  }, [orders]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!mdUp) setDetailOpen(true);
  };

  const handleAdd = () => {
    setEditingOrder(null);
    setFormOpen(true);
  };

  const handleEdit = (order: InputOrder) => {
    setEditingOrder(order);
    setFormOpen(true);
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
                  onClick={() => handleSelect(order.id)}
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

  const renderDetail = (onCloseDetail?: () => void) => {
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
    const productOptions = getInputProductOptions(displayProducts, selectedOrder, products);

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
            <Typography variant="h5">{String(f['Order number'] ?? '') || t('unnamedOrder')}</Typography>

            <Stack direction="row" alignItems="center" spacing={1}>
              {canEdit && (
                <Tooltip
                  title={f['Order Status'] !== 'Open' ? t('fields.orderStatusHelper') : ''}
                  disableHoverListener={f['Order Status'] === 'Open'}
                >
                  <span>
                    <Button
                      color="primary"
                      variant="contained"
                      size="small"
                      disabled={f['Order Status'] !== 'Open'}
                      onClick={() => handleEdit(selectedOrder)}
                    >
                      {t('actions.edit')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {onCloseDetail && (
                <IconButton onClick={onCloseDetail}>
                  <Iconify icon={'mingcute:close-line' as any} />
                </IconButton>
              )}
            </Stack>
          </Stack>

          <Box sx={{ mb: 3 }}>
            {/* Status is managed by NetGecko in Airtable — read-only
                segmented display, same look as the previous control. */}
            <Box
              role="group"
              aria-label={t('fields.orderStatus')}
              sx={{
                display: 'flex',
                p: 0.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {STATUS_CARDS.map((s) => {
                const selected = f['Order Status'] === s.key;
                return (
                  <Box
                    key={s.key}
                    sx={(theme) => ({
                      flex: 1,
                      py: 1,
                      textAlign: 'center',
                      borderRadius: 0.75,
                      typography: 'subtitle2',
                      color: selected ? `${s.color}.main` : 'text.secondary',
                      bgcolor: selected
                        ? varAlpha(theme.vars.palette[s.color].mainChannel, 0.16)
                        : 'transparent',
                    })}
                  >
                    {t(`summary.statusCards.${s.key}`)}
                  </Box>
                );
              })}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
              {t('fields.statusManagedByNetGecko')}
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
        {canEdit && (
          <Button
            color="primary"
            variant="contained"
            startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
            onClick={handleAdd}
          >
            {t('page.newOrder')}
          </Button>
        )}
      </Stack>

      {renderSummary()}

      <Grid container spacing={2} sx={{ height: { md: 'calc(100vh - 360px)' } }}>
        <Grid size={{ xs: 12, md: 4 }} sx={{ height: 1 }}>
          {renderList()}
        </Grid>

        {mdUp && (
          <Grid size={{ xs: 12, md: 8 }} sx={{ height: 1 }}>
            {renderDetail()}
          </Grid>
        )}
      </Grid>

      <InputOrderFormDialog
        open={formOpen}
        order={editingOrder}
        fpoId={activeFbo?.id}
        farmers={farmers}
        seasons={seasons}
        products={displayProducts}
        allProducts={products}
        onClose={() => setFormOpen(false)}
        onSaved={fetchOrders}
        onFarmerCreated={handleFarmerCreated}
      />

      <DetailDialog open={detailOpen && !mdUp} onClose={() => setDetailOpen(false)}>
        {renderDetail(() => setDetailOpen(false))}
      </DetailDialog>
    </DashboardContent>
  );
}
