import type { Loan } from '../types';
import type { Farmer } from 'src/sections/farmer/types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { RouterLink } from 'src/routes/components/router-link';
import { useSearchParams } from 'src/routes/hooks/use-search-params';

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const STATUS_SUMMARY_CARDS = [
  { key: 'Active', titleKey: 'summary.activeLoans', color: 'info' as const, icon: 'solar:chart-square-bold-duotone' },
  { key: 'Approved', titleKey: 'summary.approvedLoans', color: 'success' as const, icon: 'solar:check-circle-bold-duotone' },
  { key: 'Open', titleKey: 'summary.openLoans', color: 'warning' as const, icon: 'solar:clipboard-list-bold-duotone' },
];

const AMOUNT_SUMMARY_CARDS = [
  { key: 'Active', titleKey: 'summary.activeAmount', color: 'info' as const },
  { key: 'Approved', titleKey: 'summary.approvedAmount', color: 'success' as const },
  { key: 'Open', titleKey: 'summary.openAmount', color: 'warning' as const },
];

const REPAYMENT_SUMMARY_CARDS = [
  { key: 'Red', titleKey: 'summary.repaymentRed', color: 'error' as const, icon: 'solar:danger-triangle-bold-duotone' },
  { key: 'Orange', titleKey: 'summary.repaymentOrange', color: 'warning' as const, icon: 'solar:alarm-bold-duotone' },
  { key: 'Green', titleKey: 'summary.repaymentGreen', color: 'success' as const, icon: 'solar:check-circle-bold-duotone' },
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

export function LoanView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('loans');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');
  const loanId = searchParams.get('loanId');

  const [loans, setLoans] = useState<Loan[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchLoans = useCallback(async () => {
    if (!activeFbo) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/loans?${query}`);
      setLoans(data.records || []);
    } catch (error: any) {
      console.error('Fetch loans error:', error?.message);
      setLoans([]);
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

  useEffect(() => {
    fetchLoans();
    fetchFarmers();
  }, [fetchLoans, fetchFarmers]);

  const filteredLoans = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = loans;

    if (farmerFilter) {
      list = list.filter((l) => (l.fields.Farmer ?? []).includes(farmerFilter));
    }

    if (!term) return list;

    return list.filter((l) => {
      const text = `${l.fields['Loan ID'] ?? ''} ${(l.fields['Name (from Farmer)'] || []).join(' ')} ${l.fields['Loan Status'] ?? ''}`.toLowerCase();
      return text.includes(term);
    });
  }, [loans, search, farmerFilter]);

  const selectedLoan = useMemo(
    () => filteredLoans.find((l) => l.id === selectedId) || filteredLoans[0] || null,
    [filteredLoans, selectedId]
  );

  useEffect(() => {
    if (loanId && filteredLoans.some((l) => l.id === loanId)) {
      setSelectedId(loanId);
      return;
    }
    if (selectedId || !filteredLoans.length) return;
    setSelectedId(filteredLoans[0]?.id);
  }, [filteredLoans, selectedId, loanId]);

  const { statusStats, repaymentStats } = useMemo(() => {
    const statuses: Record<string, { count: number; women: number; amount: number }> = {
      Active: { count: 0, women: 0, amount: 0 },
      Approved: { count: 0, women: 0, amount: 0 },
      Open: { count: 0, women: 0, amount: 0 },
    };
    const repayments: Record<string, { count: number; pending: number }> = {
      Red: { count: 0, pending: 0 },
      Orange: { count: 0, pending: 0 },
      Green: { count: 0, pending: 0 },
    };

    filteredLoans.forEach((l) => {
      const status = l.fields['Loan Status'];
      const statusBucket = statuses[status ?? ''];
      if (statusBucket) {
        statusBucket.count += 1;
        statusBucket.amount += Number(l.fields['Total amount']) || 0;
        const farmer = farmers.find((f) => f.id === l.fields.Farmer?.[0]);
        if (farmer?.fields.Gender === 'Female') statusBucket.women += 1;
      }

      const rep = String(l.fields['Repayment Status'] ?? '').toLowerCase();
      const repKey = rep.includes('red')
        ? 'Red'
        : rep.includes('orange')
          ? 'Orange'
          : rep.includes('green')
            ? 'Green'
            : null;
      if (repKey) {
        repayments[repKey].count += 1;
        repayments[repKey].pending += Number(l.fields['Total Amount Pending']) || 0;
      }
    });

    return { statusStats: statuses, repaymentStats: repayments };
  }, [filteredLoans, farmers]);

  const statusColor = (status?: string) => {
    if (status === 'Open') return 'warning';
    if (status === 'Approved') return 'success';
    if (status === 'Active') return 'info';
    if (status === 'Closed') return 'success';
    if (status === 'Cancelled') return 'error';
    return 'default';
  };

  const renderSummary = () => (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STATUS_SUMMARY_CARDS.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.key}>
            <SummaryCard
              title={t(s.titleKey)}
              total={statusStats[s.key]?.count ?? 0}
              subtext={t('summary.womenSubtext', { count: fNumber(statusStats[s.key]?.women ?? 0) })}
              color={s.color}
              icon={s.icon}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {AMOUNT_SUMMARY_CARDS.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.key}>
            <SummaryCard
              title={t(s.titleKey)}
              total={statusStats[s.key]?.amount ?? 0}
              subtext="UGX"
              color={s.color}
              icon="solar:tag-price-bold-duotone"
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {REPAYMENT_SUMMARY_CARDS.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.key}>
            <SummaryCard
              title={t(s.titleKey)}
              total={repaymentStats[s.key]?.count ?? 0}
              subtext={`${fNumber(repaymentStats[s.key]?.pending ?? 0)} UGX`}
              color={s.color}
              icon={s.icon}
            />
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
            {filteredLoans.map((loan) => {
              const isSelected = loan.id === selectedLoan?.id;

              return (
                <ListItemButton
                  key={loan.id}
                  selected={isSelected}
                  onClick={() => setSelectedId(loan.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={loan.fields['Loan ID'] || t('unnamedLoan')}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    {loan.fields['Loan Status'] && (
                      <Label color={statusColor(loan.fields['Loan Status'])}>
                        {loan.fields['Loan Status']}
                      </Label>
                    )}
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {(loan.fields['Name (from Farmer)'] || []).join(', ')} ·{' '}
                    {(loan.fields['Loan Object'] || []).join(', ')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {fNumber(loan.fields['Total amount'])} UGX · {fNumber(loan.fields['Total Amount Pending'])} pending
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
    if (!selectedLoan) {
      return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('emptyDetail')}
          </Typography>
        </Card>
      );
    }

    const f = selectedLoan.fields;
    const farmerHref = f.Farmer?.[0]
      ? `/dashboard/farmers?farmerId=${f.Farmer[0]}&fpoName=${encodeURIComponent(activeFbo?.name ?? '')}`
      : undefined;

    const netgeckoHelper = t('fields.willBeUpdatedByNetGecko');

    return (
      <Card sx={{ height: '100%', overflow: 'auto' }}>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5">{f['Loan ID'] || t('unnamedLoan')}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {(f['Loan Object'] || []).join(', ')} · {(f['Name (from Season)'] || []).join(', ')}
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary', px: 1, pb: 1 }}>
                {t('sections.details')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.loanStatus')} value={f['Loan Status']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.farmer')}
                value={(f['Name (from Farmer)'] || []).join(', ')}
                href={farmerHref}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.loanType')} value={(f['Loan Object'] || []).join(', ')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.issueDate')} value={f['Issue Date']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.repaymentDueDate')} value={f['Repayment Due Date']} />
            </Grid>
            {f['Orders (Input)']?.[0] && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <DetailRow
                  label={t('fields.inputOrder')}
                  value={(f['Order number (from Orders (Input))'] || []).join(', ')}
                  href={`/dashboard/input-orders?farmerId=${f.Farmer?.[0] ?? ''}&fpoName=${encodeURIComponent(activeFbo?.name ?? '')}`}
                />
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary', px: 1, pb: 1 }}>
                {t('sections.amount')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.totalAmount')}
                value={f['Total amount']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.principal')}
                value={f['Principal']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.interest')}
                value={f['Interest']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.downpayment')}
                value={f['Downpayment']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.principalPlusInterest')}
                value={f['Principal + Interest']}
                helper={netgeckoHelper}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary', px: 1, pb: 1 }}>
                {t('sections.repayment')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.repaymentStatus')}
                value={f['Repayment Status']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.totalAmountPending')}
                value={f['Total Amount Pending']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.sumPaymentReceived')}
                value={f['Sum payment received']}
                helper={netgeckoHelper}
              />
            </Grid>

            {f['Payments Received Link']?.length ? (
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('fields.paymentsReceived')}
                </Typography>
                {f['Payment ID (from Payments Link)'].map((pid: any, idx: number) => (
                  <Typography key={idx} variant="body2" sx={{ color: 'text.secondary' }}>
                    Payment #{pid} · {fNumber((f['Payments received'] || [])[idx])} UGX ·{' '}
                    {(f['Dates payment received'] || [])[idx]}
                  </Typography>
                ))}
              </Grid>
            ) : null}
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

      {renderSummary()}

      <Grid container spacing={2} sx={{ height: { md: 'calc(100vh - 340px)' } }}>
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
