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
const AIRTABLE_ORDERS_TABLE_ID =
  process.env.AIRTABLE_ORDERS_TABLE_ID || 'tblq9p8G9oreglq2l';
const AIRTABLE_PRODUCTS_TABLE_ID =
  process.env.AIRTABLE_PRODUCTS_TABLE_ID || 'tblupJLRoF4OZsi8Q';
const AIRTABLE_SEASONS_TABLE_ID = process.env.AIRTABLE_SEASONS_TABLE_ID || 'Seasons';
const AIRTABLE_LOANS_TABLE_ID =
  process.env.AIRTABLE_LOANS_TABLE_ID || 'tblXqXRcHSoRC94vA';
const AIRTABLE_PAYMENTS_TABLE_ID =
  process.env.AIRTABLE_PAYMENTS_TABLE_ID || 'tblRXGH4krnEOtddP';
const AIRTABLE_LOAN_TYPES_TABLE_ID =
  process.env.AIRTABLE_LOAN_TYPES_TABLE_ID || 'Loan Types';
const AIRTABLE_SALES_ORDERS_TABLE_ID =
  process.env.AIRTABLE_SALES_ORDERS_TABLE_ID || 'tblxGEmQmGu9ctM5O';
const AIRTABLE_BUYERS_TABLE_ID =
  process.env.AIRTABLE_BUYERS_TABLE_ID || 'tblCKzHEbQs1fZzic';
const AIRTABLE_INVENTORY_TABLE_ID =
  process.env.AIRTABLE_INVENTORY_TABLE_ID || 'Inventory';

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

app.patch('/api/v1/auth/profile', async (req, res) => {
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
      return res.status(403).json({ error: 'ACCESS_DENIED', message: 'Account not recognised.' });
    }

    // Locate the caller's own Users record; never trust a client-supplied id.
    const formula = buildFilterFormula(email, phone);
    const { data } = await airtableApi.post(`/${AIRTABLE_USERS_TABLE_ID}/listRecords`, {
      filterByFormula: formula,
      maxRecords: 1,
    });

    const record = data.records?.[0];

    if (!record || !record.fields?.Active) {
      return res.status(403).json({ error: 'ACCESS_DENIED', message: 'Account not recognised.' });
    }

    const { name, phone: newPhone } = req.body;
    const fields = {};
    if (typeof name === 'string' && name.trim()) fields.Name = name.trim();
    if (typeof newPhone === 'string') fields.Phone = newPhone.trim();

    if (!Object.keys(fields).length) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Nothing to update.' });
    }

    const { data: updated } = await airtableApi.patch(`/${AIRTABLE_USERS_TABLE_ID}`, {
      records: [{ id: record.id, fields }],
    });

    return res.json({ record: updated.records?.[0] });
  } catch (error) {
    console.error('/api/v1/auth/profile error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update profile.',
    });
  }
});

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

