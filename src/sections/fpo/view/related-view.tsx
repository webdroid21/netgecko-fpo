import type { Farmer } from 'src/sections/farmer/types';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { RouterLink } from 'src/routes/components/router-link';
import { useSearchParams } from 'src/routes/hooks/use-search-params';

import axios from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type FpoRelatedViewProps = {
  title: string;
};

export function FpoRelatedView({ title }: FpoRelatedViewProps) {
  const searchParams = useSearchParams();

  const farmerId = searchParams.get('farmerId');
  const fpoName = searchParams.get('fpoName');

  const [farmer, setFarmer] = useState<Farmer | null>(null);

  useEffect(() => {
    if (!farmerId) return;
    axios
      .get(`/api/v1/farmers/${farmerId}`)
      .then(({ data }) => setFarmer(data.record))
      .catch((error: any) => console.error('Fetch farmer error:', error?.message));
  }, [farmerId]);

  const backHref = useMemo(() => {
    const query = new URLSearchParams();
    if (farmerId) query.set('farmerId', farmerId);
    if (fpoName) query.set('fpoName', fpoName);
    const q = query.toString();
    return `/dashboard/farmers${q ? `?${q}` : ''}`;
  }, [farmerId, fpoName]);

  return (
    <DashboardContent maxWidth="xl">
      <Box sx={{ mb: 3 }}>
        <Button component={RouterLink} href={backHref} startIcon={<Iconify icon={'solar:alt-arrow-left-bold' as any} />}>
          Back to farmers
        </Button>
      </Box>

      <Typography variant="h4" sx={{ mb: 1 }}>
        {title}
      </Typography>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        {fpoName ? `FPO: ${fpoName}` : 'No FPO selected'}
        {farmer ? ` · Farmer: ${farmer.fields.Name || 'Unnamed'}` : ''}
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Coming soon
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This module will show {title.toLowerCase()} related to the selected farmer. Data will be
            loaded from the corresponding Airtable table filtered by the active FPO.
          </Typography>
        </CardContent>
      </Card>
    </DashboardContent>
  );
}
