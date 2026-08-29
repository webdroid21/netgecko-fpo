import type { Loan, LoanType } from '../types';
import type { Farmer } from 'src/sections/farmer/types';
import type { Season, InputOrder } from 'src/sections/input-order/types';

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
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { LoanFormDialog } from '../components/loan-form-dialog';

// ----------------------------------------------------------------------

const STATUS_CARDS = [
  { key: 'Open', label: 'Open', color: 'warning' as const },
  { key: 'Active', label: 'Active', color: 'info' as const },
  { key: 'Closed', label: 'Closed', color: 'success' as const },
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

export function LoanView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('loans');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');

  const [loans, setLoans] = useState<Loan[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [inputOrders, setInputOrders] = useState<InputOrder[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

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

  const fetchLoanTypes = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/loan-types');
      setLoanTypes(data.records || []);
    } catch (error: any) {
      console.error('Fetch loan types error:', error?.message);
      setLoanTypes([]);
    }
  }, []);

  const fetchInputOrders = useCallback(async () => {
    if (!activeFbo) return;
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/input-orders?${query}`);
      setInputOrders(data.records || []);
    } catch (error: any) {
      console.error('Fetch input orders error:', error?.message);
      setInputOrders([]);
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

  useEffect(() => {
    fetchLoans();
    fetchFarmers();
    fetchLoanTypes();
    fetchInputOrders();
    fetchSeasons();
  }, [fetchLoans, fetchFarmers, fetchLoanTypes, fetchInputOrders, fetchSeasons]);

  useEffect(() => {
    if (selectedId || !loans.length) return;
    const match = farmerFilter
      ? loans.find((l) => (l.fields.Farmer ?? []).includes(farmerFilter))
      : null;
    setSelectedId(match?.id || loans[0]?.id);
  }, [loans, farmerFilter, selectedId]);

  const filteredLoans = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return loans;

    return loans.filter((l) => {
      const text = `${l.fields['Loan ID'] ?? ''} ${(l.fields['Name (from Farmer)'] || []).join(' ')} ${l.fields['Loan Status'] ?? ''}`.toLowerCase();
      return text.includes(term);
    });
  }, [loans, search]);

  const selectedLoan = useMemo(
    () => loans.find((l) => l.id === selectedId) || filteredLoans[0] || null,
    [loans, filteredLoans, selectedId]
  );

  const stats = useMemo(() => {
    const total = filteredLoans.reduce(
      (sum, l) => sum + (Number(l.fields['Total amount']) || 0),
      0
    );
    const pending = filteredLoans.reduce(
      (sum, l) => sum + (Number(l.fields['Total Amount Pending']) || 0),
      0
    );
    return { total, pending };
  }, [filteredLoans]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_CARDS.forEach((s) => (counts[s.key] = 0));
    loans.forEach((l) => {
      const status = l.fields['Loan Status'];
      if (status && counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
  }, [loans]);

  const handleAdd = () => {
    setEditingLoan(null);
    setFormOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setFormOpen(true);
  };

  const handleDelete = async (loan: Loan) => {
    const reference = loan.fields['Loan ID'] ?? t('unnamedLoan');
    if (!confirm(t('confirmDeleteLoan', { reference }))) return;
    try {
      await axios.delete(`/api/v1/loans/${loan.id}`);
      fetchLoans();
    } catch (error: any) {
      console.error('Delete loan error:', error?.message);
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
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <SummaryCard
            title={t('summary.totalAmount.title')}
            total={stats.total}
            subtext={t('summary.totalAmount.subtext')}
            color="primary"
            icon="solar:tag-price-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <SummaryCard
            title={t('summary.totalPending.title')}
            total={stats.pending}
            subtext={t('summary.totalPending.subtext')}
            color="warning"
            icon="solar:alarm-bold-duotone"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STATUS_CARDS.map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={s.key}>
            <Card sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ color: `${s.color}.main` }}>
                  <Iconify icon={'solar:reorder-bold' as any} width={28} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                    {t(`summary.statusCards.${s.key}`)}
                  </Typography>
                  <Typography variant="h4" sx={{ my: 0.5 }}>
                    {fNumber(statusCounts[s.key])}
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
                      primaryTypographyProps={{ variant: 'subtitle2' }}
                    />
                    {loan.fields['Loan Status'] && (
                      <Label color={statusColor(loan.fields['Loan Status'])}>
                        {loan.fields['Loan Status']}
                      </Label>
                    )}
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
              <Typography variant="h5">{f['Loan ID'] || t('unnamedLoan')}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {(f['Loan Object'] || []).join(', ')} · {(f['Name (from Season)'] || []).join(', ')}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleEdit(selectedLoan)}>
                {t('actions.edit')}
              </Button>
              <IconButton color="error" onClick={() => handleDelete(selectedLoan)}>
                <Iconify icon={'solar:trash-bin-trash-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
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
              <DetailRow label={t('fields.totalAmount')} value={f['Total amount']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.principal')} value={f['Principal']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.interest')} value={f['Interest']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.downpayment')} value={f['Downpayment']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.principalPlusInterest')} value={f['Principal + Interest']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.repaymentDueDate')} value={f['Repayment Due Date']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.totalAmountPending')} value={f['Total Amount Pending']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.repaymentStatus')} value={f['Repayment Status']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.sumPaymentReceived')} value={f['Sum payment received']} />
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
          <Typography variant="h4">{t('page.title')}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('page.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
          onClick={handleAdd}
        >
          {t('page.newLoan')}
        </Button>
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

      <LoanFormDialog
        open={formOpen}
        loan={editingLoan}
        fpoId={activeFbo?.id}
        farmers={farmers}
        loanTypes={loanTypes}
        inputOrders={inputOrders}
        seasons={seasons}
        onClose={() => setFormOpen(false)}
        onSaved={fetchLoans}
        onFarmerCreated={handleFarmerCreated}
      />
    </DashboardContent>
  );
}
