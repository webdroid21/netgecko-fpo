import type { Loan } from '../types';
import type { LabelColor } from 'src/components/label';
import type { Farmer } from 'src/sections/farmer/types';
import type { ListFilterField, ListFilterValues } from 'src/components/list-filters';

import { varAlpha } from 'minimal-shared/utils';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Divider from '@mui/material/Divider';
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

const LOAN_STATUS_SEGMENTS = ['Open', 'Approved', 'Active', 'Closed'] as const;

// Airtable fields can return arrays or objects (e.g. { specialValue: 'NaN' },
// { error: '#ERROR!' }) — normalize them before rendering or aggregating.
function fieldText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(fieldText).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value);
}

function fieldNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fieldArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

// Lookup ratios arrive as arrays like [0.3] — render as a percent string.
function fieldPercent(value: unknown): string {
  const vals = Array.isArray(value) ? value : value == null ? [] : [value];
  return vals
    .map((v) => {
      const n = fieldNumber(v);
      return Number.isFinite(n) ? `${fNumber(n * 100)}%` : '';
    })
    .filter(Boolean)
    .join(', ');
}

function repaymentBucket(value: unknown): 'Red' | 'Orange' | 'Green' | null {
  const rep = fieldText(value).toLowerCase();
  if (rep.includes('red') || rep.includes('🔴')) return 'Red';
  if (rep.includes('orange') || rep.includes('🟠') || rep.includes('🟡')) return 'Orange';
  if (rep.includes('green') || rep.includes('🟢')) return 'Green';
  return null;
}

