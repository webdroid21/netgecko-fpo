import type { Farmer } from 'src/sections/farmer/types';
import type { Season, InputOrder, InputProduct } from '../types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { RouterLink } from 'src/routes/components/router-link';
import { useSearchParams } from 'src/routes/hooks/use-search-params';

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { InputOrderFormDialog } from '../components/input-order-form-dialog';

// ----------------------------------------------------------------------

const STATUS_CARDS = [
  { key: 'Open', label: 'Pending Fulfillment', color: 'warning' as const },
  { key: 'Active', label: 'Requested', color: 'info' as const },
  { key: 'Closed', label: 'Delivered', color: 'success' as const },
  { key: 'Cancelled', label: 'Cancelled', color: 'error' as const },
];

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

function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value?: any;
  href?: string;
}) {
  const content = (
    <>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{value ?? '—'}</Typography>
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
        {content}
      </MuiLink>
    );
  }

  return <Box sx={{ p: 1 }}>{content}</Box>;
}

// ----------------------------------------------------------------------

export function InputOrderView() {
  const { activeFbo } = useAuthContext();
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');

  const [orders, setOrders] = useState<InputOrder[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [products, setProducts] = useState<InputProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
    try {
      const { data } = await axios.get('/api/v1/input-products');
      setProducts(data.records || []);
    } catch (error: any) {
      console.error('Fetch products error:', error?.message);
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchFarmers();
    fetchSeasons();
    fetchProducts();
  }, [fetchOrders, fetchFarmers, fetchSeasons, fetchProducts]);

  useEffect(() => {
    if (selectedId || !orders.length) return;
    const match = farmerFilter
      ? orders.find((o) => (o.fields.Farmer ?? []).includes(farmerFilter))
      : null;
    setSelectedId(match?.id || orders[0]?.id);
  }, [orders, farmerFilter, selectedId]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((o) => {
      const text = `${o.fields['Order number'] ?? ''} ${(o.fields['Name (from Farmers)'] || []).join(' ')} ${(o.fields['Name (from Season)'] || []).join(' ')}`.toLowerCase();
      return text.includes(term);
    });
  }, [orders, search]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [orders, filteredOrders, selectedId]
  );

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

  const handleDelete = async (order: InputOrder) => {
    if (!confirm(`Delete ${order.fields['Order number'] ?? 'this order'}?`)) return;
    try {
      await axios.delete(`/api/v1/input-orders/${order.id}`);
      fetchOrders();
    } catch (error: any) {
      console.error('Delete order error:', error?.message);
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
            title="Total orders"
            total={stats.total}
            subtext={`${fNumber(stats.value)} UGX total value`}
            color="primary"
            icon="solar:cart-4-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SummaryCard
            title="Total value"
            total={stats.value}
            subtext="UGX"
            color="success"
            icon="solar:tag-price-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <SummaryCard
            title="Total weight"
            total={stats.weight}
            subtext="kg"
            color="info"
            icon="solar:scale-bold-duotone"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STATUS_CARDS.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={s.key}>
            <Card sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ color: `${s.color}.main` }}>
                  <Iconify icon={'solar:notes-bold-duotone' as any} width={28} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                    {s.label}
                  </Typography>
                  <Typography variant="h4" sx={{ my: 0.5 }}>
                    {fNumber(statusCounts[s.key])}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {s.key}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );

  const renderList = () => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: (theme) => `1px solid ${theme.vars.palette.divider}` }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Iconify icon={'solar:magnifer-bold-duotone' as any} sx={{ mr: 1, color: 'text.disabled' }} />,
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>Loading…</Box>
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
                      primary={order.fields['Order number'] || 'Unnamed order'}
                      primaryTypographyProps={{ variant: 'subtitle2' }}
                    />
                    {order.fields['Order Status'] && (
                      <Label color={statusColor(order.fields['Order Status'])}>
                        {order.fields['Order Status']}
                      </Label>
                    )}
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {(order.fields['Name (from Farmers)'] || []).join(', ')} ·{' '}
                    {(order.fields['Name (from Season)'] || []).join(', ')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
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
    if (!selectedOrder) {
      return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Select an order to view details
          </Typography>
        </Card>
      );
    }

    const f = selectedOrder.fields;
    const orderDate = f['Order date'] || f['Created time'];
    const formattedDate = orderDate
      ? new Date(orderDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

    const farmerHref = f.Farmer?.[0]
      ? `/dashboard/farmers?farmerId=${f.Farmer[0]}&fpoName=${encodeURIComponent(activeFbo?.name ?? '')}`
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
              <Typography variant="h5">{f['Order number'] || 'Unnamed order'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {formattedDate}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleEdit(selectedOrder)}>
                Edit
              </Button>
              <IconButton color="error" onClick={() => handleDelete(selectedOrder)}>
                <Iconify icon={'solar:trash-bin-trash-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Order Status" value={f['Order Status']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label="Farmer"
                value={(f['Name (from Farmers)'] || []).join(', ')}
                href={farmerHref}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label="Season"
                value={(f['Name (from Season)'] || []).join(', ')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="PayNow PayLater" value={f['PayNow PayLater']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Order date" value={formattedDate} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Total Order Value" value={f['Total Order Value (UGX)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Total Weight" value={f['Total Weight (kg)']} />
            </Grid>

            {[1, 2, 3, 4, 5].map((idx) => {
              const input = f[`Input ${idx}`];
              const qty = f[`Quantity Input ${idx}`];
              const productName = (f[`Product ID (from Input ${idx})`] || []).join(', ');
              const image = f[`Image Input ${idx}`]?.[0];

              if (!input?.length || !qty) return null;

              return (
                <Grid size={{ xs: 12 }} key={idx}>
                  <Box
                    sx={{
                      p: 2,
                      mb: 2,
                      borderRadius: 1,
                      border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Input {idx}
                    </Typography>
                    <Grid container spacing={2}>
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
                          Image Input {idx}
                        </Typography>
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6 }}>
                        <DetailRow label={`Input ${idx}`} value={productName} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <DetailRow label={`Quantity Input ${idx}`} value={qty} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <DetailRow
                          label={`Retail Price Input ${idx}`}
                          value={f[`Retail Price Input ${idx}`]}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <DetailRow
                          label={`Total Value Input ${idx}`}
                          value={f[`Total Value Input ${idx}`]}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
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
          <Typography variant="h4">Input Order Queue</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Manage seed, fertilizer, and tool distribution
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
          onClick={handleAdd}
        >
          New Order
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

      <InputOrderFormDialog
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
    </DashboardContent>
  );
}
