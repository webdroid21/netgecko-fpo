import type { Farmer } from '../types';

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

import { fNumber } from 'src/utils/format-number';

import axios from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { FarmerFormDialog } from '../components/farmer-form-dialog';

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
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{value ?? '—'}</Typography>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function FarmerView() {
  const { activeFbo } = useAuthContext();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);

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

  const stats = useMemo(() => {
    const total = farmers.length;
    const active = farmers.filter((f) => f.fields.Checked === true).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [farmers]);

  const handleAdd = () => {
    setEditingFarmer(null);
    setFormOpen(true);
  };

  const handleEdit = (farmer: Farmer) => {
    setEditingFarmer(farmer);
    setFormOpen(true);
  };

  const handleDelete = async (farmer: Farmer) => {
     
    if (!confirm(`Delete ${farmer.fields.Name ?? 'this farmer'}?`)) return;
    try {
      await axios.delete(`/api/v1/farmers/${farmer.id}`);
      fetchFarmers();
    } catch (error: any) {
      console.error('Delete farmer error:', error?.message);
    }
  };

  const renderSummary = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title="Total members"
          total={stats.total}
          subtext="Total registered farmers"
          color="primary"
          icon="solar:users-group-rounded-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title="Active farmers"
          total={stats.active}
          subtext="60% active"
          color="success"
          icon="solar:user-check-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title="Pending approval"
          total={0}
          subtext="Review and activate"
          color="warning"
          icon="solar:user-id-bold-duotone"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <SummaryCard
          title="Inactive"
          total={stats.inactive}
          subtext="Non-participating members"
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
          placeholder="Search farmers..."
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
                      primary={farmer.fields.Name || 'Unnamed'}
                      primaryTypographyProps={{ variant: 'subtitle2' }}
                    />
                    {gender && (
                      <Label color={gender === 'Female' ? 'success' : 'info'}>
                        {gender}
                      </Label>
                    )}
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {farmer.fields['NIN (National Identification Number)']}
                  </Typography>
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
            Select a farmer to view details
          </Typography>
        </Card>
      );
    }

    const f = selectedFarmer.fields;

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
              <Typography variant="h5">{f.Name || 'Unnamed'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {f['NIN (National Identification Number)']}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleEdit(selectedFarmer)}>
                Edit
              </Button>
              <IconButton color="error" onClick={() => handleDelete(selectedFarmer)}>
                <Iconify icon={'solar:trash-bin-trash-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Given Name" value={f['Given Name']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Surname" value={f.Surname} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Gender" value={f.Gender} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Birth date" value={f['Birth date']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Age" value={f.Age} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Phone Number" value={f['Phone Number']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Mobile Money Number" value={f['Mobile Money Number']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Email" value={f.Email} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Village" value={f.Village} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Parish" value={f.Parish} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Sub-county" value={f['Sub-county']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="District" value={f['District (form)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Region" value={f['Region Name']?.[0] ?? f.Region} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Member since" value={f['Member since (date)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Member since (year)" value={f['Member since (year)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label="Main crop sold to Cooperative"
                value={f['Crop Name (from Main crop sold to Cooperative)']?.[0] ??
                  f['Main crop sold to Cooperative']?.[0] ??
                  f['Main crop sold to Cooperative']}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="Volume sold last season A (kg)" value={f['Volume sold last season A to Cooperative (kg)']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label="Volume sold last season B (kg)"
                value={f['Volume sold last season B to Cooperative (kg) copy']}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow
                label="# seasonal/temporary workers"
                value={f['# seasonal/temporary workers hired & paid by farmer']}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="# permanent workers" value={f['# permanent workers hired & paid by farmer']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="# Lands" value={f['# Lands']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="# Input Orders" value={f['# Input Orders']} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailRow label="# Loans" value={f['# Loans']} />
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
          <Typography variant="h4">Farmers</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Manage cooperative members
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Iconify icon={'solar:add-circle-bold' as any} />} onClick={handleAdd}>
          Add Farmer
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
        onSaved={fetchFarmers}
      />
    </DashboardContent>
  );
}
