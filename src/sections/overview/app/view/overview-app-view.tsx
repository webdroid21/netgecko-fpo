import type { Loan } from 'src/sections/loan/types';
import type { Farmer } from 'src/sections/farmer/types';
import type { Payment } from 'src/sections/payment/types';
import type { SalesOrder } from 'src/sections/sales/types';
import type { InputOrder } from 'src/sections/input-order/types';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components/router-link';

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Chart, useChart } from 'src/components/chart';

import { useAuthContext } from 'src/auth/hooks';

import { AppCurrentDownload } from '../app-current-download';

// ----------------------------------------------------------------------

type PaletteColor = 'primary' | 'success' | 'info' | 'warning' | 'error';

type DashboardStats = {
  farmers: number;
  activeFarmers: number;
  lands: number;
  totalAcres: number;
  inputOrders: number;
  inputOrderValue: number;
  loans: number;
  loansPending: number;
  payments: number;
  paymentsTotal: number;
  sales: number;
  salesRevenue: number;
  recentInputOrders: InputOrder[];
  recentPayments: Payment[];
  memberStatus: { active: number; pending: number; inactive: number };
  orderStatus: { open: number; active: number; closed: number; cancelled: number };
};

const initialStats: DashboardStats = {
  farmers: 0,
  activeFarmers: 0,
  lands: 0,
  totalAcres: 0,
  inputOrders: 0,
  inputOrderValue: 0,
  loans: 0,
  loansPending: 0,
  payments: 0,
  paymentsTotal: 0,
  sales: 0,
  salesRevenue: 0,
  recentInputOrders: [],
  recentPayments: [],
  memberStatus: { active: 0, pending: 0, inactive: 0 },
  orderStatus: { open: 0, active: 0, closed: 0, cancelled: 0 },
};

// ----------------------------------------------------------------------

function IconBadge({ icon, color }: { icon: string; color: PaletteColor }) {
  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'flex',
        borderRadius: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        color: `${color}.dark`,
        bgcolor: (theme) => `${theme.vars.palette[color].lighter}`,
      }}
    >
      <Iconify icon={icon as any} width={24} />
    </Box>
  );
}

// ----------------------------------------------------------------------

type StatCardProps = {
  title: string;
  value: number;
  subtext: string;
  icon: string;
  color: PaletteColor;
  loading?: boolean;
};

