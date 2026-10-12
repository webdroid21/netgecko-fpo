import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import axios from 'src/lib/axios';
import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type SmsRule = {
  id: string;
  name: string;
  smsIndex: number;
  triggerWhat: string;
  triggerWhen: string;
  loanTypes: string[];
  message: string;
  fieldSpecs: string[];
};

type SmsLogEntry = {
  loanId: string;
  loanRef: string;
  farmer: string;
  phone: string;
  smsIndex: number;
  message: string;
  sentAt: string;
};

type SmsPlanItem = {
  loan: string;
  loanRef: string;
  farmer: string;
  rule: string;
  smsIndex: number;
  to: string;
  message: string;
};

type RunResult = {
  today: string;
  loansEvaluated: number;
  planned: number;
  sent: number;
  skipped: { loan: string; rule: string; reason: string }[];
  errors: { loan?: string; rule?: string; to?: string; error: string }[];
  messages?: SmsPlanItem[];
};

// ----------------------------------------------------------------------

function MessageCell({ message }: { message: string }) {
  return (
    <TableCell sx={{ maxWidth: 420 }}>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
        {message}
      </Typography>
    </TableCell>
  );
}

// ----------------------------------------------------------------------

export function SmsView() {
  const { t } = useTranslate('sms');
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'NetGecko Admin';

  const [rules, setRules] = useState<SmsRule[]>([]);
  const [log, setLog] = useState<SmsLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<RunResult | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, logRes] = await Promise.all([
        axios.get('/api/v1/sms/rules'),
        axios.get('/api/v1/sms/log'),
      ]);
      setRules(rulesRes.data.rules || []);
      setLog(logRes.data.entries || []);
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { data } = await axios.post('/api/v1/sms/run', { dry: true });
      setPreview(data);
      if (!data.planned) toast.info(t('nothingPlanned'));
    } catch {
      toast.error(t('runError'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const { data } = await axios.post('/api/v1/sms/run', { dry: false });
      setLastRun(data);
      setPreview(null);
      toast.success(t('sentSummary', { sent: data.sent, errors: data.errors.length }));
      load();
    } catch {
      toast.error(t('runError'));
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardContent>
        <EmptyContent filled title={t('adminsOnly')} sx={{ py: 10 }} />
      </DashboardContent>
    );
  }

  return (
    <DashboardContent>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('title')}
      </Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ md: 'center' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h6">{t('jobTitle')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('jobDescription')}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
                <LoadingButton
                  variant="outlined"
                  loading={previewing}
                  onClick={handlePreview}
                  startIcon={<Iconify icon="solar:eye-bold" />}
                >
                  {t('previewToday')}
                </LoadingButton>
                <LoadingButton
                  variant="contained"
                  color="primary"
                  loading={sending}
                  onClick={() => setConfirmOpen(true)}
                  startIcon={<Iconify icon="solar:letter-bold" />}
                >
                  {t('sendNow')}
                </LoadingButton>
              </Stack>
            </Stack>

            {lastRun && (
              <Alert
                severity={lastRun.errors.length ? 'warning' : 'success'}
                sx={{ mt: 2 }}
                icon={<Iconify icon="solar:check-circle-bold" />}
              >
                {t('lastRun', {
                  sent: lastRun.sent,
                  skipped: lastRun.skipped.length,
                  errors: lastRun.errors.length,
                })}
                {lastRun.errors.length > 0 && (
                  <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                    {lastRun.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>
                        {e.rule || e.loan}: {e.error}
                      </li>
                    ))}
                  </Box>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {t('previewTitle', { date: preview.today })}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('previewSummary', { planned: preview.planned, loans: preview.loansEvaluated })}
              </Typography>
              {preview.planned === 0 ? (
                <Alert severity="info">{t('nothingPlanned')}</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('colRule')}</TableCell>
                        <TableCell>{t('colFarmer')}</TableCell>
                        <TableCell>{t('colPhone')}</TableCell>
                        <TableCell>{t('colMessage')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(preview.messages || []).map((m, i) => (
                        <TableRow key={i} hover>
                          <TableCell>
                            <Chip size="small" label={m.rule} />
                          </TableCell>
                          <TableCell>{m.farmer || m.loanRef || '—'}</TableCell>
                          <TableCell>{m.to}</TableCell>
                          <MessageCell message={m.message} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {t('rulesTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('rulesDescription')}
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('colRule')}</TableCell>
                      <TableCell>{t('colLoanType')}</TableCell>
                      <TableCell>{t('colTrigger')}</TableCell>
                      <TableCell>{t('colMessage')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Chip size="small" variant="outlined" label={r.name} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {r.loanTypes.length
                              ? r.loanTypes.map((lt) => (
                                  <Chip key={lt} size="small" label={lt} color="info" variant="soft" />
                                ))
                              : '—'}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ minWidth: 180 }}>
                          <Typography variant="body2">{r.triggerWhat}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {r.triggerWhen}
                          </Typography>
                        </TableCell>
                        <MessageCell message={r.message} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {t('logTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('logDescription')}
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : log.length === 0 ? (
              <Alert severity="info">{t('noSendsYet')}</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('colDate')}</TableCell>
                      <TableCell>{t('colRule')}</TableCell>
                      <TableCell>{t('colFarmer')}</TableCell>
                      <TableCell>{t('colPhone')}</TableCell>
                      <TableCell>{t('colMessage')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {log.map((e) => (
                      <TableRow key={`${e.loanId}-${e.smsIndex}`} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(e.sentAt)}</TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined" label={`SMS ${e.smsIndex}`} />
                        </TableCell>
                        <TableCell>{e.farmer || e.loanRef || '—'}</TableCell>
                        <TableCell>{e.phone || '—'}</TableCell>
                        <MessageCell message={e.message} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('confirmTitle')}
        content={t('confirmContent')}
        action={
          <Button variant="contained" color="primary" onClick={handleSend}>
            {t('sendNow')}
          </Button>
        }
      />
    </DashboardContent>
  );
}
