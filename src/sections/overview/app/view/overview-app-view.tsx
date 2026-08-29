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
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components/router-link';

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import { SeoIllustration } from 'src/assets/illustrations';

import { useAuthContext } from 'src/auth/hooks';

import { AppWidget } from '../app-widget';
import { AppWelcome } from '../app-welcome';
import { AppWidgetSummary } from '../app-widget-summary';

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
};

function chartData(value: number, color?: string) {
  return {
    colors: color ? [color] : undefined,
    categories: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    series: [value * 0.6, value * 0.8, value * 0.5, value * 0.9, value * 0.7, value * 0.4, value],
  };
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

      setStats({
        farmers: farmers.length,
        activeFarmers: farmers.filter((f) => f.fields.Checked === true).length,
        lands: lands.length,
        totalAcres: lands.reduce(
          (sum, l) => sum + (Number(l.fields['Land Size (Acres)']) || 0),
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

  const QuickLink = ({
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
      <AppWidget
        title={title}
        total={total}
        icon={icon as any}
        chart={{ series: 75, colors: [theme.palette[color].light, theme.palette[color].main] }}
        sx={{
          bgcolor: `${color}.dark`,
          color: 'common.white',
        }}
      />
    </MuiLink>
  );

  const summarySkeleton = loading ? (
    <Box sx={{ p: 3, textAlign: 'center', width: 1 }}>Loading dashboard…</Box>
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
          <QuickLink
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
          <QuickLink
            title="Input Orders"
            total={stats.inputOrders}
            icon="solar:cart-4-bold"
            color="info"
            href={paths.dashboard.fpo.inputOrders}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <QuickLink
            title="Loans"
            total={stats.loans}
            icon="solar:banknote-2-bold"
            color="warning"
            href={paths.dashboard.fpo.loans}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <QuickLink
            title="Payments"
            total={stats.payments}
            icon="solar:wallet-money-bold"
            color="success"
            href={paths.dashboard.fpo.payments}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <QuickLink
            title="Sales"
            total={stats.sales}
            icon="solar:shop-bold"
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
