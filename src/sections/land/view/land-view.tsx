import type { Land , Crop } from '../types';
import type { Farmer } from 'src/sections/farmer/types';

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

export function LandView() {
  const { activeFbo } = useAuthContext();
  const searchParams = useSearchParams();
  const farmerFilter = searchParams.get('farmerId');

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
    let list = [...lands];

    if (farmerFilter) {
      list = list.filter((l) => (l.fields.Farmer ?? []).includes(farmerFilter));
    }

    const term = search.trim().toLowerCase();
    if (!term) return list;

    return list.filter((l) => {
      const landName = String(l.fields.Land || '').toLowerCase();
      const cropName = String((l.fields['Crop Name (from Crop)'] || []).join(' ')).toLowerCase();
      const owner = String((l.fields['Name (from Owner)'] || []).join(' ')).toLowerCase();
      return landName.includes(term) || cropName.includes(term) || owner.includes(term);
    });
  }, [lands, farmerFilter, search]);

  const selectedLand = useMemo(
    () => lands.find((l) => l.id === selectedId) || filteredLands[0] || null,
    [lands, filteredLands, selectedId]
  );

  const stats = useMemo(() => {
    const total = filteredLands.length;
    const acres = filteredLands.reduce((sum, l) => sum + (Number(l.fields['Land Size (Acres)']) || 0), 0);
    const seasonA = filteredLands.reduce(
      (sum, l) => sum + (Number(l.fields['Crop 1 Estimated Harvest (KG) Season A']) || 0),
      0
    );
    const seasonB = filteredLands.reduce(
      (sum, l) => sum + (Number(l.fields['Crop 1 Estimated Harvest (KG) Season B']) || 0),
      0
    );
    return { total, acres, seasonA, seasonB };
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
    if (!confirm(`Delete ${land.fields.Land ?? 'this land'}?`)) return;
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
          title="Total parcels"
          total={stats.total}
          subtext="Land parcels registered"
          color="success"
          icon="solar:map-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title="Total acres"
          total={stats.acres}
          subtext="Combined land size"
          color="primary"
          icon="solar:ruler-angular-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title="Season A harvest"
          total={stats.seasonA}
          subtext="KG (main crop)"
          color="warning"
          icon="solar:chart-square-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title="Season B harvest"
          total={stats.seasonB}
          subtext="KG (main crop)"
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
          placeholder="Search parcels or crops..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Iconify icon={'solar:magnifer-bold-duotone' as any} sx={{ mr: 1, color: 'text.disabled' }} />,
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>Loading…</Box>
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
                      primary={land.fields.Land || 'Unnamed land'}
                      primaryTypographyProps={{ variant: 'subtitle2' }}
                    />
                    {land.fields['Land Ownership'] && (
                      <Label
                        color={land.fields['Land Ownership'] === 'Owned' ? 'success' : 'warning'}
                      >
                        {land.fields['Land Ownership']}
                      </Label>
                    )}
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {(land.fields['Name (from Owner)'] || []).join(', ')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {(land.fields['Crop Name (from Crop)'] || []).join(', ')} · {land.fields['Land Size (Acres)']} acres
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
            Select a parcel to view details
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
              <Typography variant="h5">{f.Land || 'Unnamed land'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {(f['Name (from Owner)'] || []).join(', ')}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleEdit(selectedLand)}>
                Edit
              </Button>
              <IconButton color="error" onClick={() => handleDelete(selectedLand)}>
                <Iconify icon={'solar:trash-bin-trash-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Farmer" value={(f['Name (from Owner)'] || []).join(', ')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Land Ownership" value={f['Land Ownership']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Land Size (Acres)" value={f['Land Size (Acres)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Latitude" value={f.Latitude} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Longitude" value={f.Longitude} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Main Crop" value={(f['Crop Name (from Crop)'] || []).join(', ')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Number of plants (Crop 1)" value={f['Number of plants (Crop 1)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Crop 1 Estimated Harvest (KG) Season A" value={f['Crop 1 Estimated Harvest (KG) Season A']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Crop 1 Estimated Harvest (KG) Season B" value={f['Crop 1 Estimated Harvest (KG) Season B']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Other crop" value={(f['Crop 2 Name (from Other crop (2))'] || []).join(', ') || (f['Other crop (2)']?.join(', '))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Number of plants (Crop 2)" value={f['Number of plants (Crop 2)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Crop 2 Estimated Harvest (KG) Season A" value={f['Crop 2 Estimated Harvest (KG) Season A']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Crop 2 Estimated Harvest (KG) Season B" value={f['Crop 2 Estimated Harvest (KG) Season B']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Estimated harvest Season A" value={f['Estimated harvest Season A']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Estimated harvest Season B" value={f['Estimated harvest Season B']} />
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
          <Typography variant="h4">Land Management</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {stats.total} parcels · {fNumber(stats.acres)} total acres
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
          onClick={handleAdd}
        >
          Add Parcel
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
