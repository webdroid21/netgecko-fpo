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

import type { ListFilterField, ListFilterValues } from 'src/components/list-filters';

import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import { alpha, useTheme } from '@mui/material/styles';
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
import { RecordAttachmentField } from 'src/components/record-attachment-field';

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

function isRecordIdLike(value?: unknown) {
  if (typeof value === 'string') return value.startsWith('rec');
  if (Array.isArray(value)) return value.some((v) => typeof v === 'string' && v.startsWith('rec'));
  return false;
}

function parseAddress(address?: unknown) {
  const raw = typeof address === 'string' && !isRecordIdLike(address) ? address : '';
  const parts = (raw || '').split(',').map((part) => part.trim());
  return {
    village: parts[0] || '',
    parish: parts[1] || '',
    subCounty: parts[2] || '',
    district: parts[3] || '',
    region: parts[4] || '',
  };
}

// ----------------------------------------------------------------------

function DetailRow({
  label,
  value,
  helperText,
}: {
  label: string;
  value?: any;
  helperText?: ReactNode;
}) {
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{value ?? '—'}</Typography>
      {helperText && (
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
          {helperText}
        </Typography>
      )}
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
  const { activeFbo, canEdit } = useAuthContext();
  const { t } = useTranslate('farmers');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerId = searchParams.get('farmerId');
  const mdUp = useMediaQuery((theme) => theme.breakpoints.up('md'));

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListFilterValues>({});
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
      // Keep the previous records on failure — a transient error (e.g. the
      // machine waking up) must not wipe the list to zero.
      console.error('Fetch farmers error:', error?.message);
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

  const [villages, setVillages] = useState<{ id: string; fields: Record<string, any> }[]>([]);

  useEffect(() => {
    axios
      .get('/api/v1/villages')
      .then(({ data }) => setVillages(data.records || []))
      .catch(() => setVillages([]));
  }, []);

  const cropSelectOptions = useMemo(
    () =>
      crops.map((c) => ({
        value: c.id,
        label: String(c.fields['Crop Name'] ?? c.id),
      })),
    [crops]
  );

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

    const endpoints = ['input-orders', 'loans', 'payments', 'sales-orders'];
    const results = await Promise.allSettled(
      endpoints.map((endpoint) => axios.get(`/api/v1/${endpoint}?${fpoQuery}`))
    );

    // All requests failed (e.g. right after the machine woke up) — keep the
    // previous records instead of zeroing the related-record lists.
    if (results.every((res) => res.status === 'rejected')) return;

    const recordsOf = (res: PromiseSettledResult<any>) => {
      if (res.status === 'rejected') {
        console.error('Fetch transactions error:', res.reason?.message ?? res.reason);
        return [];
      }
      return res.value?.data?.records || [];
    };

    const orderRecords = recordsOf(results[0]);
    const loanRecords = recordsOf(results[1]);
    const paymentRecords = recordsOf(results[2]);
    const salesRecords = recordsOf(results[3]);

    setInputOrders(orderRecords);
    setLoans(loanRecords);
    setPayments(paymentRecords);
    setSalesOrders(salesRecords);

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
      const farmer = record.fields.Farmer ?? record.fields.Farmers;
      (Array.isArray(farmer) ? farmer : [farmer]).forEach((id) => {
        if (id) ids.add(id);
      });
    };

    const ids = new Set<string>();
    [...orderRecords, ...loanRecords, ...paymentRecords, ...salesRecords].forEach((record: any) => {
      if (isRecent(record)) addFarmerLinks(record, ids);
    });

    // Payments have no direct farmer link; resolve through the linked loan
    const loansById = new Map<string, any>(loanRecords.map((l: any) => [l.id, l]));
    paymentRecords.forEach((payment: any) => {
      if (!isRecent(payment)) return;
      (payment.fields.Loans || []).forEach((loanId: string) => {
        const loan = loansById.get(loanId);
        if (loan) addFarmerLinks(loan, ids);
      });
    });

    setActiveFarmerIds(ids);
  }, [activeFbo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const farmerFilterFields = useMemo(
    (): ListFilterField[] => [
      { key: 'givenName', label: t('fields.givenName') },
      { key: 'surname', label: t('fields.surname') },
      { key: 'nin', label: t('fields.nin') },
      { key: 'farmerCode', label: t('fields.farmerCode') },
      { key: 'birthDate', label: t('fields.birthDate') },
      { key: 'age', label: t('fields.age') },
      {
        key: 'gender',
        label: t('fields.gender'),
        options: ['Male', 'Female'].map((g) => ({ value: g, label: g })),
      },
      { key: 'village', label: t('fields.village') },
      { key: 'parish', label: t('fields.parish') },
      { key: 'subCounty', label: t('fields.subCounty') },
      { key: 'district', label: t('fields.district') },
      { key: 'region', label: t('fields.region') },
      { key: 'email', label: t('fields.email') },
      { key: 'phone', label: t('fields.phoneNumber') },
      { key: 'mobileMoney', label: t('fields.mobileMoneyNumber') },
      { key: 'mmNameCheck', label: t('fields.mmNameCheck') },
    ],
    [t]
  );

  const farmerFilterValue = (f: Farmer, key: string): any => {
    const fields = f.fields;
    const first = (v: any) => (Array.isArray(v) ? v[0] : v);
    switch (key) {
      case 'givenName':
        return `${fields['Given Name'] ?? ''} ${fields.Name ?? ''}`;
      case 'surname':
        return fields.Surname;
      case 'nin':
        return fields['NIN (National Identification Number)'];
      case 'farmerCode':
        return fields['Farmer Code'];
      case 'birthDate':
        return fields['Birth date'];
      case 'age':
        return fields.Age;
      case 'gender':
        return fields.Gender;
      case 'village':
        return `${fields.Village ?? ''} ${fields['Village Name'] ?? ''}`;
      case 'parish':
        return `${fields.Parish ?? ''} ${fields['Parish Name'] ?? ''}`;
      case 'subCounty':
        return `${fields['Sub-county'] ?? ''} ${fields['Sub-County Name'] ?? ''}`;
      case 'district':
        return `${fields['District (form)'] ?? ''} ${fields['District Name'] ?? ''}`;
      case 'region':
        return `${fields.Region ?? ''} ${fields['Region Name'] ?? ''}`;
      case 'email':
        return fields.Email;
      case 'phone':
        return fields['Phone Number'];
      case 'mobileMoney':
        return `${fields['Mobile Money Number'] ?? ''} ${fields['Verified Mobile Money Number'] ?? ''}`;
      case 'mmNameCheck':
        return first(fields['MM Name Check']);
      default:
        return '';
    }
  };

  const filteredFarmers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return farmers.filter((f) => {
      if (term) {
        const text = farmerFilterFields.map((field) => farmerFilterValue(f, field.key)).join(' ').toLowerCase();
        if (!text.includes(term)) return false;
      }
      return matchesListFilters(f, farmerFilterFields, filters, farmerFilterValue);
    });
  }, [farmers, search, filters, farmerFilterFields]);

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
      if (fromQuery && !mdUp) setDetailOpen(true);
    }
  }, [farmers, filteredFarmers, farmerId, selectedId, mdUp]);

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

  const refetchAll = useCallback(() => {
    fetchFarmers();
    fetchLands();
    fetchTransactions();
    if (selectedId) fetchFullFarmer(selectedId);
  }, [fetchFarmers, fetchLands, fetchTransactions, fetchFullFarmer, selectedId]);

  useRefetchOnVisible(refetchAll);

  const isWoman = (f: Farmer) => f.fields.Gender === 'Female';
  const roundPercent = (count: number, total: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const stats = useMemo(() => {
    const totalFarmers = farmers;
    const total = totalFarmers.length;
    const totalWomen = totalFarmers.filter(isWoman).length;

    const pendingFarmers = totalFarmers.filter((f) => f.fields.Checked !== true);
    const pending = pendingFarmers.length;
    const pendingWomen = pendingFarmers.filter(isWoman).length;

    const activeFarmers = totalFarmers.filter(
      (f) => f.fields.Checked === true && activeFarmerIds.has(f.id)
    );
    const active = activeFarmers.length;
    const activeWomen = activeFarmers.filter(isWoman).length;

    const inactiveFarmers = totalFarmers.filter(
      (f) => f.fields.Checked === true && !activeFarmerIds.has(f.id)
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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!mdUp) setDetailOpen(true);
  };

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
            fields={farmerFilterFields}
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
            {filteredFarmers.map((farmer) => {
              const isSelected = farmer.id === selectedFarmer?.id;
              const gender = farmer.fields.Gender;

              const fullName = `${farmer.fields['Given Name'] || ''} ${farmer.fields.Surname || ''}`.trim() || farmer.fields.Name || t('unnamed');
              const displayedFarmerId = farmer.fields['NIN (National Identification Number)'] || farmer.fields['Farmer Code'] || '';

              return (
                <ListItemButton
                  key={farmer.id}
                  selected={isSelected}
                  onClick={() => handleSelect(farmer.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={displayedFarmerId ? `${fullName} - ${displayedFarmerId}` : fullName}
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

  const renderDetail = (onCloseDetail?: () => void) => {
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
    const parsedAddress = parseAddress(f.Address);
    const cropLink = f['Main product sold to Partner'];
    const cropId = Array.isArray(cropLink) ? cropLink[0] : cropLink;
    const cropRecord = crops.find((c) => c.id === cropId);
    const cropLookup = f['Crop Name (from Main crop sold to Cooperative)'];
    const cropName =
      cropRecord?.fields['Crop Name'] ??
      (Array.isArray(cropLookup) ? cropLookup[0] : cropLookup) ??
      undefined;

    const hasFarmer = (record?: { fields: Record<string, any> }) => {
      if (!record) return false;
      const farmer = record.fields.Farmer ?? record.fields.Farmers;
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
              <Typography variant="h5">
                {(() => {
                  const fullName = `${f['Given Name'] || ''} ${f.Surname || ''}`.trim() || f.Name || t('unnamed');
                  const displayedFarmerId = f['NIN (National Identification Number)'] || f['Farmer Code'] || '';
                  return displayedFarmerId ? `${fullName} - ${displayedFarmerId}` : fullName;
                })()}
              </Typography>
            </Box>

            <Stack direction="row" alignItems="center" spacing={1}>
              {canEdit && (
                <Button
                  color="primary"
                  variant="contained"
                  size="small"
                  onClick={() => handleEdit(detailFarmer)}
                >
                  {t('actions.edit')}
                </Button>
              )}
              {onCloseDetail && (
                <IconButton onClick={onCloseDetail}>
                  <Iconify icon={'mingcute:close-line' as any} />
                </IconButton>
              )}
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1 }}>
                {t('sections.identity')}
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Given Name"
                required
                label={t('fields.givenName')}
                value={f['Given Name']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Surname"
                required
                label={t('fields.surname')}
                value={f.Surname}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="NIN (National Identification Number)"
                required
                label={t('fields.nin')}
                value={f['NIN (National Identification Number)']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Farmer Code"
                label={t('fields.farmerCode')}
                value={f['Farmer Code']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Birth date"
                required
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
                resource="farmers"
                recordId={detailFarmer.id}
                name="Gender"
                required
                label={t('fields.gender')}
                value={f.Gender}
                type="select"
                options={['Male', 'Female']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <RecordAttachmentField
                endpoint={`/api/v1/farmers/${detailFarmer.id}`}
                name="Farmer ID (front back)"
                label={t('fields.farmerIdFrontBack')}
                value={f['Farmer ID (front back)']}
                storageFolder={`farmer-ids/${detailFarmer.id}`}
                onSaved={handleFieldSaved}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1 }}>
                {t('sections.contact')}
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Phone Number"
                required
                label={t('fields.phoneNumber')}
                value={f['Phone Number']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Mobile Money Number"
                required
                label={t('fields.mobileMoneyNumber')}
                value={f['Mobile Money Number']}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.verifiedMobileMoneyNumber')}
                value={f['Verified Mobile Money Number']}
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', px: 1 }}>
                {t('fields.verifiedMobileMoneyNote')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Email"
                label={t('fields.email')}
                value={f.Email}
                onSaved={handleFieldSaved}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1 }}>
                {t('sections.address')}
              </Typography>
            </Grid>

            {!isRecordIdLike(f.Address) && (
              <Grid size={{ xs: 12 }}>
                <DetailRow label={t('fields.address')} value={f.Address} />
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Address"
                label={t('fields.village')}
                value={Array.isArray(f.Address) ? f.Address[0] : ''}
                displayValue={
                  f['Village Name']?.[0] ??
                  f['Summary (from Address)']?.[0] ??
                  f.Village ??
                  parsedAddress.village ??
                  '—'
                }
                type="select"
                searchable
                required
                options={villages.map((v) => ({
                  value: v.id,
                  label: String(v.fields.Summary ?? v.fields['Village Name'] ?? v.id),
                }))}
                arrayValue
                helperText={t('fields.addressHelper')}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.parish')}
                value={f['Parish Name']?.[0] ?? f.Parish ?? parsedAddress.parish}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.subCounty')}
                value={f['Sub-County Name']?.[0] ?? f['Sub-county'] ?? parsedAddress.subCounty}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.district')}
                value={f['District Name']?.[0] ?? f['District (form)'] ?? parsedAddress.district}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('fields.region')}
                value={f['Region Name']?.[0] ?? f.Region ?? parsedAddress.region}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1 }}>
                {t('sections.membership')}
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Member since (date)"
                required
                label={t('fields.memberSince')}
                value={f['Member since (date)']}
                type="date"
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('fields.memberSinceYear')} value={f['Member since (year)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Main product sold to Partner"
                label={t('fields.mainCropSold')}
                value={cropId ?? ''}
                displayValue={cropName ?? '—'}
                type="select"
                searchable
                options={cropSelectOptions}
                arrayValue
                onSaved={handleFieldSaved}
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', px: 1 }}>
                {t('fields.mainCropSoldHelper')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Quantity sold last season A to Partner (units, kg, liter)"
                label={t('fields.volumeSeasonA')}
                value={f['Quantity sold last season A to Partner (units, kg, liter)']}
                type="number"
                helperText={t('fields.mainCropSoldHelper')}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="Quantity sold last season B to Partner (units, kg, liter)"
                label={t('fields.volumeSeasonB')}
                value={f['Quantity sold last season B to Partner (units, kg, liter)']}
                type="number"
                helperText={t('fields.mainCropSoldHelper')}
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <RecordAttachmentField
                endpoint={`/api/v1/farmers/${detailFarmer.id}`}
                name="Receipts of these sales to Coop"
                label={t('fields.salesReceipts')}
                value={f['Receipts of these sales to Coop']}
                storageFolder={`farmer-sales/${detailFarmer.id}`}
                onSaved={handleFieldSaved}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ color: 'primary.main', px: 1 }}>
                {t('sections.workers')}
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
                name="# seasonal/temporary workers hired & paid by farmer"
                label={t('fields.seasonalWorkers')}
                value={f['# seasonal/temporary workers hired & paid by farmer']}
                type="number"
                onSaved={handleFieldSaved}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InlineEditField
                resource="farmers"
                recordId={detailFarmer.id}
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
              // Display the record's identifying column value as it is in Airtable.
              const recordLabel = (value: any, fallback: string) =>
                String(value || '') || fallback;

              const orderLinks = farmerInputOrders.map((o) => ({
                id: o.id,
                label: recordLabel(o.fields['Order number'], o.id),
                href: makeLink('input-orders', o.id, 'inputOrderId'),
              }));
              const loanLinks = farmerLoans.map((l) => ({
                id: l.id,
                label: recordLabel(l.fields['Loan ID'], l.id),
                href: makeLink('loans', l.id, 'loanId'),
              }));
              const paymentLinks = farmerPayments.map((p) => ({
                id: p.id,
                label: recordLabel(p.fields['Payment ID'], p.id),
                href: makeLink('payments', p.id, 'paymentId'),
              }));
              const salesLinks = farmerSales.map((s) => ({
                id: s.id,
                label: recordLabel(
                  s.fields.Name || s.fields['Order #'] || fDate(s.fields['Date Received']),
                  s.id
                ),
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
        {canEdit && (
          <Button color="primary" variant="contained" startIcon={<Iconify icon={'solar:add-circle-bold' as any} />} onClick={handleAdd}>
            {t('page.addFarmer')}
          </Button>
        )}
      </Stack>

      {renderSummary()}

      <Grid container spacing={2} sx={{ height: { md: 'calc(100vh - 360px)' } }}>
        <Grid size={{ xs: 12, md: 4 }} sx={{ height: 1 }}>
          {renderList()}
        </Grid>

        {mdUp && (
          <Grid size={{ xs: 12, md: 8 }} sx={{ height: 1 }}>
            {renderDetail()}
          </Grid>
        )}
      </Grid>

      <FarmerFormDialog
        open={formOpen}
        farmer={editingFarmer}
        fpoId={activeFbo?.id}
        onClose={() => setFormOpen(false)}
        onSaved={handleFieldSaved}
      />

      <DetailDialog open={detailOpen && !mdUp} onClose={() => setDetailOpen(false)}>
        {renderDetail(() => setDetailOpen(false))}
      </DetailDialog>
    </DashboardContent>
  );
}