function StatCard({ title, value, subtext, icon, color, loading }: StatCardProps) {
  if (loading) {
    return (
      <Card sx={{ p: 3, height: '100%' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Skeleton width="60%" height={20} />
          <Skeleton variant="rounded" width={44} height={44} />
        </Stack>
        <Skeleton width="40%" height={44} sx={{ mt: 1 }} />
        <Skeleton width="70%" height={18} sx={{ mt: 0.5 }} />
      </Card>
    );
  }

  return (
    <Card sx={{ p: 3, height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          {title}
        </Typography>

        <IconBadge icon={icon} color={color} />
      </Stack>

      <Typography variant="h3" sx={{ mt: 1 }}>
        {fNumber(value)}
      </Typography>

      <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
        {subtext}
      </Typography>
    </Card>
  );
}

// ----------------------------------------------------------------------

type QuickAccessCardProps = {
  title: string;
  total: number;
  icon: string;
  color: PaletteColor;
  href: string;
  loading?: boolean;
};

function QuickAccessCard({ title, total, icon, color, href, loading }: QuickAccessCardProps) {
  if (loading) {
    return (
      <Card sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Skeleton variant="rounded" width={44} height={44} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton width="50%" height={26} />
            <Skeleton width="70%" height={18} />
          </Box>
        </Stack>
      </Card>
    );
  }

  return (
    <MuiLink component={RouterLink} href={href} underline="none" sx={{ display: 'block' }}>
      <Card
        sx={{
          p: 2.5,
          transition: (theme) =>
            theme.transitions.create(['box-shadow', 'transform'], { duration: 200 }),
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (theme) => theme.vars.customShadows?.z12 ?? theme.shadows[12],
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconBadge icon={icon} color={color} />

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
              {fNumber(total)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
              {title}
            </Typography>
          </Box>

          <Iconify
            icon={'solar:double-alt-arrow-right-bold-duotone' as any}
            width={20}
            sx={{ color: 'text.disabled' }}
          />
        </Stack>
      </Card>
    </MuiLink>
  );
}

// ----------------------------------------------------------------------

type RecentListCardProps = {
  title: string;
  viewAllHref: string;
  icon: string;
  color: PaletteColor;
  loading?: boolean;
  emptyText: string;
  items: {
    id: string;
    primary: string;
    secondary?: string;
    amount?: string;
    href: string;
  }[];
};

function RecentListCard({
  title,
  viewAllHref,
  icon,
  color,
  loading,
  emptyText,
  items,
}: RecentListCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={title}
        action={
          <Button
            size="small"
            component={RouterLink}
            href={viewAllHref}
            endIcon={<Iconify icon={'solar:double-alt-arrow-right-bold-duotone' as any} width={16} />}
          >
            View all
          </Button>
        }
      />

      <CardContent sx={{ pt: 2 }}>
        {loading ? (
          <Stack spacing={2}>
            {[...Array(3)].map((_, i) => (
              <Stack key={i} direction="row" alignItems="center" spacing={2}>
                <Skeleton variant="rounded" width={44} height={44} />
                <Box sx={{ flexGrow: 1 }}>
                  <Skeleton width="60%" height={20} />
                  <Skeleton width="40%" height={16} />
                </Box>
                <Skeleton width={64} height={20} />
              </Stack>
            ))}
          </Stack>
        ) : items.length ? (
          <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
            {items.map((item) => (
              <ListItemButton
                key={item.id}
                component={RouterLink}
                href={item.href}
                sx={{ borderRadius: 1, px: 1, py: 1.5 }}
              >
                <Stack direction="row" alignItems="center" spacing={2} sx={{ width: 1 }}>
                  <IconBadge icon={icon} color={color} />

                  <ListItemText
                    primary={item.primary}
                    secondary={item.secondary}
                    primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                  />

                  {item.amount && (
                    <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
                      {item.amount}
                    </Typography>
                  )}
                </Stack>
              </ListItemButton>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {emptyText}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

type MemberStatusChartProps = { data: DashboardStats['memberStatus']; loading?: boolean };

function MemberStatusChart({ data, loading }: MemberStatusChartProps) {
  const chartOptions = useChart({
    chart: { stacked: true },
    stroke: { width: 0 },
    xaxis: { categories: ['Active', 'Pending', 'Inactive'] },
    tooltip: { y: { formatter: (value: number) => fNumber(value) } },
    plotOptions: { bar: { columnWidth: '40%' } },
  });

  const hasData = data.active + data.pending + data.inactive > 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader title="Member Status" subheader="Distribution of farmers across states" />
      {loading ? (
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rounded" height={300} />
        </Box>
      ) : hasData ? (
        <Chart
          type="bar"
          series={[{ name: 'Farmers', data: [data.active, data.pending, data.inactive] }]}
          options={chartOptions}
          sx={{
            pl: 1,
            py: 2.5,
            pr: 2.5,
            height: 320,
          }}
        />
      ) : (
        <CardContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No member data yet.
          </Typography>
        </CardContent>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

export function OverviewAppView() {
  const { user, activeFbo } = useAuthContext();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!activeFbo) return;

    setLoading(true);

    const fpoQuery = new URLSearchParams({
      fpoId: activeFbo.id,
      fpoName: activeFbo.name,
    }).toString();

    try {
      const [
        { data: farmersData },
        { data: landsData },
        { data: ordersData },
        { data: loansData },
        { data: paymentsData },
        { data: salesData },
      ] = await Promise.all([
        axios.get(`/api/v1/farmers?${fpoQuery}`),
        axios.get(`/api/v1/lands?${fpoQuery}`),
        axios.get(`/api/v1/input-orders?${fpoQuery}`),
        axios.get(`/api/v1/loans?${fpoQuery}`),
        axios.get(`/api/v1/payments?${fpoQuery}`),
        axios.get('/api/v1/sales-orders'),
      ]);

      const farmers: Farmer[] = farmersData.records || [];
      const lands: any[] = landsData.records || [];
      const orders: InputOrder[] = ordersData.records || [];
      const loans: Loan[] = loansData.records || [];
      const payments: Payment[] = paymentsData.records || [];
      const sales: SalesOrder[] = salesData.records || [];

      const active = farmers.filter((f) => f.fields.Checked === true).length;

      setStats({
        farmers: farmers.length,
        activeFarmers: active,
        lands: lands.length,
        totalAcres: lands.reduce(
          (sum: number, l: any) => sum + (Number(l.fields['Land Size (Acres)']) || 0),
          0
        ),
        inputOrders: orders.length,
        inputOrderValue: orders.reduce(
          (sum, o) => sum + (Number(o.fields['Total Order Value (UGX)']) || 0),
          0
        ),
        loans: loans.length,
        loansPending: loans.reduce(
          (sum, l) => sum + (Number(l.fields['Total Amount Pending']) || 0),
          0
        ),
        payments: payments.length,
        paymentsTotal: payments.reduce(
          (sum, p) => sum + (Number(p.fields['Payment Amount (UGX)']) || 0),
          0
        ),
        sales: sales.length,
        salesRevenue: sales.reduce((sum, s) => sum + (Number(s.fields.Revenue) || 0), 0),
        recentInputOrders: orders.slice(0, 5),
        recentPayments: payments.slice(0, 5),
        memberStatus: { active, pending: 0, inactive: farmers.length - active },
        orderStatus: orders.reduce(
          (acc, o) => {
            const status = o.fields['Order Status'];
            if (status === 'Open') acc.open += 1;
            if (status === 'Active') acc.active += 1;
            if (status === 'Closed') acc.closed += 1;
            if (status === 'Cancelled') acc.cancelled += 1;
            return acc;
          },
          { open: 0, active: 0, closed: 0, cancelled: 0 }
        ),
      });
    } catch (error: any) {
      console.error('Dashboard stats error:', error?.message);
    } finally {
      setLoading(false);
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const hasOrderData =
    stats.orderStatus.open +
    stats.orderStatus.active +
    stats.orderStatus.closed +
    stats.orderStatus.cancelled;

  const firstName = user?.displayName?.split(' ')[0] ?? '';

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h4">
                {activeFbo?.name} Cooperative Overview
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Welcome back{firstName ? `, ${firstName}` : ''} 👋 Real-time health and
                operational metrics for the farming network.
              </Typography>
            </Box>

            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              href={paths.dashboard.fpo.farmers}
              startIcon={<Iconify icon={'solar:user-plus-bold' as any} />}
            >
              Add Farmer
            </Button>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Active Farmers"
            value={stats.farmers}
            subtext={`${stats.activeFarmers} verified members`}
            icon="solar:users-group-rounded-bold"
            color="primary"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Number of Lands"
            value={stats.lands}
            subtext="Registered parcels"
            icon="solar:box-minimalistic-bold"
            color="success"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Total Land Area"
            value={stats.totalAcres}
            subtext="Sum of parcel sizes (acres)"
            icon="solar:flag-bold"
            color="info"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Input Orders"
            value={stats.inputOrders}
            subtext={`${fNumber(stats.inputOrderValue)} UGX total value`}
            icon="solar:cart-3-bold"
            color="warning"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Loan Balances"
            value={stats.loansPending}
            subtext={`Outstanding across ${stats.loans} loans (UGX)`}
            icon="solar:bill-list-bold"
            color="error"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Payments Received"
            value={stats.paymentsTotal}
            subtext={`${stats.payments} transactions (UGX)`}
            icon="solar:wad-of-money-bold"
            color="success"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Sales Orders"
            value={stats.sales}
            subtext="Crop and produce sales"
            icon="solar:export-bold"
            color="info"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard
            loading={loading}
            title="Sales Revenue"
            value={stats.salesRevenue}
            subtext="Total revenue (UGX)"
            icon="solar:cup-star-bold"
            color="primary"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <MemberStatusChart data={stats.memberStatus} loading={loading} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          {loading ? (
            <Card sx={{ height: '100%' }}>
              <CardHeader title="Input Order Queue" subheader="Current state of all seed and tool requests" />
              <Box sx={{ p: 3 }}>
                <Skeleton variant="circular" width={240} height={240} sx={{ mx: 'auto' }} />
              </Box>
            </Card>
          ) : hasOrderData ? (
            <AppCurrentDownload
              title="Input Order Queue"
              subheader="Current state of all seed and tool requests"
              chart={{
                series: [
                  { label: 'Open', value: stats.orderStatus.open },
                  { label: 'Active', value: stats.orderStatus.active },
                  { label: 'Closed', value: stats.orderStatus.closed },
                  { label: 'Cancelled', value: stats.orderStatus.cancelled },
                ],
              }}
            />
          ) : (
            <Card sx={{ height: '100%' }}>
              <CardHeader title="Input Order Queue" />
              <CardContent>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No input orders yet.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QuickAccessCard
            loading={loading}
            title="Farmers"
            total={stats.farmers}
            icon="solar:users-group-rounded-bold"
            color="primary"
            href={paths.dashboard.fpo.farmers}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QuickAccessCard
            loading={loading}
            title="Input Orders"
            total={stats.inputOrders}
            icon="solar:cart-3-bold"
            color="info"
            href={paths.dashboard.fpo.inputOrders}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QuickAccessCard
            loading={loading}
            title="Loans"
            total={stats.loans}
            icon="solar:bill-list-bold"
            color="warning"
            href={paths.dashboard.fpo.loans}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QuickAccessCard
            loading={loading}
            title="Payments"
            total={stats.payments}
            icon="solar:wad-of-money-bold"
            color="success"
            href={paths.dashboard.fpo.payments}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QuickAccessCard
            loading={loading}
            title="Sales"
            total={stats.sales}
            icon="solar:export-bold"
            color="error"
            href={paths.dashboard.fpo.sales}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <RecentListCard
            loading={loading}
            title="Recent Input Orders"
            viewAllHref={paths.dashboard.fpo.inputOrders}
            icon="solar:cart-3-bold"
            color="info"
            emptyText="No recent input orders"
            items={stats.recentInputOrders.map((order) => ({
              id: order.id,
              primary: order.fields['Order number'] || 'Unnamed',
              secondary: (order.fields['Name (from Farmer)'] || []).join(', '),
              amount: `${fNumber(order.fields['Total Order Value (UGX)'])} UGX`,
              href: `${paths.dashboard.fpo.inputOrders}?farmerId=${order.fields.Farmer?.[0] ?? ''}`,
            }))}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <RecentListCard
            loading={loading}
            title="Recent Payments"
            viewAllHref={paths.dashboard.fpo.payments}
            icon="solar:wad-of-money-bold"
            color="success"
            emptyText="No recent payments"
            items={stats.recentPayments.map((payment) => ({
              id: payment.id,
              primary: `Payment #${payment.fields['Payment ID'] ?? '-'}`,
              secondary: payment.fields['Payment Date'],
              amount: `${fNumber(payment.fields['Payment Amount (UGX)'])} UGX`,
              href: paths.dashboard.fpo.payments,
            }))}
          />
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
