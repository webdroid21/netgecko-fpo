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
import { useTheme } from '@mui/material/styles';
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
import { SeoIllustration } from 'src/assets/illustrations';

import { Iconify } from 'src/components/iconify';
import { Chart, useChart } from 'src/components/chart';

import { useAuthContext } from 'src/auth/hooks';

import { AppWelcome } from '../app-welcome';
import { AppWidgetSummary } from '../app-widget-summary';
import { AppCurrentDownload } from '../app-current-download';

// ----------------------------------------------------------------------

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

function chartData(value: number, color?: string) {
  return {
    colors: color ? [color] : undefined,
    categories: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    series: [value * 0.6, value * 0.8, value * 0.5, value * 0.9, value * 0.7, value * 0.4, value],
  };
}

// ----------------------------------------------------------------------

type MemberStatusChartProps = { data: DashboardStats['memberStatus'] };

function MemberStatusChart({ data }: MemberStatusChartProps) {
  const chartOptions = useChart({
    chart: { stacked: true },
    stroke: { width: 0 },
    xaxis: { categories: ['Active', 'Pending', 'Inactive'] },
    tooltip: { y: { formatter: (value: number) => fNumber(value) } },
    plotOptions: { bar: { columnWidth: '40%' } },
  });

  const hasData = data.active + data.pending + data.inactive > 0;

  return (
    <Card>
      <CardHeader title="Member Status" subheader="Distribution of farmers across states" />
      {hasData ? (
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
  const theme = useTheme();
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
        salesRevenue: sales.reduce(
          (sum, s) => sum + (Number(s.fields.Revenue) || 0),
          0
        ),
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

  const welcomeAction = (
    <Button
      variant="contained"
      color="primary"
      component={RouterLink}
      href={paths.dashboard.fpo.farmers}
    >
      View farmers
    </Button>
  );

  const QuickLinkCard = ({
    title,
    total,
    icon,
    color,
    href,
  }: {
    title: string;
    total: number;
    icon: string;
    color: 'primary' | 'success' | 'info' | 'warning';
    href: string;
  }) => (
    <MuiLink component={RouterLink} href={href} underline="none" sx={{ display: 'block' }}>
      <Card
        sx={{
          bgcolor: `${color}.dark`,
          color: 'common.white',
          '&:hover': { bgcolor: `${color}.main` },
          transition: 'background-color 0.2s',
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4">{fNumber(total)}</Typography>
              <Typography variant="subtitle2" sx={{ opacity: 0.72 }}>
                {title}
              </Typography>
            </Box>

            <Box sx={{ position: 'relative' }}>
              <Iconify icon={icon as any} width={40} height={40} />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </MuiLink>
  );

  const hasOrderData =
    stats.orderStatus.open +
    stats.orderStatus.active +
    stats.orderStatus.closed +
    stats.orderStatus.cancelled;

  const summarySkeleton = loading ? (
    <Grid size={{ xs: 12 }}>
      <Box sx={{ p: 3, textAlign: 'center' }}>Loading dashboard…</Box>
    </Grid>
  ) : null;

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <AppWelcome
            title={`Welcome back 👋 \n ${user?.displayName}`}
            description={`${activeFbo?.name} FPO dashboard. Overview of farmers, input orders, loans, payments and sales.`}
            img={<SeoIllustration hideBackground />}
            action={welcomeAction}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <QuickLinkCard
            title="Farmers"
            total={stats.farmers}
            icon="solar:users-group-rounded-bold"
            color="primary"
            href={paths.dashboard.fpo.farmers}
          />
        </Grid>

        {summarySkeleton}

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Farmers"
            percent={0}
            total={stats.farmers}
            chart={chartData(stats.farmers, theme.palette.primary.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Lands"
            percent={0}
            total={stats.lands}
            chart={chartData(stats.lands, theme.palette.success.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Acres"
            percent={0}
            total={stats.totalAcres}
            chart={chartData(stats.totalAcres, theme.palette.info.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Input Orders"
            percent={0}
            total={stats.inputOrders}
            chart={chartData(stats.inputOrders, theme.palette.warning.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Input Value"
            percent={0}
            total={stats.inputOrderValue}
            chart={chartData(stats.inputOrderValue / 1000, theme.palette.error.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Loans"
            percent={0}
            total={stats.loans}
            chart={chartData(stats.loans, theme.palette.secondary.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Loans Pending"
            percent={0}
            total={stats.loansPending}
            chart={chartData(stats.loansPending / 1000, theme.palette.error.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Payments"
            percent={0}
            total={stats.payments}
            chart={chartData(stats.payments, theme.palette.info.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Payments Received"
            percent={0}
            total={stats.paymentsTotal}
            chart={chartData(stats.paymentsTotal / 1000, theme.palette.success.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Sales"
            percent={0}
            total={stats.sales}
            chart={chartData(stats.sales, theme.palette.warning.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <AppWidgetSummary
            title="Sales Revenue"
            percent={0}
            total={stats.salesRevenue}
            chart={chartData(stats.salesRevenue / 1000, theme.palette.primary.main)}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <MemberStatusChart data={stats.memberStatus} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          {hasOrderData ? (
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
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Input Order Queue
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No input orders yet.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <QuickLinkCard
            title="Input Orders"
            total={stats.inputOrders}
            icon="solar:cart-3-bold"
            color="info"
            href={paths.dashboard.fpo.inputOrders}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <QuickLinkCard
            title="Loans"
            total={stats.loans}
            icon="solar:bill-list-bold"
            color="warning"
            href={paths.dashboard.fpo.loans}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <QuickLinkCard
            title="Payments"
            total={stats.payments}
            icon="solar:wad-of-money-bold"
            color="success"
            href={paths.dashboard.fpo.payments}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <QuickLinkCard
            title="Sales"
            total={stats.sales}
            icon="solar:export-bold"
            color="primary"
            href={paths.dashboard.fpo.sales}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6">Recent Input Orders</Typography>
                <Button
                  size="small"
                  component={RouterLink}
                  href={paths.dashboard.fpo.inputOrders}
                >
                  View all
                </Button>
              </Stack>

              <Stack spacing={1}>
                {stats.recentInputOrders.length ? (
                  stats.recentInputOrders.map((order) => (
                    <ListItemButton
                      key={order.id}
                      component={RouterLink}
                      href={`${paths.dashboard.fpo.inputOrders}?farmerId=${order.fields.Farmer?.[0] ?? ''}`}
                      sx={{ borderRadius: 1, px: 1 }}
                    >
                      <ListItemText
                        primary={order.fields['Order number'] || 'Unnamed'}
                        secondary={`${fNumber(order.fields['Total Order Value (UGX)'])} UGX`}
                      />
                    </ListItemButton>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No recent input orders
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6">Recent Payments</Typography>
                <Button
                  size="small"
                  component={RouterLink}
                  href={paths.dashboard.fpo.payments}
                >
                  View all
                </Button>
              </Stack>

              <Stack spacing={1}>
                {stats.recentPayments.length ? (
                  stats.recentPayments.map((payment) => (
                    <ListItemButton
                      key={payment.id}
                      component={RouterLink}
                      href={paths.dashboard.fpo.payments}
                      sx={{ borderRadius: 1, px: 1 }}
                    >
                      <ListItemText
                        primary={`Payment #${payment.fields['Payment ID'] ?? '-'}`}
                        secondary={`${fNumber(payment.fields['Payment Amount (UGX)'])} UGX`}
                      />
                    </ListItemButton>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No recent payments
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
