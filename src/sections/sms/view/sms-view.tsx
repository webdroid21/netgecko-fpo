import { useTabs } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fDate, fDateTime } from 'src/utils/format-time';

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

type SmsConfig = {
  enabled: boolean;
  mode: 'test' | 'live';
  testPhone: string;
};

type ScheduleDay = {
  date: string;
  planned: number;
  skipped: number;
  messages: SmsPlanItem[];
};

type RunResult = {
  today: string;
  disabled: boolean;
  enabled: boolean;
  mode: 'test' | 'live';
  loansEvaluated: number;
  planned: number;
  sent: number;
  skipped: { loan: string; rule: string; reason: string }[];
  errors: { loan?: string; rule?: string; to?: string; error: string }[];
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

function PlanTable({ messages }: { messages: SmsPlanItem[] }) {
  const { t } = useTranslate('sms');
  return (
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
          {messages.map((m, i) => (
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
  );
}

// ----------------------------------------------------------------------

export function SmsView() {
  const { t } = useTranslate('sms');
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'NetGecko Admin';
  const tabs = useTabs('settings');

  const [config, setConfig] = useState<SmsConfig>({ enabled: false, mode: 'test', testPhone: '' });
  const [rules, setRules] = useState<SmsRule[]>([]);
  const [log, setLog] = useState<SmsLogEntry[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, logRes, configRes, scheduleRes] = await Promise.all([
        axios.get('/api/v1/sms/rules'),
        axios.get('/api/v1/sms/log'),
        axios.get('/api/v1/sms/config'),
        axios.get('/api/v1/sms/schedule?days=4'),
      ]);
      setRules(rulesRes.data.rules || []);
      setLog(logRes.data.entries || []);
      setConfig(configRes.data.config);
      setSchedule(scheduleRes.data.schedule || []);
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

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const { data } = await axios.post('/api/v1/sms/config', config);
      setConfig(data.config);
      toast.success(t('configSaved'));
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const { data } = await axios.post('/api/v1/sms/run', { dry: false });
      setLastRun(data);
      if (data.disabled) {
        toast.warning(t('disabledRun'));
      } else if (data.mode === 'test') {
        toast.success(t('sentTestSummary', { sent: data.sent, errors: data.errors.length }));
      } else {
        toast.success(t('sentSummary', { sent: data.sent, errors: data.errors.length }));
      }
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

  const modeColor = !config.enabled ? 'default' : config.mode === 'live' ? 'error' : 'warning';

  return (
    <DashboardContent>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">{t('title')}</Typography>
        <Chip
          size="small"
          color={modeColor}
          label={
            !config.enabled
              ? t('statusDisabled')
              : config.mode === 'live'
                ? t('statusLive')
                : t('statusTest')
          }
        />
      </Stack>

      <Tabs
        value={tabs.value}
        onChange={tabs.onChange}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="settings" label={t('tabSettings')} />
        <Tab value="queue" label={t('tabQueue')} />
        <Tab value="rules" label={t('tabRules')} />
        <Tab value="log" label={t('tabLog')} />
      </Tabs>

      {tabs.value === 'settings' && (
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {t('settingsTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settingsDescription')}
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enabled}
                    onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
                  />
                }
                label={t('enabledLabel')}
              />

              <ToggleButtonGroup
                size="small"
                exclusive
                value={config.mode}
                onChange={(_, v) => v && setConfig((c) => ({ ...c, mode: v }))}
              >
                <ToggleButton value="test">{t('modeTest')}</ToggleButton>
                <ToggleButton value="live">{t('modeLive')}</ToggleButton>
              </ToggleButtonGroup>

              {config.mode === 'test' && (
                <TextField
                  size="small"
                  label={t('testPhoneLabel')}
                  value={config.testPhone}
                  onChange={(e) => setConfig((c) => ({ ...c, testPhone: e.target.value }))}
                  placeholder="+2567…"
                  sx={{ minWidth: 220 }}
                />
              )}

              <LoadingButton
                variant="contained"
                loading={saving}
                onClick={handleSaveConfig}
                startIcon={<Iconify icon="solar:check-circle-bold" />}
              >
                {t('save')}
              </LoadingButton>
            </Stack>

            {!config.enabled && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('disabledInfo')}
              </Alert>
            )}
            {config.enabled && config.mode === 'live' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {t('liveWarning')}
              </Alert>
            )}
            {config.enabled && config.mode === 'test' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {config.testPhone
                  ? t('testInfoPhone', { phone: config.testPhone })
                  : t('testInfoNoPhone')}
              </Alert>
            )}
          </CardContent>
        </Card>

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
              <LoadingButton
                variant="contained"
                color="primary"
                loading={sending}
                onClick={() => setConfirmOpen(true)}
                startIcon={<Iconify icon="solar:letter-bold" />}
                sx={{ flexShrink: 0 }}
              >
                {t('sendNow')}
              </LoadingButton>
            </Stack>

            {lastRun && (
              <Alert
                severity={
                  lastRun.disabled ? 'info' : lastRun.errors.length ? 'warning' : 'success'
                }
                sx={{ mt: 2 }}
                icon={<Iconify icon="solar:check-circle-bold" />}
              >
                {lastRun.disabled
                  ? t('disabledRun')
                  : t('lastRun', {
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
      </Stack>
      )}

      {tabs.value === 'queue' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {t('scheduleTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('scheduleDescription')}
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
                {schedule.map((day, i) => (
                  <Box key={day.date}>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                      <Typography variant="subtitle2">
                        {i === 0 ? t('todayLabel') : fDate(day.date)}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('plannedCount', { count: day.planned })}
                        color={day.planned ? 'primary' : 'default'}
                      />
                    </Stack>
                    {day.planned === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                        {t('nothingPlanned')}
                      </Typography>
                    ) : (
                      <PlanTable messages={day.messages} />
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {tabs.value === 'rules' && (
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
      )}

      {tabs.value === 'log' && (
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
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('confirmTitle')}
        content={
          !config.enabled
            ? t('confirmDisabled')
            : config.mode === 'test'
              ? t('confirmTest', { phone: config.testPhone || '—' })
              : t('confirmContent')
        }
        action={
          <Button variant="contained" color="primary" onClick={handleSend}>
            {t('sendNow')}
          </Button>
        }
      />
    </DashboardContent>
  );
}
