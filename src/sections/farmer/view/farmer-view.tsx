import type { Farmer } from '../types';
import type { Land } from 'src/sections/land/types';
import type { Loan } from 'src/sections/loan/types';
import type { Payment } from 'src/sections/payment/types';
import type { SalesOrder } from 'src/sections/sales/types';
import type { InputOrder } from 'src/sections/input-order/types';

type Crop = {
  id: string;
  fields: Record<string, any>;
};

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import { alpha, useTheme } from '@mui/material/styles';
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

import { FarmerFormDialog } from '../components/farmer-form-dialog';
import { InlineEditField } from '../components/farmer-inline-field';

// ----------------------------------------------------------------------

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
  color: 'primary' | 'success' | 'warning' | 'error';
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

// ----------------------------------------------------------------------

type RelatedLinkProps = {
  label: string;
  value?: any;
  href: string;
  color?: 'primary' | 'success' | 'info' | 'warning' | 'error';
};

function RelatedLink({ label, value, href, color = 'primary' }: RelatedLinkProps) {
  const theme = useTheme();
  const mainColor = theme.palette[color].main;

  return (
    <MuiLink
      component={RouterLink}
      href={href}
      underline="none"
      sx={{ display: 'block', borderRadius: 1 }}
    >
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1,
          border: (t) => `1px solid ${t.vars.palette.divider}`,
          color: mainColor,
          transition: (t) => t.transitions.create(['background-color', 'box-shadow', 'border-color']),
          '&:hover': {
            bgcolor: alpha(mainColor, 0.08),
            borderColor: mainColor,
            boxShadow: (t) => t.shadows[2],
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
            <Typography variant="body1" sx={{ color: 'inherit', fontWeight: 600 }}>
              {value ?? '—'}
            </Typography>
          </Box>

          <Iconify icon={'solar:arrow-right-up-bold' as any} width={20} sx={{ color: 'inherit' }} />
        </Stack>
      </Box>
    </MuiLink>
  );
}

type RecordListProps = {
  label: string;
  records: { id: string; label: string; href: string }[];
  color?: 'primary' | 'success' | 'info' | 'warning' | 'error';
};

function RecordList({ label, records, color = 'primary' }: RecordListProps) {
  const theme = useTheme();
  const mainColor = theme.palette[color].main;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: (t) => `1px solid ${t.vars.palette.divider}`,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      {records.length === 0 ? (
        <Typography variant="body1" sx={{ color: 'text.disabled' }}>
          —
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {records.map((record) => (
            <MuiLink
              key={record.id}
              component={RouterLink}
              href={record.href}
              underline="hover"
              sx={{ color: mainColor, display: 'block' }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'inherit',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}
                >
                  {record.label}
                </Typography>
                <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ color: 'inherit', flexShrink: 0 }} />
              </Stack>
            </MuiLink>
          ))}
        </Stack>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

export function FarmerView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('farmers');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerId = searchParams.get('farmerId');

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
  const [fullFarmer, setFullFarmer] = useState<Farmer | null>(null);
  const [activeFarmerIds, setActiveFarmerIds] = useState<Set<string>>(new Set());
  const [crops, setCrops] = useState<Crop[]>([]);
  const [lands, setLands] = useState<Land[]>([]);
  const [inputOrders, setInputOrders] = useState<InputOrder[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);

  const fetchFarmers = useCallback(async () => {
    if (!activeFbo) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchFarmers();
  }, [fetchFarmers]);

  const fetchCrops = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/v1/crops');
      setCrops(data.records || []);
    } catch (error: any) {
      console.error('Fetch crops error:', error?.message);
      setCrops([]);
    }
  }, []);

  useEffect(() => {
    fetchCrops();
  }, [fetchCrops]);

  const cropOptions = useMemo(() => crops.map((c) => String(c.fields['Crop Name'] ?? c.id)), [crops]);

  const fetchLands = useCallback(async () => {
    if (!activeFbo) return;
    try {
      const query = new URLSearchParams({
        fpoId: activeFbo.id,
        fpoName: activeFbo.name,
      }).toString();
      const { data } = await axios.get(`/api/v1/lands?${query}`);
      setLands(data.records || []);
    } catch (error: any) {
      console.error('Fetch lands error:', error?.message);
      setLands([]);
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchLands();
  }, [fetchLands]);

  const fetchTransactions = useCallback(async () => {
    if (!activeFbo) return;
    const fpoQuery = new URLSearchParams({
      fpoId: activeFbo.id,
      fpoName: activeFbo.name,
    }).toString();

    try {
      const [
        { data: ordersData },
        { data: loansData },
        { data: paymentsData },
        { data: salesData },
      ] = await Promise.all([
        axios.get(`/api/v1/input-orders?${fpoQuery}`),
        axios.get(`/api/v1/loans?${fpoQuery}`),
        axios.get(`/api/v1/payments?${fpoQuery}`),
        axios.get(`/api/v1/sales-orders?${fpoQuery}`),
      ]);

      const orderRecords = ordersData.records || [];
      const loanRecords = loansData.records || [];
      const paymentRecords = paymentsData.records || [];
      const salesRecords = salesData.records || [];

      setInputOrders(orderRecords);
      setLoans(loanRecords);
      setPayments(paymentRecords);
      setSalesOrders(salesRecords);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const records = [...orderRecords, ...loanRecords, ...paymentRecords, ...salesRecords];

      const ids = new Set<string>();
      records.forEach((record: any) => {
        const date =
          record.fields['Order date'] ||
          record.fields['Order Date'] ||
          record.fields['Issue Date'] ||
          record.fields['Payment Date'] ||
          record.createdTime;
        if (!date) return;
        const d = new Date(date);
        if (Number.isNaN(d.getTime()) || d < oneYearAgo) return;

        const farmer = record.fields.Farmer;
        const recordFarmerId = Array.isArray(farmer) ? farmer[0] : farmer;
        if (recordFarmerId) ids.add(recordFarmerId);
      });

      setActiveFarmerIds(ids);
    } catch (error: any) {
      console.error('Fetch transactions error:', error?.message);
    }
  }, [activeFbo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredFarmers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return farmers;
    return farmers.filter((f) => {
      const name = String(f.fields.Name || '').toLowerCase();
      const phone = String(f.fields['Phone Number'] || '').toLowerCase();
      const nin = String(f.fields['NIN (National Identification Number)'] || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || nin.includes(term);
    });
  }, [farmers, search]);

  const selectedFarmer = useMemo(
    () => farmers.find((f) => f.id === selectedId) || filteredFarmers[0] || null,
    [farmers, filteredFarmers, selectedId]
  );

  useEffect(() => {
    if (selectedId) return;
    const fromQuery = farmerId ? farmers.find((f) => f.id === farmerId) : null;
    const first = fromQuery || filteredFarmers[0];
    if (first) {
      setSelectedId(first.id);
    }
  }, [farmers, filteredFarmers, farmerId, selectedId]);

  const fetchFullFarmer = useCallback(async (id: string) => {
    try {
      const { data } = await axios.get(`/api/v1/farmers/${id}`);
      setFullFarmer(data.record);
    } catch (error: any) {
      console.error('Fetch farmer error:', error?.message);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setFullFarmer(null);
    fetchFullFarmer(selectedId);
  }, [selectedId, fetchFullFarmer]);

  const isWoman = (f: Farmer) => f.fields.Gender === 'Female';
  const roundPercent = (count: number, total: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const stats = useMemo(() => {
    const totalFarmers = farmers;
    const total = totalFarmers.length;
    const totalWomen = totalFarmers.filter(isWoman).length;

    const pendingFarmers = totalFarmers.filter((f) => f.fields.Checked === true);
    const pending = pendingFarmers.length;
    const pendingWomen = pendingFarmers.filter(isWoman).length;

    const activeFarmers = totalFarmers.filter(
      (f) => !f.fields.Checked && activeFarmerIds.has(f.id)
    );
    const active = activeFarmers.length;
    const activeWomen = activeFarmers.filter(isWoman).length;

    const inactiveFarmers = totalFarmers.filter(
      (f) => !f.fields.Checked && !activeFarmerIds.has(f.id)
    );
    const inactive = inactiveFarmers.length;
    const inactiveWomen = inactiveFarmers.filter(isWoman).length;

    return {
      total,
      totalWomenPercent: roundPercent(totalWomen, total),
      active,
      activeWomenPercent: roundPercent(activeWomen, active),
      pending,
      pendingWomenPercent: roundPercent(pendingWomen, pending),
      inactive,
      inactiveWomenPercent: roundPercent(inactiveWomen, inactive),
    };
  }, [farmers, activeFarmerIds]);

  const handleAdd = () => {
    setEditingFarmer(null);
    setFormOpen(true);
  };

  const handleEdit = (farmer: Farmer) => {
    setEditingFarmer(farmer);
    setFormOpen(true);
  };

  const handleFieldSaved = () => {
    fetchFarmers();
    if (selectedId) fetchFullFarmer(selectedId);
  };

  const renderSummary = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.totalMembers.title')}
          total={stats.total}
          subtext={t('summary.totalMembers.subtext', { percentage: stats.totalWomenPercent })}
          color="primary"
          icon="solar:users-group-rounded-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.activeFarmers.title')}
          total={stats.active}
          subtext={t('summary.activeFarmers.subtext', { percentage: stats.activeWomenPercent })}
          color="success"
          icon="solar:user-check-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.pendingApproval.title')}
          total={stats.pending}
          subtext={t('summary.pendingApproval.subtext', { percentage: stats.pendingWomenPercent })}
          color="warning"
          icon="solar:user-id-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.inactive.title')}
          total={stats.inactive}
          subtext={t('summary.inactive.subtext', { percentage: stats.inactiveWomenPercent })}
          color="error"
          icon="solar:user-cross-bold-duotone"
        />
      </Grid>
    </Grid>
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
            {filteredFarmers.map((farmer) => {
              const isSelected = farmer.id === selectedFarmer?.id;
              const gender = farmer.fields.Gender;

              return (
                <ListItemButton
                  key={farmer.id}
                  selected={isSelected}
                  onClick={() => setSelectedId(farmer.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={farmer.fields.Name || t('unnamed')}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    {gender && (
                      <Label color={gender === 'Female' ? 'success' : 'info'}>
                        {gender}
                      </Label>
                    )}
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {farmer.fields['Phone Number']}
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
    if (!selectedFarmer) {
      return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('emptyDetail')}
          </Typography>
        </Card>
      );
    }

    const detailFarmer =
      fullFarmer && fullFarmer.id === selectedFarmer?.id ? fullFarmer : selectedFarmer;

    if (!detailFarmer) return null;

    const f = detailFarmer.fields;
    const cropIdOrName = Array.isArray(f['Main crop sold to Cooperative'])
      ? f['Main crop sold to Cooperative'][0]
      : f['Main crop sold to Cooperative'];
    const cropRecord = crops.find((c) => c.id === cropIdOrName);
    const cropValue = cropRecord ? cropRecord.fields['Crop Name'] ?? cropIdOrName : cropIdOrName;

    const hasFarmer = (record?: { fields: Record<string, any> }) => {
      if (!record) return false;
      const farmer = record.fields.Farmer;
      if (Array.isArray(farmer)) return farmer.includes(detailFarmer.id);
      return farmer === detailFarmer.id;
    };

    const farmerLands = lands.filter(hasFarmer);
    const farmerInputOrders = inputOrders.filter(hasFarmer);
    const farmerLoans = loans.filter(hasFarmer);
    const farmerPayments = payments.filter((p) => {
      const loan = loans.find((l) => l.id === p.fields.Loans?.[0]);
      return hasFarmer(loan);
    });
    const farmerSales = salesOrders.filter(hasFarmer);

    const makeLink = (module: string, recordId?: string, recordIdKey?: string) => {
      const params = new URLSearchParams({ farmerId: detailFarmer.id });
      if (recordId && recordIdKey) params.set(recordIdKey, recordId);
      if (activeFbo?.name) params.set('fpoName', activeFbo.name);
      return `/dashboard/${module}?${params.toString()}`;
    };

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
              <Typography variant="h5">{f.Name || t('unnamed')}</Typography>
            </Box>

            <Button
              color="primary"
              variant="contained"
              size="small"
              onClick={() => handleEdit(detailFarmer)}
            >
              {t('actions.edit')}
            </Button>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Given Name"
                label={t('fields.givenName')}
                value={f['Given Name']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Surname"
                label={t('fields.surname')}
                value={f.Surname}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Birth date"
                label={t('fields.birthDate')}
                value={f['Birth date']}
                type="date"
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.age')} value={f.Age} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Gender"
                label={t('fields.gender')}
                value={f.Gender}
                type="select"
                options={['Male', 'Female']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Farmer Code"
                label={t('fields.farmerCode')}
                value={f['Farmer Code']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.farmerIdFrontBack')} value={f['Farmer ID (front back)']} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <DetailRow label={t('fields.address')} value={f.Address} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Village"
                label={t('fields.village')}
                value={f.Village}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Parish"
                label={t('fields.parish')}
                value={f.Parish}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Sub-county"
                label={t('fields.subCounty')}
                value={f['Sub-county']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="District (form)"
                label={t('fields.district')}
                value={f['District (form)']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.region')} value={f['Region Name']?.[0] ?? f.Region} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', px: 1, display: 'block' }}>
                {t('fields.addressNote')}
              </Typography>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Phone Number"
                label={t('fields.phoneNumber')}
                value={f['Phone Number']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Mobile Money Number"
                label={t('fields.mobileMoneyNumber')}
                value={f['Mobile Money Number']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.verifiedMobileMoneyNumber')}
                value={f['Verified mobile money number']}
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', px: 1 }}>
                {t('fields.verifiedMobileMoneyNote')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Email"
                label={t('fields.email')}
                value={f.Email}
                onSaved={handleFieldSaved}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Main crop sold to Cooperative"
                label={t('fields.mainCropSold')}
                value={cropValue}
                type="select"
                options={cropOptions}
                arrayValue
                onSaved={handleFieldSaved}
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', px: 1 }}>
                {t('fields.mainCropSoldHelper')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Volume sold last season A to Cooperative (kg)"
                label={t('fields.volumeSeasonA')}
                value={f['Volume sold last season A to Cooperative (kg)']}
                type="number"
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Volume sold last season B to Cooperative (kg) copy"
                label={t('fields.volumeSeasonB')}
                value={f['Volume sold last season B to Cooperative (kg) copy']}
                type="number"
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="Member since (date)"
                label={t('fields.memberSince')}
                value={f['Member since (date)']}
                type="date"
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.memberSinceYear')} value={f['Member since (year)']} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="# seasonal/temporary workers hired & paid by farmer"
                label={t('fields.seasonalWorkers')}
                value={f['# seasonal/temporary workers hired & paid by farmer']}
                type="number"
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                farmerId={detailFarmer.id}
                name="# permanent workers hired & paid by farmer"
                label={t('fields.permanentWorkers')}
                value={f['# permanent workers hired & paid by farmer']}
                type="number"
                onSaved={handleFieldSaved}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            {(() => {
              const landLinks = farmerLands.map((l) => ({
                id: l.id,
                label: l.fields.Land || t('unnamedLand'),
                href: makeLink('lands', l.id, 'landId'),
              }));
              const orderLinks = farmerInputOrders.map((o) => ({
                id: o.id,
                label: o.fields['Order number'] || o.id,
                href: makeLink('input-orders', o.id, 'inputOrderId'),
              }));
              const loanLinks = farmerLoans.map((l) => ({
                id: l.id,
                label: l.fields['Loan ID'] || l.id,
                href: makeLink('loans', l.id, 'loanId'),
              }));
              const paymentLinks = farmerPayments.map((p) => ({
                id: p.id,
                label: p.fields['Payment ID'] || p.id,
                href: makeLink('payments', p.id, 'paymentId'),
              }));
              const salesLinks = farmerSales.map((s) => ({
                id: s.id,
                label: s.fields['Order #'] || s.fields.Date || s.id,
                href: makeLink('sales', s.id, 'salesOrderId'),
              }));

              return (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RelatedLink
                      href={makeLink('lands')}
                      label={t('fields.landsCount')}
                      value={farmerLands.length}
                      color="success"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RecordList label={t('fields.lands')} records={landLinks} color="success" />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RelatedLink
                      href={makeLink('input-orders')}
                      label={t('fields.inputOrdersCount')}
                      value={farmerInputOrders.length}
                      color="info"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RecordList label={t('fields.inputOrders')} records={orderLinks} color="info" />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RelatedLink
                      href={makeLink('loans')}
                      label={t('fields.loansCount')}
                      value={farmerLoans.length}
                      color="warning"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RecordList label={t('fields.loans')} records={loanLinks} color="warning" />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RelatedLink
                      href={makeLink('payments')}
                      label={t('fields.paymentsCount')}
                      value={farmerPayments.length}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RecordList label={t('fields.payments')} records={paymentLinks} color="primary" />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RelatedLink
                      href={makeLink('sales')}
                      label={t('fields.salesCount')}
                      value={farmerSales.length}
                      color="error"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <RecordList label={t('fields.sales')} records={salesLinks} color="error" />
                  </Grid>
                </>
              );
            })()}
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
        <Button color="primary" variant="contained" startIcon={<Iconify icon={'solar:add-circle-bold' as any} />} onClick={handleAdd}>
          {t('page.addFarmer')}
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

      <FarmerFormDialog
        open={formOpen}
        farmer={editingFarmer}
        fpoId={activeFbo?.id}
        onClose={() => setFormOpen(false)}
        onSaved={handleFieldSaved}
      />
    </DashboardContent>
  );
}
