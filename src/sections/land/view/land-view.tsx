import type { Land , Crop } from '../types';
import type { Farmer } from 'src/sections/farmer/types';

import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react';

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

import { LandFormDialog } from '../components/land-form-dialog';

// ----------------------------------------------------------------------

function SummaryCard({
  title,
  total,
  subtext,
  color,
  icon,
}: {
  title: string;
  total: ReactNode;
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
          <Typography variant="h4" sx={{ my: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {typeof total === 'number' ? fNumber(total) : total}
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

function getProductNames(land?: Land): string[] {
  if (!land) return [];
  const names =
    land.fields['Product Name (from Product)'] ||
    land.fields['Crop Name (from Crop)'] ||
    [];
  return (Array.isArray(names) ? names : [names]).filter(Boolean) as string[];
}

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
      <Typography
        variant="body1"
        sx={href ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}
      >
        {value ?? '—'}
      </Typography>
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

export function LandView() {
  const { activeFbo } = useAuthContext();
  const { t } = useTranslate('lands');
  const { t: tCommon } = useTranslate('common');
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');
  const landId = searchParams.get('landId');

  const [lands, setLands] = useState<Land[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingLand, setEditingLand] = useState<Land | null>(null);

  const fetchLands = useCallback(async () => {
    if (!activeFbo) return;
    setLoading(true);
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
    fetchLands();
    fetchFarmers();
    fetchCrops();
  }, [fetchLands, fetchFarmers, fetchCrops]);

  const filteredLands = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = lands;

    if (farmerFilter) {
      list = list.filter((l) => {
        const farmer = l.fields.Farmer;
        return Array.isArray(farmer) ? farmer.includes(farmerFilter) : farmer === farmerFilter;
      });
    }

    if (!term) return list;

    return list.filter((l) => {
      const landName = String(l.fields.Land || '').toLowerCase();
      const productName = String(getProductNames(l).join(' ')).toLowerCase();
      const owner = String((l.fields['Name (from Owner)'] || []).join(' ')).toLowerCase();
      return landName.includes(term) || productName.includes(term) || owner.includes(term);
    });
  }, [lands, search, farmerFilter]);

  const selectedLand = useMemo(
    () => filteredLands.find((l) => l.id === selectedId) || filteredLands[0] || null,
    [filteredLands, selectedId]
  );

  useEffect(() => {
    if (landId && filteredLands.some((l) => l.id === landId)) {
      setSelectedId(landId);
      return;
    }
    if (selectedId || !filteredLands.length) return;
    setSelectedId(filteredLands[0]?.id);
  }, [filteredLands, selectedId, landId]);

  const stats = useMemo(() => {
    const total = filteredLands.length;
    const acres = filteredLands.reduce((sum, l) => sum + (Number(l.fields['Land Size (Acres)']) || 0), 0);
    const owned = filteredLands.filter((l) => l.fields['Land Ownership'] === 'Owned').length;
    const rented = filteredLands.filter((l) => l.fields['Land Ownership'] === 'Rented').length;

    const productCounts: Record<string, number> = {};
    filteredLands.forEach((l) => {
      const names = getProductNames(l);
      names.forEach((name) => {
        if (!name) return;
        productCounts[name] = (productCounts[name] || 0) + 1;
      });
    });
    const mainProduct =
      Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    return { total, acres, owned, rented, mainProduct };
  }, [filteredLands]);

  const handleAdd = () => {
    setEditingLand(null);
    setFormOpen(true);
  };

  const handleEdit = (land: Land) => {
    setEditingLand(land);
    setFormOpen(true);
  };

  const handleDelete = async (land: Land) => {
    const name = land.fields.Land ?? t('unnamedLand');
    if (!confirm(t('confirmDeleteLand', { name }))) return;
    try {
      await axios.delete(`/api/v1/lands/${land.id}`);
      fetchLands();
    } catch (error: any) {
      console.error('Delete land error:', error?.message);
    }
  };

  const handleFarmerCreated = (farmer: Farmer) => {
    setFarmers((prev) => [...prev, farmer]);
  };

  const renderSummary = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.totalLands.title')}
          total={stats.total}
          subtext={t('summary.totalLands.subtext')}
          color="success"
          icon="solar:map-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.totalAcres.title')}
          total={stats.acres}
          subtext={t('summary.totalAcres.subtext')}
          color="primary"
          icon="solar:ruler-angular-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.landOwned.title')}
          total={stats.owned}
          subtext={t('summary.landOwned.subtext', { count: stats.rented })}
          color="warning"
          icon="solar:chart-square-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title={t('summary.mainProduct.title')}
          total={stats.mainProduct}
          subtext={t('summary.mainProduct.subtext')}
          color="info"
          icon="solar:chart-2-bold-duotone"
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
            {filteredLands.map((land) => {
              const isSelected = land.id === selectedLand?.id;

              return (
                <ListItemButton
                  key={land.id}
                  selected={isSelected}
                  onClick={() => setSelectedId(land.id)}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 1, mb: 0.5 }}>
                    <ListItemText
                      primary={land.fields.Land || t('unnamedLand')}
                      primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    />
                    {land.fields['Land Ownership'] && (
                      <Label
                        color={land.fields['Land Ownership'] === 'Owned' ? 'success' : 'warning'}
                      >
                        {land.fields['Land Ownership']}
                      </Label>
                    )}
                    <Iconify icon={'solar:arrow-right-up-bold' as any} width={18} sx={{ ml: 'auto', flexShrink: 0, color: 'text.disabled' }} />
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {(land.fields['Name (from Owner)'] || []).join(', ')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {getProductNames(land).join(', ') || t('noProduct')} · {land.fields['Land Size (Acres)']} acres
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
    if (!selectedLand) {
      return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('emptyDetail')}
          </Typography>
        </Card>
      );
    }

    const f = selectedLand.fields;

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
              <Typography variant="h5">{f.Land || t('unnamedLand')}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {(f['Name (from Owner)'] || []).join(', ')}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleEdit(selectedLand)}>
                {t('actions.edit')}
              </Button>
              <IconButton color="error" onClick={() => handleDelete(selectedLand)}>
                <Iconify icon={'solar:trash-bin-trash-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('lands:fields.farmer')}
                value={(f['Name (from Owner)'] || []).join(', ')}
                href={
                  f.Farmer?.[0]
                    ? `/dashboard/farmers?farmerId=${f.Farmer[0]}&fpoName=${encodeURIComponent(activeFbo?.name ?? '')}`
                    : undefined
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.landOwnership')} value={f['Land Ownership']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.landSize')} value={f['Land Size (Acres)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.latitude')} value={f.Latitude} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.longitude')} value={f.Longitude} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.mainProduct')} value={getProductNames(selectedLand).join(', ')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.numPlantsProduct1')} value={f['Number of plants (Product 1)'] ?? f['Number of plants (Crop 1)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('lands:fields.product1HarvestSeasonA')}
                value={f['Product 1 Estimated Harvest (KG) Season A'] ?? f['Crop 1 Estimated Harvest (KG) Season A']}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('lands:fields.product1HarvestSeasonB')}
                value={f['Product 1 Estimated Harvest (KG) Season B'] ?? f['Crop 1 Estimated Harvest (KG) Season B']}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('lands:fields.otherProduct')}
                value={
                  (f['Product 2 Name (from Other product (2))'] || f['Crop 2 Name (from Other crop (2))'] || []).join(', ') ||
                  (f['Other product (2)']?.join(', ') || f['Other crop (2)']?.join(', '))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.numPlantsProduct2')} value={f['Number of plants (Product 2)'] ?? f['Number of plants (Crop 2)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('lands:fields.product2HarvestSeasonA')}
                value={f['Product 2 Estimated Harvest (KG) Season A'] ?? f['Crop 2 Estimated Harvest (KG) Season A']}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label={t('lands:fields.crop2HarvestSeasonB')}
                value={f['Crop 2 Estimated Harvest (KG) Season B']}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.estimatedHarvestSeasonA')} value={f['Estimated harvest Season A']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label={t('lands:fields.estimatedHarvestSeasonB')} value={f['Estimated harvest Season B']} />
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
        <Button
          color="primary"
          variant="contained"
          startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
          onClick={handleAdd}
        >
          {t('page.addParcel')}
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

      <LandFormDialog
        open={formOpen}
        land={editingLand}
        fpoId={activeFbo?.id}
        farmers={farmers}
        crops={crops}
        onClose={() => setFormOpen(false)}
        onSaved={fetchLands}
        onFarmerCreated={handleFarmerCreated}
      />
    </DashboardContent>
  );
}