function buildLandsFilter(fpoId, fpoName) {
  const escapedId = (fpoId || '').replace(/'/g, "''");
  const escapedName = (fpoName || '').replace(/'/g, "''");
  const conditions = [];

  if (escapedId) {
    conditions.push(`FIND('${escapedId}', ARRAYJOIN({FPO from farmers}, ',')) > 0`);
  }

  if (escapedName) {
    conditions.push(`SEARCH('${escapedName}', ARRAYJOIN({FPO from farmers}, ',')) > 0`);
  }

  if (!conditions.length) return '1';
  if (conditions.length === 1) return conditions[0];
  return `OR(${conditions.join(', ')})`;
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

function buildOrdersFilter(fpoId, fpoName) {
  const escapedId = (fpoId || '').replace(/'/g, "''");
  const escapedName = (fpoName || '').replace(/'/g, "''");
  const conditions = [];

  if (escapedId) {
    conditions.push(`FIND('${escapedId}', ARRAYJOIN({FPO}, ',')) > 0`);
  }

  if (escapedName) {
    conditions.push(`SEARCH('${escapedName}', ARRAYJOIN({Name (from FPO)}, ',')) > 0`);
  }

  if (!conditions.length) return '1';
  if (conditions.length === 1) return conditions[0];
  return `OR(${conditions.join(', ')})`;
}

function toOrderFields(input) {
  const fields = { ...input };

  ['FPO', 'Farmer', 'Season', 'Loans', '(From CS)']
    .concat(['Input 1', 'Input 2', 'Input 3', 'Input 4', 'Input 5'])
    .forEach((key) => {
      if (fields[key] && typeof fields[key] === 'string') {
        fields[key] = [fields[key]];
      }
    });

  // Defaults for new orders.
  if (!fields['Order Status']) {
    fields['Order Status'] = 'Open';
  }

  return fields;
}

function buildLoansFilter(fpoId, fpoName) {
  const escapedId = (fpoId || '').replace(/'/g, "''");
  const escapedName = (fpoName || '').replace(/'/g, "''");
  const conditions = [];

  if (escapedName) {
    conditions.push(`SEARCH('${escapedName}', {FPO}) > 0`);
  }

  if (escapedId) {
    conditions.push(`FIND('${escapedId}', ARRAYJOIN({FPO Input}, ',')) > 0`);
    conditions.push(`FIND('${escapedId}', ARRAYJOIN({FPO Cash Advance}, ',')) > 0`);
  }

  if (!conditions.length) return '1';
  if (conditions.length === 1) return conditions[0];
  return `OR(${conditions.join(', ')})`;
}

function toLoansFields(input) {
  const fields = { ...input };

  ['FPO', 'FPO Cash Advance', 'Farmer', 'Season Cash Advance', 'Loan Type', 'Orders (Input)', 'Insurance']
    .concat(['Farmers', 'Payments Received Link'])
    .forEach((key) => {
      if (fields[key] && typeof fields[key] === 'string') {
        fields[key] = [fields[key]];
      }
    });

  return fields;
}

function buildPaymentsFilter(fpoId, fpoName) {
  const escapedId = (fpoId || '').replace(/'/g, "''");
  const escapedName = (fpoName || '').replace(/'/g, "''");
  const conditions = [];

  if (escapedName) {
    conditions.push(`SEARCH('${escapedName}', ARRAYJOIN({FPO (from Loans)}, ',')) > 0`);
  }

  if (escapedId) {
    conditions.push(`FIND('${escapedId}', ARRAYJOIN({FPO (from Loans)}, ',')) > 0`);
  }

  if (!conditions.length) return '1';
  if (conditions.length === 1) return conditions[0];
  return `OR(${conditions.join(', ')})`;
}

function toPaymentsFields(input) {
  const fields = { ...input };

  ['Loans'].forEach((key) => {
    if (fields[key] && typeof fields[key] === 'string') {
      fields[key] = [fields[key]];
    }
  });

  return fields;
}

function toSalesOrderFields(input) {
  const fields = { ...input };

  ['Buyer', 'Product'].forEach((key) => {
    if (fields[key] && typeof fields[key] === 'string') {
      fields[key] = [fields[key]];
    }
  });

  return fields;
}

function toBuyerFields(input) {
  const fields = { ...input };

  ['Product'].forEach((key) => {
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
    const { fpoId, fpoName } = req.query;

    if (!fpoId && !fpoName) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId or fpoName is required.' });
    }

    const filter = buildLandsFilter(fpoId, fpoName);
    console.log('[Lands filter]', fpoId, fpoName, filter);
    const { data } = await airtableApi.post(`/${AIRTABLE_LANDS_TABLE_ID}/listRecords`, {
      filterByFormula: filter,
      maxRecords: 100,
    });

    console.log('[Lands result]', data.records?.length, data.error);
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

app.get('/api/v1/seasons', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.post(`/${AIRTABLE_SEASONS_TABLE_ID}/listRecords`, {
      maxRecords: 100,
    });
    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/seasons error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch seasons.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/input-products', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.post(`/${AIRTABLE_PRODUCTS_TABLE_ID}/listRecords`, {
      maxRecords: 1000,
    });
    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/input-products error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch products.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/input-orders', requireAuth, async (req, res) => {
  try {
    const { fpoId, fpoName } = req.query;

    if (!fpoId && !fpoName) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId or fpoName is required.' });
    }

    const filter = buildOrdersFilter(fpoId, fpoName);
    const { data } = await airtableApi.post(`/${AIRTABLE_ORDERS_TABLE_ID}/listRecords`, {
      filterByFormula: filter,
      maxRecords: 100,
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/input-orders error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch orders.',
    });
  }
});

app.get('/api/v1/input-orders/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.get(`/${AIRTABLE_ORDERS_TABLE_ID}/${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/input-orders/:id error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch order.',
    });
  }
});

app.post('/api/v1/input-orders', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ fields: toOrderFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.post(`/${AIRTABLE_ORDERS_TABLE_ID}`, payload);
    return res.status(201).json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/input-orders POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create order.',
    });
  }
});

app.patch('/api/v1/input-orders/:id', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ id: req.params.id, fields: toOrderFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.patch(`/${AIRTABLE_ORDERS_TABLE_ID}`, payload);
    return res.json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/input-orders PATCH error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update order.',
    });
  }
});

app.delete('/api/v1/input-orders/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.delete(
      `/${AIRTABLE_ORDERS_TABLE_ID}?records[]=${req.params.id}`
    );
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/input-orders DELETE error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to delete order.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/loan-types', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.post(`/${AIRTABLE_LOAN_TYPES_TABLE_ID}/listRecords`, {
      maxRecords: 100,
    });
    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/loan-types error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch loan types.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/loans', requireAuth, async (req, res) => {
  try {
    const { fpoId, fpoName } = req.query;

    if (!fpoId && !fpoName) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId or fpoName is required.' });
    }

    const filter = buildLoansFilter(fpoId, fpoName);
    const { data } = await airtableApi.post(`/${AIRTABLE_LOANS_TABLE_ID}/listRecords`, {
      filterByFormula: filter,
      maxRecords: 100,
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/loans error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch loans.',
    });
  }
});

