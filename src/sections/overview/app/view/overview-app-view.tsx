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
import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { SvgColor } from 'src/components/svg-color';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type PaletteColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';

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
  recentLoans: Loan[];
  recentPayments: Payment[];
  memberStatus: { total: number; active: number; pending: number; inactive: number };
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
  recentLoans: [],
  recentPayments: [],
  memberStatus: { total: 0, active: 0, pending: 0, inactive: 0 },
  orderStatus: { open: 0, active: 0, closed: 0, cancelled: 0 },
};

// ----------------------------------------------------------------------

const svgIcon = (name: string) => (
  <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
);

// ----------------------------------------------------------------------

function IconBadge({ icon, color }: { icon: React.ReactNode; color: PaletteColor }) {
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
        bgcolor: `${color}.lighter`,
      }}
    >
      {typeof icon === 'string' ? <Iconify icon={icon as any} width={24} /> : icon}
    </Box>
  );
}

// ----------------------------------------------------------------------

type QuickAccessCardProps = {
  title: string;
  description: string;
  total: number;
  icon: React.ReactNode;
  color: PaletteColor;
  href: string;
  loading?: boolean;
};

function QuickAccessCard({
  title,
  description,
  total,
  icon,
  color,
  href,
  loading,
}: QuickAccessCardProps) {
  if (loading) {
    return (
      <Card sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Skeleton variant="rounded" width={44} height={44} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton width="40%" height={28} />
            <Skeleton width="80%" height={18} sx={{ mt: 0.5 }} />
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
            <Typography
              variant="h4"
              noWrap
              sx={{ lineHeight: 1.1, color: 'text.primary', fontSize: '1.5rem', fontWeight: 600 }}
            >
              <Box component="span" sx={{ fontWeight: 700 }}>
                {fNumber(total)}
              </Box>{' '}
              <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {title}
              </Box>
            </Typography>
            <Typography
              variant="body2"
              noWrap
              sx={{ color: 'text.secondary', textOverflow: 'ellipsis', overflow: 'hidden', mt: 0.25 }}
            >
              {description}
            </Typography>
          </Box>

          <Iconify
            icon={'solar:double-alt-arrow-right-bold-duotone' as any}
            width={20}
            sx={{ color: `${color}.main` }}
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
  icon: React.ReactNode;
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
            color={color}
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

export function OverviewAppView() {
  const { t } = useTranslate('dashboard');
  const { user, activeFbo } = useAuthContext();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!activeFbo) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const fpoQuery = new URLSearchParams({
      fpoId: activeFbo.id,
      fpoName: activeFbo.name,
    }).toString();

    try {
      const endpoints = [
        'farmers',
        'lands',
        'input-orders',
        'loans',
        'payments',
        'sales-orders',
      ];
      const results = await Promise.allSettled(
        endpoints.map((ep) => axios.get(`/api/v1/${ep}?${fpoQuery}`))
      );

      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          console.error(`Dashboard fetch /${endpoints[idx]} failed:`, res.reason?.message ?? res.reason);
        }
      });

      const recordsOf = (res: PromiseSettledResult<any>) =>
        res.status === 'fulfilled' ? res.value?.data?.records || [] : [];

      const farmers: Farmer[] = recordsOf(results[0]);
      const lands: any[] = recordsOf(results[1]);
      const orders: InputOrder[] = recordsOf(results[2]);
      const loans: Loan[] = recordsOf(results[3]);
      const payments: Payment[] = recordsOf(results[4]);
      const sales: SalesOrder[] = recordsOf(results[5]);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const isRecent = (record: any) => {
        const date =
          record.fields['Order date'] ||
          record.fields['Order Date'] ||
          record.fields['Issue Date'] ||
          record.fields['Payment Date'] ||
          record.fields['Date Received'] ||
          record.createdTime;
        if (!date) return false;
        const d = new Date(date);
        return !Number.isNaN(d.getTime()) && d >= oneYearAgo;
      };

      const addFarmerLinks = (record: any, ids: Set<string>) => {
        const farmer = record.fields?.Farmer ?? record.fields?.Farmers;
        (Array.isArray(farmer) ? farmer : [farmer]).forEach((id) => {
          if (id) ids.add(id);
        });
      };

      const recentFarmerIds = new Set<string>();
      [...orders, ...loans, ...payments, ...sales].forEach((record: any) => {
        if (isRecent(record)) addFarmerLinks(record, recentFarmerIds);
      });
      const loansById = new Map<string, any>(loans.map((l: any) => [l.id, l]));
      payments.forEach((payment: any) => {
        if (!isRecent(payment)) return;
        (payment.fields.Loans || []).forEach((loanId: string) => {
          const loan = loansById.get(loanId);
          if (loan) addFarmerLinks(loan, recentFarmerIds);
        });
      });

      const active = farmers.filter(
        (f) => f.fields.Checked === true && recentFarmerIds.has(f.id)
      ).length;
      const pending = farmers.filter((f) => f.fields.Checked !== true).length;

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
        salesRevenue: sales.reduce((sum, s) => sum + (Number(s.fields['Total Price']) || 0), 0),
        recentInputOrders: orders.slice(0, 5),
        recentLoans: loans.slice(0, 5),
        recentPayments: payments.slice(0, 5),
        memberStatus: {
          total: farmers.length,
          active,
          pending,
          inactive: farmers.length - active - pending,
        },
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

  const firstName = user?.displayName?.split(' ')[0] ?? '';

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Box
            sx={{
              py: 4,
              px: { xs: 3, md: 5 },
              borderRadius: 2,
              color: 'common.white',
              bgcolor: 'primary.main',
            }}
          >
            <Typography variant="h5" fontWeight={600} sx={{ lineHeight: 1.6, maxWidth: 960 }}>
              Welcome to NetGecko App - Boost farm productivity, grow your business and increase
              farmers&rsquo; incomes by using{' '}
              <MuiLink
                href="https://netgecko.net"
                target="_blank"
                rel="noopener"
                color="inherit"
                underline="always"
                sx={{ fontWeight: 700 }}
              >
                NetGecko service
              </MuiLink>{' '}
              and digitizing your operations
            </Typography>
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h4" color="primary">{t('title')}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {t('welcome')}
                {firstName ? `, ${firstName}` : ''}
              </Typography>
            </Box>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAccessCard
            loading={loading}
            title={t('quickAccessFarmers')}
            description={t('quickAccessFarmersDescription')}
            total={stats.farmers}
            icon={svgIcon('ic-user')}
            color="primary"
            href={paths.dashboard.fpo.farmers}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAccessCard
            loading={loading}
            title={t('quickAccessLands')}
            description={t('quickAccessLandsDescription')}
            total={stats.lands}
            icon={svgIcon('ic-land')}
            color="info"
            href={paths.dashboard.fpo.lands}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAccessCard
            loading={loading}
            title={t('quickAccessInputOrders')}
            description={t('quickAccessInputOrdersDescription')}
            total={stats.inputOrders}
            icon={svgIcon('ic-order')}
            color="warning"
            href={paths.dashboard.fpo.inputOrders}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAccessCard
            loading={loading}
            title={t('quickAccessLoans')}
            description={t('quickAccessLoansDescription')}
            total={stats.loans}
            icon={svgIcon('ic-banking')}
            color="primary"
            href={paths.dashboard.fpo.loans}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAccessCard
            loading={loading}
            title={t('quickAccessPayments')}
            description={t('quickAccessPaymentsDescription')}
            total={stats.payments}
            icon={svgIcon('ic-dollar')}
            color="info"
            href={paths.dashboard.fpo.payments}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAccessCard
            loading={loading}
            title={t('quickAccessSales')}
            description={t('quickAccessSalesDescription')}
            total={stats.sales}
            icon={svgIcon('ic-order')}
            color="warning"
            href={paths.dashboard.fpo.sales}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <RecentListCard
            loading={loading}
            title={t('recentOrders')}
            viewAllHref={paths.dashboard.fpo.inputOrders}
            icon={svgIcon('ic-order')}
            color="warning"
            emptyText={t('noRecentOrders')}
            items={stats.recentInputOrders.map((order) => ({
              id: order.id,
              primary: String(order.fields['Order number'] || '').split(' - ')[0] || 'Unnamed',
              secondary: (order.fields['Name (from Farmers)'] || []).join(', '),
              amount: `${fNumber(order.fields['Total Order Value (UGX)'])} UGX`,
              href: `${paths.dashboard.fpo.inputOrders}?farmerId=${order.fields.Farmer?.[0] ?? ''}`,
            }))}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <RecentListCard
            loading={loading}
            title={t('recentLoans')}
            viewAllHref={paths.dashboard.fpo.loans}
            icon={svgIcon('ic-banking')}
            color="primary"
            emptyText={t('noRecentLoans')}
            items={stats.recentLoans.map((loan) => ({
              id: loan.id,
              primary:
                String(loan.fields['Loan ID'] || '').split(' - ')[0] ||
                `Loan #${loan.fields.ID ?? '-'}`,
              secondary: (loan.fields['Name (from Farmer)'] || []).join(', '),
              amount: `${fNumber(loan.fields['Total amount'])} UGX`,
              href: `${paths.dashboard.fpo.loans}?farmerId=${loan.fields.Farmer?.[0] ?? ''}`,
            }))}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <RecentListCard
            loading={loading}
            title={t('recentPayment')}
            viewAllHref={paths.dashboard.fpo.payments}
            icon={svgIcon('ic-dollar')}
            color="info"
            emptyText={t('noRecentPayment')}
            items={stats.recentPayments.map((payment) => ({
              id: payment.id,
              primary: `${payment.fields['Payment ID'] ?? '-'}`,
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
