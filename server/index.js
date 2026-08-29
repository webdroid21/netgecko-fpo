require('dotenv').config();

const cors = require('cors');
const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');

// ----------------------------------------------------------------------

const PORT = process.env.PORT || 5001;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_USERS_TABLE_ID = process.env.AIRTABLE_USERS_TABLE_ID;
const AIRTABLE_FARMERS_TABLE_ID =
  process.env.AIRTABLE_FARMERS_TABLE_ID || 'tblQkW4jmj1BDsByN';
const AIRTABLE_LANDS_TABLE_ID =
  process.env.AIRTABLE_LANDS_TABLE_ID || 'tblBm9ogzVK08cje4';
const AIRTABLE_CROPS_TABLE_ID = process.env.AIRTABLE_CROPS_TABLE_ID || 'Crops';

// ----------------------------------------------------------------------

function initFirebase() {
  if (admin.apps.length) return;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return;
  }

  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    return;
  }

  throw new Error(
    'Missing Firebase admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PRIVATE_KEY+FIREBASE_CLIENT_EMAIL.'
  );
}

initFirebase();

// ----------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());

// ----------------------------------------------------------------------

const airtableApi = axios.create({
  baseURL: `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`,
  headers: {
    Authorization: `Bearer ${AIRTABLE_PAT}`,
    'Content-Type': 'application/json',
  },
});

function toE164(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length >= 10) {
    return '+256' + digits.slice(1);
  }
  if (digits.startsWith('256')) {
    return '+' + digits;
  }
  if (digits.startsWith('+')) return raw;
  if (digits.length === 9) return '+256' + digits;
  return '+' + digits;
}

function buildFilterFormula(email, phone) {
  const parts = [];
  if (email) parts.push(`{email}='${email.replace(/'/g, "''")}'`);
  if (phone) parts.push(`{Phone}='${phone.replace(/'/g, "''")}'`);
  return `OR(${parts.join(',')})`;
}

async function updateLoginMeta(recordId, firebaseUid) {
  const payload = {
    records: [
      {
        id: recordId,
        fields: {
          FirebaseUID: firebaseUid,
          LastLogin: new Date().toISOString(),
        },
      },
    ],
  };

  try {
    await airtableApi.patch(`/${AIRTABLE_USERS_TABLE_ID}`, payload);
  } catch (error) {
    console.warn('Airtable LastLogin/FirebaseUID update skipped:', error?.response?.data?.error || error.message);
  }
}

// ----------------------------------------------------------------------

app.post('/api/v1/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Firebase ID token.' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const email = decoded.email || null;
    const phone = decoded.phone_number ? toE164(decoded.phone_number) : null;

    if (!email && !phone) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'Your account is not registered or active. Please contact system admin.',
      });
    }

    const formula = buildFilterFormula(email, phone);
    const listUrl = `/${AIRTABLE_USERS_TABLE_ID}/listRecords`;
    const { data } = await airtableApi.post(listUrl, {
      filterByFormula: formula,
      maxRecords: 1,
      returnFieldsByFieldId: false,
    });

    const record = data.records?.[0];

    if (!record || !record.fields?.Active) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'Your account is not registered or active. Please contact system admin.',
      });
    }

    const fields = record.fields;
    const fpoIds = Array.isArray(fields.FPO) ? fields.FPO : [];
    const fpoNames = Array.isArray(fields['Name (from FPO)']) ? fields['Name (from FPO)'] : [];

    const fbos = fpoIds.map((id, index) => ({
      id,
      name: fpoNames[index] || id,
    }));

    await updateLoginMeta(record.id, decoded.uid);

    return res.status(200).json({
      user: {
        id: record.id,
        name: fields.Name || '',
        email: fields.email || email || '',
        phone: fields.Phone || phone || '',
        role: fields.Role || '',
        fbos,
      },
    });
  } catch (error) {
    console.error('/api/v1/auth/verify error:', error);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'INTERNAL_ERROR',
      message: error.message || 'Unable to verify access.',
    });
  }
});

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Firebase ID token.' });
  }

  try {
    req.user = await admin.auth().verifyIdToken(token);
    return next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token.' });
  }
}