app.get('/api/v1/loans/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.get(`/${AIRTABLE_LOANS_TABLE_ID}/${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/loans/:id error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch loan.',
    });
  }
});

app.post('/api/v1/loans', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ fields: toLoansFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.post(`/${AIRTABLE_LOANS_TABLE_ID}`, payload);
    return res.status(201).json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/loans POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create loan.',
    });
  }
});

app.patch('/api/v1/loans/:id', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ id: req.params.id, fields: toLoansFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.patch(`/${AIRTABLE_LOANS_TABLE_ID}`, payload);
    return res.json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/loans PATCH error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update loan.',
    });
  }
});

app.delete('/api/v1/loans/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.delete(
      `/${AIRTABLE_LOANS_TABLE_ID}?records[]=${req.params.id}`
    );
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/loans DELETE error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to delete loan.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/payments', requireAuth, async (req, res) => {
  try {
    const { fpoId, fpoName } = req.query;

    if (!fpoId && !fpoName) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId or fpoName is required.' });
    }

    const filter = buildPaymentsFilter(fpoId, fpoName);
    const { data } = await airtableApi.post(`/${AIRTABLE_PAYMENTS_TABLE_ID}/listRecords`, {
      filterByFormula: filter,
      maxRecords: 100,
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/payments error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch payments.',
    });
  }
});

app.get('/api/v1/payments/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.get(`/${AIRTABLE_PAYMENTS_TABLE_ID}/${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/payments/:id error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch payment.',
    });
  }
});

app.post('/api/v1/payments', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ fields: toPaymentsFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.post(`/${AIRTABLE_PAYMENTS_TABLE_ID}`, payload);
    return res.status(201).json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/payments POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create payment.',
    });
  }
});

app.patch('/api/v1/payments/:id', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ id: req.params.id, fields: toPaymentsFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.patch(`/${AIRTABLE_PAYMENTS_TABLE_ID}`, payload);
    return res.json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/payments PATCH error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update payment.',
    });
  }
});

app.delete('/api/v1/payments/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.delete(
      `/${AIRTABLE_PAYMENTS_TABLE_ID}?records[]=${req.params.id}`
    );
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/payments DELETE error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to delete payment.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/buyers', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.post(`/${AIRTABLE_BUYERS_TABLE_ID}/listRecords`, {
      maxRecords: 100,
    });
    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/buyers error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch buyers.',
    });
  }
});

app.post('/api/v1/buyers', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ fields: toBuyerFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.post(`/${AIRTABLE_BUYERS_TABLE_ID}`, payload);
    return res.status(201).json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/buyers POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create buyer.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/inventory', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.post(`/${AIRTABLE_INVENTORY_TABLE_ID}/listRecords`, {
      maxRecords: 1000,
    });
    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/inventory error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch inventory.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/api/v1/sales-orders', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.post(`/${AIRTABLE_SALES_ORDERS_TABLE_ID}/listRecords`, {
      maxRecords: 100,
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/sales-orders error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch sales orders.',
    });
  }
});

app.get('/api/v1/sales-orders/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.get(`/${AIRTABLE_SALES_ORDERS_TABLE_ID}/${req.params.id}`);
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/sales-orders/:id error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch sales order.',
    });
  }
});

app.post('/api/v1/sales-orders', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ fields: toSalesOrderFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.post(`/${AIRTABLE_SALES_ORDERS_TABLE_ID}`, payload);
    return res.status(201).json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/sales-orders POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create sales order.',
    });
  }
});

app.patch('/api/v1/sales-orders/:id', requireAuth, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ id: req.params.id, fields: toSalesOrderFields(fields) }],
      typecast: true,
    };

    const { data } = await airtableApi.patch(`/${AIRTABLE_SALES_ORDERS_TABLE_ID}`, payload);
    return res.json({ record: data.records?.[0] });
  } catch (error) {
    console.error('/api/v1/sales-orders PATCH error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update sales order.',
    });
  }
});

app.delete('/api/v1/sales-orders/:id', requireAuth, async (req, res) => {
  try {
    const { data } = await airtableApi.delete(
      `/${AIRTABLE_SALES_ORDERS_TABLE_ID}?records[]=${req.params.id}`
    );
    return res.json({ record: data });
  } catch (error) {
    console.error('/api/v1/sales-orders DELETE error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to delete sales order.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`FPO app server running on http://localhost:${PORT}`);
});
