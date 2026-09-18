import type { Payment } from '../types';
import type { Loan } from 'src/sections/loan/types';
import type { ListFilterField, ListFilterValues } from 'src/components/list-filters';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import ListItemButton from '@mui/material/ListItemButton';

import { useSearchParams } from 'src/routes/hooks/use-search-params';

import { useRefetchOnVisible } from 'src/hooks/use-refetch-on-visible';

import { fDate } from 'src/utils/format-time';
import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { DetailDialog } from 'src/components/detail-dialog';
import { ListFilters, matchesListFilters } from 'src/components/list-filters';

import { useAuthContext } from 'src/auth/hooks';

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
  numberOptions,
}: {
  label: string;
  value?: any;
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

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{display}</Typography>
    </Box>
  );
}

const yearTrend = (current: number, previous: number) =>
  previous !== 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;

// ----------------------------------------------------------------------

export function PaymentView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('payments');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');
  const paymentId = searchParams.get('paymentId');
  const mdUp = useMediaQuery((theme) => theme.breakpoints.up('md'));

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListFilterValues>({});

  const fetchPayments = useCallback(async () => {
    if (!activeFbo) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/payments?${query}`);
      setPayments(data.records || []);
    } catch (error: any) {
      console.error('Fetch payments error:', error?.message);
    } finally {
      setLoading(false);
    }
  }, [activeFbo]);

  const fetchLoans = useCallback(async () => {
    if (!activeFbo) return;
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/loans?${query}`);
      setLoans(data.records || []);
    } catch (error: any) {
      console.error('Fetch loans error:', error?.message);
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchPayments();
    fetchLoans();
  }, [fetchPayments, fetchLoans]);

  const refetchAll = useCallback(() => {
    fetchPayments();
    fetchLoans();
  }, [fetchPayments, fetchLoans]);

  useRefetchOnVisible(refetchAll);

  const loanLabel = useCallback(
    (id?: string) => {
      const loan = loans.find((l) => l.id === id);
      return loan ? loan.fields['Loan ID'] || t('unnamedLoan') : '—';
    },
    [loans, t]
  );

  const paymentFilterFields = useMemo(
    (): ListFilterField[] => [
      {
        key: 'source',
        label: t('fields.source'),
        options: Array.from(
          new Set(payments.map((p) => String(p.fields.Source ?? '')).filter(Boolean))
        ).map((v) => ({ value: v, label: v })),
      },
      { key: 'paymentAmount', label: t('fields.paymentAmount') },
      { key: 'paymentDate', label: t('fields.paymentDate'), type: 'date' },
      { key: 'mobileMoneyNumber', label: t('fields.mobileMoneyNumberUsed') },
      {
        key: 'loan',
        label: t('fields.loan'),
        options: loans.map((l) => ({ value: l.id, label: loanLabel(l.id) })),
      },
    ],
    [t, payments, loans, loanLabel]
  );

  const paymentFilterValue = (p: Payment, key: string): any => {
    switch (key) {
      case 'source':
        return p.fields.Source;
      case 'paymentAmount':
        return p.fields['Payment Amount (UGX)'];
      case 'paymentDate':
        return p.fields['Payment Date'];
      case 'mobileMoneyNumber':
        return p.fields['Mobile Money Number Used'];
      case 'loan':
        return p.fields.Loans;
      default:
        return '';
    }
  };

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = payments;

    if (farmerFilter) {
      list = list.filter((p) => {
        const loan = loans.find((l) => l.id === p.fields.Loans?.[0]);
        const farmer = loan?.fields?.Farmer;
        return Array.isArray(farmer) ? farmer.includes(farmerFilter) : farmer === farmerFilter;
      });
    }

    return list.filter((p) => {
      if (term) {
        const text = `${p.fields['Payment ID'] ?? ''} ${(p.fields['FPO (from Loans)'] || []).join(' ')} ${p.fields.Source ?? ''} ${p.fields['Payment reference'] ?? ''} ${p.fields['Payment Amount (UGX)'] ?? ''} ${fNumber(p.fields['Payment Amount (UGX)'])} ${p.fields['Payment Date'] ?? ''} ${p.fields['Mobile Money Number Used'] ?? ''} ${loanLabel(p.fields.Loans?.[0])}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return matchesListFilters(p, paymentFilterFields, filters, paymentFilterValue);
    });
  }, [payments, search, filters, farmerFilter, loans, loanLabel, paymentFilterFields]);

  const selectedPayment = useMemo(
    () => filteredPayments.find((p) => p.id === selectedId) || filteredPayments[0] || null,
    [filteredPayments, selectedId]
  );

  useEffect(() => {
    if (paymentId && filteredPayments.some((p) => p.id === paymentId)) {
      setSelectedId(paymentId);
      if (!mdUp) setDetailOpen(true);
      return;
    }
    if (selectedId || !filteredPayments.length) return;
    setSelectedId(filteredPayments[0]?.id);
  }, [filteredPayments, selectedId, paymentId, mdUp]);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const s = {
      total: 0,
      count: filteredPayments.length,
      countThisYear: 0,
      amountThisYear: 0,
      countLastYear: 0,
      amountLastYear: 0,
    };

    filteredPayments.forEach((p) => {
      const amount = Number(p.fields['Payment Amount (UGX)']) || 0;
      s.total += amount;
      const year = new Date(p.fields['Payment Date']).getFullYear();
      if (year === currentYear) {
        s.countThisYear += 1;
        s.amountThisYear += amount;
      } else if (year === lastYear) {
        s.countLastYear += 1;
        s.amountLastYear += amount;
      }
    });

    return s;
  }, [filteredPayments]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!mdUp) setDetailOpen(true);
  };

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
            fields={paymentFilterFields}
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
            {filteredPayments.map((payment) => {
              const isSelected = payment.id === selectedPayment?.id;

              return (
                <ListItemButton
                  key={payment.id}
                  selected={isSelected}
                  onClick={() => handleSelect(payment.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={String(payment.fields['Payment ID'] ?? '-')}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {loanLabel(payment.fields.Loans?.[0])}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {fNumber(payment.fields['Payment Amount (UGX)'])} UGX · {fDate(payment.fields['Payment Date'])}
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
    if (!selectedPayment) {
      return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('emptyDetail')}
          </Typography>
        </Card>
      );
    }

    const f = selectedPayment.fields;

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
              <Typography variant="h5">{String(f['Payment ID'] ?? '-')}</Typography>
            </Box>
            {onCloseDetail && (
              <IconButton onClick={onCloseDetail}>
                <Iconify icon={'mingcute:close-line' as any} />
              </IconButton>
            )}
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                {t('sections.payment')}
              </Typography>
              <Divider sx={{ mt: 0.5 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.loan')} value={loanLabel(f.Loans?.[0])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.source')} value={f.Source} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.paymentAmount')} value={f['Payment Amount (UGX)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.paymentDate')} value={fDate(f['Payment Date'])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.paymentReference')} value={f['Payment reference']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.mobileMoneyNumberUsed')} value={f['Mobile Money Number Used']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.season')} value={(f['Season (from Loans)'] || []).join(', ')} />
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
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title={t('summary.totalPayments.title')}
            total={stats.count}
            color="primary"
            icon="solar:wallet-money-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title={t('summary.totalReceived.title')}
            total={stats.total}
            color="success"
            icon="solar:tag-price-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title={t('summary.paymentsThisYear')}
            total={stats.countThisYear}
            trend={{
              value: yearTrend(stats.countThisYear, stats.countLastYear),
              label: t('summary.vsLastYear'),
            }}
            color="info"
            icon="solar:calendar-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title={t('summary.amountThisYear')}
            total={stats.amountThisYear}
            trend={{
              value: yearTrend(stats.amountThisYear, stats.amountLastYear),
              label: t('summary.vsLastYear'),
            }}
            color="warning"
            icon="solar:graph-up-bold-duotone"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ height: { md: 'calc(100vh - 320px)' } }}>
        <Grid size={{ xs: 12, md: 4 }} sx={{ height: 1 }}>
          {renderList()}
        </Grid>

        {mdUp && (
          <Grid size={{ xs: 12, md: 8 }} sx={{ height: 1 }}>
            {renderDetail()}
          </Grid>
        )}
      </Grid>

      <DetailDialog open={detailOpen && !mdUp} onClose={() => setDetailOpen(false)}>
        {renderDetail(() => setDetailOpen(false))}
      </DetailDialog>
    </DashboardContent>
  );
}