function buildFpoFilter(fpoName) {
  const escaped = fpoName.replace(/'/g, "''");
  return `SEARCH('${escaped}', ARRAYJOIN({Name (from FPO)}, ',')) > 0`;
}

function toAirtableFields(input, fpoId) {
  const fields = { ...input };

  // Link fields expect arrays of record IDs.
  if (fields['Main crop sold to Cooperative'] && typeof fields['Main crop sold to Cooperative'] === 'string') {
    fields['Main crop sold to Cooperative'] = [fields['Main crop sold to Cooperative']];
  }

  if (fpoId) {
    fields.FPO = [fpoId];
  }

  return fields;
}

function buildLandsFilter(fpoId) {
  const escaped = fpoId.replace(/'/g, "''");
  return `FIND('${escaped}', ARRAYJOIN({FPO from farmers}, ',')) > 0`;
}

function toLandsFields(input) {
  const fields = { ...input };

  [
    'Farmer',
    'Main Crop (1)',
    'Other crop (2)',
  ].forEach((key) => {
    if (fields[key] && typeof fields[key] === 'string') {
      fields[key] = [fields[key]];
    }
  });

  return fields;
}

// ----------------------------------------------------------------------

app.get('/api/v1/farmers', requireAuth, async (req, res) => {
  try {
    const { fpoId, fpoName } = req.query;

    if (!fpoId && !fpoName) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId or fpoName is required.' });
    }

    const { data } = await airtableApi.post(`/${AIRTABLE_FARMERS_TABLE_ID}/listRecords`, {
      filterByFormula: buildFpoFilter(fpoName || fpoId),
      maxRecords: 100,
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/farmers error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch farmers.',
    });
  }
});

app.get('/api/v1/farmers/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.get(`/${AIRTABLE_FARMERS_TABLE_ID}/${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/farmers/:id error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch farmer.',
    });
  }
});

app.post('/api/v1/farmers', requireAuth, async (req, res) => {
  try {
    const { fpoId, fields } = req.body;

    if (!fpoId || !fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId and fields are required.' });
    }

    const payload = {
      records: [{ fields: toAirtableFields(fields, fpoId) }],
      typecast: true,
    };

    const { data } = await airtableApi.post(`/${AIRTABLE_FARMERS_TABLE_ID}`, payload);
    return res.status(201).json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/farmers POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create farmer.',
    });
  }
});

app.patch('/api/v1/farmers/:id', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ id: req.params.id, fields: toAirtableFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.patch(`/${AIRTABLE_FARMERS_TABLE_ID}`, payload);
    return res.json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/farmers PATCH error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update farmer.',
    });
  }
});

app.delete('/api/v1/farmers/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.delete(`/${AIRTABLE_FARMERS_TABLE_ID}?records[]=${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/farmers DELETE error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to delete farmer.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/crops', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.post(`/${AIRTABLE_CROPS_TABLE_ID}/listRecords`, {
      maxRecords: 1000,
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/crops error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch crops.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/lands', requireAuth, async (req, res) => {
  try {
    const { fpoId } = req.query;

    if (!fpoId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId is required.' });
    }

    const { data } = await airtableApi.post(`/${AIRTABLE_LANDS_TABLE_ID}/listRecords`, {
      filterByFormula: buildLandsFilter(fpoId),
      maxRecords: 100,
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/lands error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch lands.',
    });
  }
});

app.get('/api/v1/lands/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.get(`/${AIRTABLE_LANDS_TABLE_ID}/${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/lands/:id error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch land.',
    });
  }
});

app.post('/api/v1/lands', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ fields: toLandsFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.post(`/${AIRTABLE_LANDS_TABLE_ID}`, payload);
    return res.status(201).json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/lands POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create land.',
    });
  }
});

app.patch('/api/v1/lands/:id', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ id: req.params.id, fields: toLandsFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.patch(`/${AIRTABLE_LANDS_TABLE_ID}`, payload);
    return res.json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/lands PATCH error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update land.',
    });
  }
});

app.delete('/api/v1/lands/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.delete(`/${AIRTABLE_LANDS_TABLE_ID}?records[]=${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/lands DELETE error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to delete land.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`FPO app server running on http://localhost:${PORT}`);
});