function SummaryCard({
  title,
  total,
  subtext,
  color,
  icon,
}: {
  title: string;
  total: number;
  subtext?: string;
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
          {subtext ? (
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
  } else if (typeof value === 'object' && value !== null) {
    display = fieldText(value) || '—';
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

function FlagRow({
  label,
  value,
  color,
}: {
  label: string;
  value?: any;
  color?: LabelColor;
}) {
  const text = fieldText(value);
  const resolved: LabelColor =
    color ??
    (text === 'Green'
      ? 'success'
      : text === 'Orange'
        ? 'warning'
        : text === 'Red'
          ? 'error'
          : 'default');

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>
        {text ? (
          <Label color={resolved} variant="soft">
            {text}
          </Label>
        ) : (
          '—'
        )}
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function LoanView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('loans');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');
  const loanId = searchParams.get('loanId');
  const mdUp = useMediaQuery((theme) => theme.breakpoints.up('md'));

  const [loans, setLoans] = useState<Loan[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListFilterValues>({});

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

  useEffect(() => {
    fetchLoans();
    fetchFarmers();
  }, [fetchLoans, fetchFarmers]);

  const refetchAll = useCallback(() => {
    fetchLoans();
    fetchFarmers();
  }, [fetchLoans, fetchFarmers]);

  useRefetchOnVisible(refetchAll);

  const loanFilterFields = useMemo((): ListFilterField[] => {
    const distinct = (key: string) =>
      Array.from(new Set(loans.map((l) => fieldText(l.fields[key])).filter(Boolean))).map(
        (v) => ({ value: v, label: v })
      );
    const seasonOptions = Array.from(
      new Set(loans.flatMap((l) => fieldArray(l.fields['Name (from Seasons)'])).map(String).filter(Boolean))
    ).map((v) => ({ value: v, label: v }));
    return [
      { key: 'loanId', label: t('fields.loanId') },
      { key: 'loanStatus', label: t('fields.loanStatus'), options: distinct('Loan Status') },
      {
        key: 'farmer',
        label: t('fields.farmer'),
        options: farmers.map((farmer) => ({
          value: farmer.id,
          label: farmer.fields.Name || 'Unnamed',
        })),
      },
      { key: 'verifiedMobileMoney', label: t('fields.verifiedMobileMoneyNumber') },
      { key: 'season', label: t('fields.season'), options: seasonOptions, multiple: true },
      { key: 'loanObject', label: t('fields.loanObject'), options: distinct('Loan Object') },
      { key: 'totalAmount', label: t('fields.totalAmount') },
    ];
  }, [t, loans, farmers]);

  const loanFilterValue = (l: Loan, key: string): any => {
    switch (key) {
      case 'loanId':
        return fieldText(l.fields['Loan ID']);
      case 'loanStatus':
        return fieldText(l.fields['Loan Status']);
      case 'farmer':
        return fieldArray(l.fields.Farmer);
      case 'verifiedMobileMoney':
        return fieldText(l.fields['Verified Mobile Money Number']);
      case 'season':
        return fieldArray(l.fields['Name (from Seasons)']);
      case 'loanObject':
        return fieldText(l.fields['Loan Object']);
      case 'totalAmount':
        return l.fields['Total amount'];
      default:
        return '';
    }
  };

  const filteredLoans = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = loans;

    if (farmerFilter) {
      list = list.filter((l) => fieldArray(l.fields.Farmer).includes(farmerFilter));
    }

    return list.filter((l) => {
      if (term) {
        const text = [
          fieldText(l.fields['Loan ID']),
          fieldText(l.fields['Name (from Farmer)']),
          fieldText(l.fields['Loan Status']),
          fieldText(l.fields['Loan Object']),
          fieldText(l.fields['Name (from Seasons)']),
          fieldText(l.fields['Verified Mobile Money Number']),
          fieldText(l.fields['Total amount']),
          fNumber(fieldNumber(l.fields['Total amount'])),
          fieldText(l.fields['Issue Date']),
        ]
          .join(' ')
          .toLowerCase();
        if (!text.includes(term)) return false;
      }
      return matchesListFilters(l, loanFilterFields, filters, loanFilterValue);
    });
  }, [loans, search, filters, farmerFilter, loanFilterFields]);

  const selectedLoan = useMemo(
    () => filteredLoans.find((l) => l.id === selectedId) || filteredLoans[0] || null,
    [filteredLoans, selectedId]
  );

  useEffect(() => {
    if (loanId && filteredLoans.some((l) => l.id === loanId)) {
      setSelectedId(loanId);
      if (!mdUp) setDetailOpen(true);
      return;
    }
    if (selectedId || !filteredLoans.length) return;
    setSelectedId(filteredLoans[0]?.id);
  }, [filteredLoans, selectedId, loanId, mdUp]);

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
      const status = fieldText(l.fields['Loan Status']);
      const statusBucket = statuses[status];
      if (statusBucket) {
        statusBucket.count += 1;
        statusBucket.amount += fieldNumber(l.fields['Total amount']);
        const farmer = farmers.find((f) => f.id === fieldArray(l.fields.Farmer)[0]);
        if (farmer?.fields.Gender === 'Female') statusBucket.women += 1;
      }

      const repKey = repaymentBucket(l.fields['Repayment Status']);
      if (repKey) {
        repayments[repKey].count += 1;
        repayments[repKey].pending += fieldNumber(l.fields['Total Amount Pending']);
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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!mdUp) setDetailOpen(true);
  };

  const renderSummary = () => (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STATUS_SUMMARY_CARDS.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.key}>
            <SummaryCard
              title={t(s.titleKey)}
              total={statusStats[s.key]?.count ?? 0}
              subtext={t('summary.womenSubtext', { count: statusStats[s.key]?.women ?? 0 })}
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
              title={`${t(s.titleKey)} (UGX)`}
              total={statusStats[s.key]?.amount ?? 0}
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
              total={repaymentStats[s.key]?.pending ?? 0}
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
            fields={loanFilterFields}
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
            {filteredLoans.map((loan) => {
              const isSelected = loan.id === selectedLoan?.id;
              const status = fieldText(loan.fields['Loan Status']);

              return (
                <ListItemButton
                  key={loan.id}
                  selected={isSelected}
                  onClick={() => handleSelect(loan.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={fieldText(loan.fields['Loan ID']) || t('unnamedLoan')}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    {status && (
                      <Label color={statusColor(status)}>
                        {status}
                      </Label>
                    )}
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {fNumber(fieldNumber(loan.fields['Total amount']))} UGX · {fNumber(fieldNumber(loan.fields['Total Amount Pending']))} pending
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
    const farmerId = fieldArray(f.Farmer)[0];
    const farmerHref = farmerId
      ? `/dashboard/farmers?farmerId=${farmerId}&fpoName=${encodeURIComponent(activeFbo?.name ?? '')}`
      : undefined;

    const netgeckoHelper = t('fields.willBeUpdatedByNetGecko');

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
              <Typography variant="h5">{fieldText(f['Loan ID']) || t('unnamedLoan')}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {[fieldText(f['Loan Object']), fieldText(f['Name (from Season)'])].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
            {onCloseDetail && (
              <IconButton onClick={onCloseDetail}>
                <Iconify icon={'mingcute:close-line' as any} />
              </IconButton>
            )}
          </Stack>

          <Box sx={{ mb: 3 }}>
            {/* Status is managed by NetGecko in Airtable — read-only
                segmented display, same look as input orders. */}
            <Box
              role="group"
              aria-label={t('fields.loanStatus')}
              sx={{
                display: 'flex',
                p: 0.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {LOAN_STATUS_SEGMENTS.map((key) => {
                const selected = fieldText(f['Loan Status']) === key;
                const color = statusColor(key) as 'warning' | 'info' | 'success' | 'error';
                return (
                  <Box
                    key={key}
                    sx={(theme) => ({
                      flex: 1,
                      py: 1,
                      textAlign: 'center',
                      borderRadius: 0.75,
                      typography: 'subtitle2',
                      color: selected ? `${color}.main` : 'text.secondary',
                      bgcolor: selected
                        ? varAlpha(theme.vars.palette[color].mainChannel, 0.16)
                        : 'transparent',
                    })}
                  >
                    {t(`summary.statusCards.${key}`)}
                  </Box>
                );
              })}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
              {t('fields.statusManagedByNetGecko')}
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1, pb: 1 }}>
                {t('sections.details')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FlagRow
                label={t('fields.loanStatus')}
                value={f['Loan Status']}
                color={statusColor(fieldText(f['Loan Status'])) as LabelColor}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FlagRow
                label={t('fields.loanType')}
                value={f['Loan Object']}
                color={fieldText(f['Loan Object']) === 'Cash Advance' ? 'warning' : 'info'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.farmer')}
                value={fieldText(f['Name (from Farmer)'])}
                href={farmerHref}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.issueDate')} value={fDate(f['Issue Date'])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.downpaymentDueDate')} value={fDate(f['Downpayment Due Date'])} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.repaymentDueDate')} value={fDate(f['Repayment Due Date'])} />
            </Grid>
            {fieldArray(f['Orders (Input)'])[0] && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <DetailRow
                  label={t('fields.inputOrder')}
                  value={fieldText(f['Order number (from Orders (Input))'])}
                  href={`/dashboard/input-orders?farmerId=${farmerId ?? ''}&fpoName=${encodeURIComponent(activeFbo?.name ?? '')}`}
                />
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1, pb: 1 }}>
                {t('sections.amount')}
              </Typography>
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
                label={t('fields.totalAmount')}
                value={f['Total amount']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.downpaymentPct')}
                value={fieldPercent(f['% Downpayment']) || undefined}
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
                label={t('fields.principalPlusInterest')}
                value={f['Principal + Interest']}
                helper={netgeckoHelper}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1, pb: 1 }}>
                {t('sections.repayment')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FlagRow label={t('fields.flagDownpayment')} value={f['Flag (Downpayment)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.downpaymentDueDate')}
                value={fDate(f['Downpayment Due Date'])}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.downpaymentAmountPaid')}
                value={f['Downpayment Amount Paid']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.downpaymentAmountPending')}
                value={f['Downpayment Amount Pending']}
                helper={netgeckoHelper}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FlagRow label={t('fields.flagRepayment')} value={f['Flag (Repayment)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.repaymentDueDate')}
                value={fDate(f['Repayment Due Date'])}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.repaymentAmountPaid')}
                value={f['Repayment Amount Paid']}
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.repaymentAmountDue')}
                value={f['Repayment Amount Pending']}
                helper={netgeckoHelper}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.penalty')}
                value={
                  f['Penalty (calc)'] && typeof f['Penalty (calc)'] !== 'object'
                    ? f['Penalty (calc)']
                    : f['Penalty per week']
                }
                helper={netgeckoHelper}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.penaltyAmountDue')}
                value={f['Penalty Amount Due']}
                helper={netgeckoHelper}
              />
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
                label={t('fields.sumPaymentReceived')}
                value={f['Sum payment received']}
                helper={netgeckoHelper}
              />
            </Grid>

            {fieldArray(f['Payments Received Link']).length ? (
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>
                  {t('fields.paymentsReceived')}
                </Typography>
                {fieldArray(f['Payment ID (from Payments Link)']).map((pid: any, idx: number) => (
                  <Typography key={idx} variant="body2" sx={{ color: 'text.secondary' }}>
                    Payment #{fieldText(pid)} · {fNumber(fieldNumber(fieldArray(f['Payments received'])[idx]))} UGX ·{' '}
                    {fDate(fieldText(fieldArray(f['Dates payment received'])[idx]))}
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
