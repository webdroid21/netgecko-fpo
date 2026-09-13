import type { Payment } from '../types';
import type { Loan } from 'src/sections/loan/types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { useSearchParams } from 'src/routes/hooks/use-search-params';

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { PaymentFormDialog } from '../components/payment-form-dialog';

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

function DetailRow({ label, value }: { label: string; value?: any }) {
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{value ?? '—'}</Typography>
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

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

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
      setPayments([]);
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
      setLoans([]);
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchPayments();
    fetchLoans();
  }, [fetchPayments, fetchLoans]);

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

    if (!term) return list;

    return list.filter((p) => {
      const text = `${p.fields['Payment ID'] ?? ''} ${(p.fields['FPO (from Loans)'] || []).join(' ')} ${p.fields.Source ?? ''} ${p.fields['Payment reference'] ?? ''}`.toLowerCase();
      return text.includes(term);
    });
  }, [payments, search, farmerFilter, loans]);

  const selectedPayment = useMemo(
    () => filteredPayments.find((p) => p.id === selectedId) || filteredPayments[0] || null,
    [filteredPayments, selectedId]
  );

  useEffect(() => {
    if (paymentId && filteredPayments.some((p) => p.id === paymentId)) {
      setSelectedId(paymentId);
      return;
    }
    if (selectedId || !filteredPayments.length) return;
    setSelectedId(filteredPayments[0]?.id);
  }, [filteredPayments, selectedId, paymentId]);

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

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormOpen(true);
  };

  const handleDelete = async (payment: Payment) => {
    const id = payment.fields['Payment ID'] ?? '-';
    if (!confirm(t('confirmDeletePayment', { id }))) return;
    try {
      await axios.delete(`/api/v1/payments/${payment.id}`);
      fetchPayments();
    } catch (error: any) {
      console.error('Delete payment error:', error?.message);
    }
  };

  const loanLabel = (id?: string) => {
    const loan = loans.find((l) => l.id === id);
    return loan ? loan.fields['Loan ID'] || t('unnamedLoan') : '—';
  };

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
            {filteredPayments.map((payment) => {
              const isSelected = payment.id === selectedPayment?.id;

              return (
                <ListItemButton
                  key={payment.id}
                  selected={isSelected}
                  onClick={() => setSelectedId(payment.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={`${t('unnamedPayment')} #${payment.fields['Payment ID'] ?? '-'}`}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    <Label color={payment.fields.Check === 'OK' ? 'success' : 'warning'}>
                      {payment.fields.Check || '—'}
                    </Label>
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {loanLabel(payment.fields.Loans?.[0])} · {payment.fields.Source}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {fNumber(payment.fields['Payment Amount (UGX)'])} UGX · {payment.fields['Payment Date']}
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
              <Typography variant="h5">{`${t('unnamedPayment')} #${f['Payment ID'] ?? '-'}`}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {f['Payment Date']} · {f.Source}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleEdit(selectedPayment)}>
                {t('actions.edit')}
              </Button>
              <IconButton color="error" onClick={() => handleDelete(selectedPayment)}>
                <Iconify icon={'solar:trash-bin-trash-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.check')} value={f.Check} />
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
              <DetailRow label={t('fields.paymentDate')} value={f['Payment Date']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.paymentReference')} value={f['Payment reference']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.mobileMoneyNumberUsed')} value={f['Mobile Money Number Used']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.fpo')} value={(f['FPO (from Loans)'] || []).join(', ')} />
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
            subtext={t('summary.totalPayments.subtext')}
            color="primary"
            icon="solar:wallet-money-bold-duotone"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard
            title={t('summary.totalReceived.title')}
            total={stats.total}
            subtext={t('summary.totalReceived.subtext')}
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

        <Grid size={{ xs: 12, md: 8 }} sx={{ height: 1 }}>
          {renderDetail()}
        </Grid>
      </Grid>

      <PaymentFormDialog
        open={formOpen}
        payment={editingPayment}
        loans={loans}
        onClose={() => setFormOpen(false)}
        onSaved={fetchPayments}
      />
    </DashboardContent>
  );
}
