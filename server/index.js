require('dotenv').config();

const cors = require('cors');
const crypto = require('crypto');
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
const AIRTABLE_FPOS_TABLE_ID =
  process.env.AIRTABLE_FPOS_TABLE_ID || 'tbltHO7Xh51FTx0dn';
const AIRTABLE_SEASONS_TABLE_ID = process.env.AIRTABLE_SEASONS_TABLE_ID || 'Seasons';
const AIRTABLE_LOANS_TABLE_ID =
  process.env.AIRTABLE_LOANS_TABLE_ID || 'tblXqXRcHSoRC94vA';
const AIRTABLE_PAYMENTS_TABLE_ID =
  process.env.AIRTABLE_PAYMENTS_TABLE_ID || 'tblRXGH4krnEOtddP';
const AIRTABLE_LOAN_TYPES_TABLE_ID =
  process.env.AIRTABLE_LOAN_TYPES_TABLE_ID || 'Loan Types';
const AIRTABLE_SALES_ORDERS_TABLE_ID =
  process.env.AIRTABLE_SALES_ORDERS_TABLE_ID || 'tblatBt8bxcjUmBan';
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
    // Extract the PEM block. The env value may be wrapped in quotes or contain trailing punctuation.
    const raw = process.env.FIREBASE_PRIVATE_KEY.trim();
    const pemMatch = raw.match(/(-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----)/);
    const privateKey = pemMatch
      ? pemMatch[1].replace(/\\n/g, '\n')
      : raw.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey,
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
// Attachment uploads arrive as base64 (~1.4x the file size, capped at 5MB
// by Airtable), so the JSON limit must clear the 100kb default.
app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------------------------

const airtableApi = axios.create({
  baseURL: `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`,
  headers: {
    Authorization: `Bearer ${AIRTABLE_PAT}`,
    'Content-Type': 'application/json',
  },
});

// Airtable returns at most 100 records per call — follow `offset` until exhausted.
async function listAllRecords(tableId, params = {}) {
  const records = [];
  let offset;
  do {
    const { data } = await airtableApi.post(`/${tableId}/listRecords`, { ...params, offset });
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return { records };
}

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

// Users must exist (and be Active) in Airtable before they can sign in.
async function findActiveUser(email, phone) {
  if (!email && !phone) return null;
  const { data } = await airtableApi.post(`/${AIRTABLE_USERS_TABLE_ID}/listRecords`, {
    filterByFormula: buildFilterFormula(email, phone),
    maxRecords: 1,
    returnFieldsByFieldId: false,
  });
  const record = data.records?.[0];
  return record?.fields?.Active ? record : null;
}

const ACCESS_DENIED = {
  error: 'ACCESS_DENIED',
  message:
    'Your account is not registered, please contact support@netgecko.net to gain access',
};

// Comma-separated emails that always get NetGecko Admin access — lets test
// accounts see every partner without changing their Airtable role.
const ADMIN_EMAILS = (process.env.AUTH_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
      return res.status(403).json(ACCESS_DENIED);
    }

    const record = await findActiveUser(email, phone);

    if (!record) {
      return res.status(403).json(ACCESS_DENIED);
    }

    const fields = record.fields;
    const role =
      email && ADMIN_EMAILS.includes(email.toLowerCase())
        ? 'NetGecko Admin'
        : fields.Role || '';

    let fbos;
    if (role === 'NetGecko Admin') {
      // Admins can access every partner.
      const fpoData = await listAllRecords(AIRTABLE_FPOS_TABLE_ID, { fields: ['Name'] });
      fbos = (fpoData.records || []).map((fpo) => ({
        id: fpo.id,
        name: fpo.fields?.Name || fpo.id,
      }));
    } else {
      const fpoIds = Array.isArray(fields.FPO) ? fields.FPO : [];
      const fpoNames = Array.isArray(fields['Name (from FPO)']) ? fields['Name (from FPO)'] : [];
      fbos = fpoIds.map((id, index) => ({
        id,
        name: fpoNames[index] || id,
      }));
    }

    await updateLoginMeta(record.id, decoded.uid);

    return res.status(200).json({
      user: {
        id: record.id,
        name: fields.Name || '',
        email: fields.email || email || '',
        phone: fields.Phone || phone || '',
        role,
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
// Auth emails via Resend (custom templates) — replaces Firebase's own mail
// ----------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'NetGecko <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    throw new Error('Resend is not configured (missing RESEND_API_KEY).');
  }
  await axios.post(
    'https://api.resend.com/emails',
    { from: RESEND_FROM, to: [to], subject, html },
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } }
  );
}

function authEmailHtml({ intro, actionUrl, actionLabel, ignoreNote }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1c252e">
    <p style="margin:0 0 16px;line-height:1.5">Hello,</p>
    <p style="margin:0 0 24px;line-height:1.5">${intro}</p>
    <a href="${actionUrl}" style="display:inline-block;background:#4EA82F;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px">${actionLabel}</a>
    <p style="margin:24px 0 0;font-size:12px;color:#637381;line-height:1.5">
      If the button does not work, copy and paste this link into your browser:<br/>
      <a href="${actionUrl}" style="color:#4EA82F;word-break:break-all">${actionUrl}</a>
    </p>
    <p style="margin:24px 0 0;line-height:1.5">${ignoreNote}</p>
    <p style="margin:24px 0 0;line-height:1.5">Thanks,<br/>The NetGecko team</p>
  </div>`;
}

app.post('/api/v1/auth/magic-link', async (req, res) => {
  try {
    const { email, continueUrl } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email is required.' });
    }
    const user = await findActiveUser(email, null);
    if (!user) {
      return res.status(403).json(ACCESS_DENIED);
    }

    const link = await admin.auth().generateSignInWithEmailLink(email, {
      url: continueUrl || `${req.headers.origin || ''}/auth/sign-in`,
      handleCodeInApp: true,
    });
    await sendEmail({
      to: email,
      subject: 'Your login link to access NetGecko App',
      html: authEmailHtml({
        intro: `We received a request to sign in to NetGecko App using this email address. If you want to sign in with ${email} account, click this link:`,
        actionUrl: link,
        actionLabel: 'Sign in to NetGecko App',
        ignoreNote: 'If you did not request this link, you can safely ignore this email.',
      }),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('/api/v1/auth/magic-link error:', error?.response?.data || error.message);
    const code = error?.errorInfo?.code || error?.code;
    if (code === 'auth/unauthorized-continue-uri') {
      return res.status(400).json({
        error: 'CONTINUE_URL_NOT_AUTHORIZED',
        message:
          'This app domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.',
      });
    }
    const resendError = error?.response?.data;
    if (String(resendError?.message || '').includes('resend.com/domains')) {
      return res.status(502).json({
        error: 'EMAIL_DOMAIN_NOT_VERIFIED',
        message:
          'RESEND_FROM must be on a verified domain — onboarding@resend.dev only delivers to the Resend account owner.',
      });
    }
    return res
      .status(500)
      .json({ error: 'EMAIL_FAILED', message: 'Failed to send the sign-in link.' });
  }
});

// ----------------------------------------------------------------------
// Phone sign-in via Africa's Talking OTP -> Firebase custom token
// ----------------------------------------------------------------------

const AT_API_KEY = process.env.AT_API_KEY;
const AT_USERNAME = process.env.AT_USERNAME;
const AT_SENDER_ID = process.env.AT_SENDER_ID;

// OTPs can't live in a Map on serverless (Vercel) — request and verify may hit
// different instances. The proof is a stateless HMAC-signed session token instead.
const OTP_SECRET = process.env.OTP_SECRET || AT_API_KEY || 'netgecko-otp-dev-secret';
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// Shared Africa's Talking sender — OTP codes and the scheduled loan SMS job.
async function sendAtSms(to, message) {
  const form = new URLSearchParams({ username: AT_USERNAME, to, message });
  if (AT_SENDER_ID) form.set('from', AT_SENDER_ID);

  const { data } = await axios.post('https://api.africastalking.com/version1/messaging', form.toString(), {
    headers: {
      apiKey: AT_API_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return { status: data?.SMSMessageData?.Recipients?.[0]?.status, raw: data };
}

// Best-effort in-memory throttles only — resetting on cold start is acceptable
// because expiry and code correctness are enforced inside the signed token.
const otpLastSentAt = new Map(); // e164 -> timestamp
const otpAttempts = new Map(); // codeHash -> attempt count

const hashOtpCode = (code) =>
  crypto.createHash('sha256').update(`${OTP_SECRET}:${code}`).digest('hex');

function signOtpSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', OTP_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyOtpSession(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', OTP_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}

app.post('/api/v1/auth/phone/request-otp', async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Phone number is required.' });
    }
    if (!AT_API_KEY || !AT_USERNAME) {
      return res.status(503).json({
        error: 'SMS_NOT_CONFIGURED',
        message: "Phone sign-in is not configured (missing AT_API_KEY/AT_USERNAME).",
      });
    }

    const e164 = toE164(phone);

    const user = await findActiveUser(null, e164);
    if (!user) {
      return res.status(403).json(ACCESS_DENIED);
    }

    const lastSentAt = otpLastSentAt.get(e164) || 0;
    if (Date.now() - lastSentAt < OTP_RESEND_MS) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Please wait a moment before requesting another code.',
      });
    }

    const code = String(crypto.randomInt(100000, 1000000));

    const { status: smsStatus } = await sendAtSms(
      e164,
      `Your NetGecko sign-in code is ${code}. It expires in 5 minutes.`
    );
    if (smsStatus && !String(smsStatus).startsWith('Success')) {
      return res
        .status(400)
        .json({ error: 'SMS_FAILED', message: `Could not send SMS (${smsStatus}).` });
    }

    otpLastSentAt.set(e164, Date.now());
    return res.json({
      ok: true,
      otpSession: signOtpSession({
        phone: e164,
        codeHash: hashOtpCode(code),
        exp: Date.now() + OTP_TTL_MS,
      }),
    });
  } catch (error) {
    console.error('/api/v1/auth/phone/request-otp error:', error?.response?.data || error.message);
    return res
      .status(500)
      .json({ error: 'SMS_FAILED', message: 'Failed to send the verification code.' });
  }
});

app.post('/api/v1/auth/phone/verify-otp', async (req, res) => {
  try {
    const { phone, code, otpSession } = req.body || {};
    if (!phone || !code || !otpSession) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Phone number, code, and OTP session are required.',
      });
    }

    const e164 = toE164(phone);
    const session = verifyOtpSession(otpSession);
    if (!session || session.phone !== e164) {
      return res
        .status(400)
        .json({ error: 'OTP_INVALID', message: 'No code was requested for this number.' });
    }
    if (Date.now() > session.exp) {
      return res.status(400).json({ error: 'OTP_EXPIRED', message: 'The code has expired.' });
    }

    const attempts = (otpAttempts.get(session.codeHash) || 0) + 1;
    otpAttempts.set(session.codeHash, attempts);
    if (attempts > OTP_MAX_ATTEMPTS) {
      return res
        .status(429)
        .json({ error: 'RATE_LIMITED', message: 'Too many attempts, request a new code.' });
    }
    if (hashOtpCode(String(code).trim()) !== session.codeHash) {
      return res.status(400).json({ error: 'OTP_INVALID', message: 'Invalid code.' });
    }
    otpAttempts.delete(session.codeHash);

    const airtableUser = await findActiveUser(null, e164);
    if (!airtableUser) {
      return res.status(403).json(ACCESS_DENIED);
    }

    let user;
    try {
      user = await admin.auth().getUserByPhoneNumber(e164);
    } catch (error) {
      const errCode = error?.errorInfo?.code || error?.code;
      if (errCode === 'auth/user-not-found') {
        user = await admin.auth().createUser({ phoneNumber: e164 });
      } else {
        throw error;
      }
    }

    const token = await admin.auth().createCustomToken(user.uid);
    return res.json({ token });
  } catch (error) {
    console.error('/api/v1/auth/phone/verify-otp error:', error?.response?.data || error.message);
    return res
      .status(500)
      .json({ error: 'OTP_VERIFY_FAILED', message: 'Failed to verify the code.' });
  }
});

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

// ----------------------------------------------------------------------
// Roles: "Partner User" and "NetGecko Admin" can create/edit; every other
// role (Cluster Developer, Partner Viewer, …) is view-only.

const EDITOR_ROLES = new Set(['Partner User', 'NetGecko Admin']);
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;
const roleCache = new Map(); // firebase uid -> { role, ts }

async function resolveUserRole(decoded) {
  const cached = roleCache.get(decoded.uid);
  if (cached && Date.now() - cached.ts < ROLE_CACHE_TTL_MS) return cached.role;

  const email = decoded.email || null;
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
    roleCache.set(decoded.uid, { role: 'NetGecko Admin', ts: Date.now() });
    return 'NetGecko Admin';
  }
  const phone = decoded.phone_number ? toE164(decoded.phone_number) : null;
  const escapedUid = String(decoded.uid).replace(/'/g, "''");

  const parts = [`{FirebaseUID}='${escapedUid}'`];
  if (email || phone) parts.push(buildFilterFormula(email, phone));
  const formula = parts.length > 1 ? `OR(${parts.join(',')})` : parts[0];

  const { data } = await airtableApi.post(`/${AIRTABLE_USERS_TABLE_ID}/listRecords`, {
    filterByFormula: formula,
    maxRecords: 1,
    fields: ['Role'],
  });

  const role = data.records?.[0]?.fields?.Role || '';
  roleCache.set(decoded.uid, { role, ts: Date.now() });
  return role;
}

async function requireEditor(req, res, next) {
  try {
    const role = await resolveUserRole(req.user);
    if (!EDITOR_ROLES.has(role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Your account is view-only. Contact NetGecko for edit access.',
      });
    }
    return next();
  } catch (error) {
    console.error('Role resolution failed:', error.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unable to verify permissions.' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const role = await resolveUserRole(req.user);
    if (role !== 'NetGecko Admin') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'This area is restricted to NetGecko administrators.',
      });
    }
    return next();
  } catch (error) {
    console.error('Role resolution failed:', error.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unable to verify permissions.' });
  }
}

function buildFpoFilter(fpoName) {
  const escaped = fpoName.replace(/'/g, "''");
  return `SEARCH('${escaped}', ARRAYJOIN({Name (from FPO)}, ',')) > 0`;
}

// Farmers' link to FPOs is named differently across bases (prod: FPO).
const FARMER_FPO_FIELD = process.env.AIRTABLE_FARMER_FPO_FIELD || 'FPO';

function toAirtableFields(input, fpoId) {
  const fields = { ...input };

  // Link fields expect arrays of record IDs.
  if (fields['Main product sold to Partner'] && typeof fields['Main product sold to Partner'] === 'string') {
    fields['Main product sold to Partner'] = [fields['Main product sold to Partner']];
  }

  if (fpoId) {
    fields[FARMER_FPO_FIELD] = [fpoId];
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

// The live Lands table uses "Crop" vocabulary; the app (and dev bases)
// use "Product". Translate both ways at the API boundary so the frontend
// always works with its canonical names. Disable with
// AIRTABLE_LANDS_LEGACY_NAMES=1 for a base that still uses Product names.
const LANDS_FIELD_MAP = {
  'Main Product (1)': 'Main Crop (1)',
  'Other product (2)': 'Other crop (2)',
  'Number of plants (Product 1)': 'Number of plants (Crop 1)',
  'Number of plants (Product 2)': 'Number of plants (Crop 2)',
  'Product 1 Estimated Production Season A (kg, heads, litres, units)':
    'Crop 1 Estimated Harvest (KG) Season A',
  'Product 1 Estimated Production Season B (kg, heads, litres, units)':
    'Crop 1 Estimated Harvest (KG) Season B',
  'Product 2 Estimated Production Season A (kg, heads, litres, units)':
    'Crop 2 Estimated Harvest (KG) Season A',
  'Product 2 Estimated Production Season B (kg, heads, litres, units)':
    'Crop 2 Estimated Harvest (KG) Season B',
};
const LANDS_LEGACY_NAMES = process.env.AIRTABLE_LANDS_LEGACY_NAMES === '1';
const LANDS_FIELD_MAP_INV = Object.fromEntries(
  Object.entries(LANDS_FIELD_MAP).map(([a, b]) => [b, a])
);

function renameLandsKeys(fields, map) {
  if (LANDS_LEGACY_NAMES) return fields;
  const out = { ...fields };
  for (const [from, to] of Object.entries(map)) {
    if (out[from] !== undefined) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}

const fromLandsRecord = (record) =>
  record && { ...record, fields: renameLandsKeys(record.fields || {}, LANDS_FIELD_MAP_INV) };

function toLandsFields(input) {
  const fields = { ...input };

  [
    'Farmer',
    'Main Product (1)',
    'Other product (2)',
  ].forEach((key) => {
    if (fields[key] && typeof fields[key] === 'string') {
      fields[key] = [fields[key]];
    }
  });

  return renameLandsKeys(fields, LANDS_FIELD_MAP);
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

function toOrderFields(input, isNew = false) {
  const fields = { ...input };

  ['FPO', 'Farmer', 'Season', 'Loans', '(From CS)']
    .concat(['Input 1', 'Input 2', 'Input 3', 'Input 4', 'Input 5'])
    .forEach((key) => {
      if (fields[key] && typeof fields[key] === 'string') {
        fields[key] = [fields[key]];
      }
    });

  // Defaults for new orders.
  if (isNew && !fields['Order Status']) {
    fields['Order Status'] = 'Open';
  }

  return fields;
}

function buildLoansFilter(fpoId, fpoName) {
  const escapedId = (fpoId || '').replace(/'/g, "''");
  const escapedName = (fpoName || '').replace(/'/g, "''");
  const conditions = [];

  // Loans store the partner as free text in {FPO} and as links in
  // {FPO Input} / {FPO Cash Advance}; ARRAYJOIN on a link yields names,
  // so match the partner name across all of them.
  if (escapedName) {
    conditions.push(`SEARCH('${escapedName}', {FPO}) > 0`);
    conditions.push(`SEARCH('${escapedName}', ARRAYJOIN({FPO Input}, ',')) > 0`);
    conditions.push(`SEARCH('${escapedName}', ARRAYJOIN({FPO Cash Advance}, ',')) > 0`);
    conditions.push(`SEARCH('${escapedName}', ARRAYJOIN({Name (from FPOs 2)}, ',')) > 0`);
  }

  if (escapedId) {
    conditions.push(`FIND('${escapedId}', {FPO}) > 0`);
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

function buildSalesOrdersFilter(fpoId, fpoName) {
  const escapedId = (fpoId || '').replace(/'/g, "''");
  const escapedName = (fpoName || '').replace(/'/g, "''");
  const conditions = [];

  if (escapedName) {
    conditions.push(`SEARCH('${escapedName}', ARRAYJOIN({Name (from FPOs)}, ',')) > 0`);
  }

  if (escapedId) {
    conditions.push(`FIND('${escapedId}', ARRAYJOIN({FPOs}, ',')) > 0`);
  }

  if (!conditions.length) return '1';
  if (conditions.length === 1) return conditions[0];
  return `OR(${conditions.join(', ')})`;
}

function toSalesOrderFields(input) {
  const fields = { ...input };

  ['FPOs', 'Farmers', 'Season', 'Product'].forEach((key) => {
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

    const data = await listAllRecords(AIRTABLE_FARMERS_TABLE_ID, {
      filterByFormula: buildFpoFilter(fpoName || fpoId),
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

app.post('/api/v1/farmers', requireAuth, requireEditor, async (req, res) => {
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

app.patch('/api/v1/farmers/:id', requireAuth, requireEditor, async (req, res) => {
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

app.delete('/api/v1/farmers/:id', requireAuth, requireEditor, async (req, res) => {
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

// The crops table was renamed to "Products" in the live base — resolve the
// table by name when the configured id/name stops working.
let resolvedCropsTableId = null;

async function resolveTableIdByName(candidates) {
  const { data } = await airtableApi.get(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`
  );
  const tables = data.tables || [];
  const lower = candidates.map((c) => c.toLowerCase());
  // Exact-name match only — a fuzzy match could pick up "Input Products"
  // (a different table) and silently serve the wrong list.
  const exact = tables.find((t) => lower.includes(String(t.name).toLowerCase()));
  return exact?.id || null;
}

function isTableNotFound(error) {
  const type = String(error?.response?.data?.error?.type || '');
  const msg = String(error?.response?.data?.error?.message || '');
  return (
    error?.response?.status === 404 ||
    type === 'TABLE_NOT_FOUND' ||
    type === 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND' ||
    /could not find table|table not found|does not exist/i.test(msg)
  );
}

async function fetchCropsRecords() {
  try {
    const data = await listAllRecords(resolvedCropsTableId || AIRTABLE_CROPS_TABLE_ID);
    return data.records || [];
  } catch (error) {
    if (!isTableNotFound(error)) throw error;
    const resolved = await resolveTableIdByName(['Products', 'Product', 'Crops', 'Crop']);
    if (!resolved) throw error;
    resolvedCropsTableId = resolved;
    const data = await listAllRecords(resolved);
    return data.records || [];
  }
}

app.get('/api/v1/crops', requireAuth, async (req, res) => {
  try {
    const records = await fetchCropsRecords();

    // Normalize the product name onto 'Crop Name' so every consumer keeps
    // working regardless of what the field is called in Airtable.
    const normalized = records.map((r) => {
      const f = r.fields || {};
      if (f['Crop Name'] !== undefined) return r;
      const alt = f['Product Name'] ?? f.Name;
      return alt === undefined ? r : { ...r, fields: { ...f, 'Crop Name': alt } };
    });

    return res.json({ records: normalized });
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

const AIRTABLE_VILLAGES_TABLE_ID = process.env.AIRTABLE_VILLAGES_TABLE_ID || 'tbl3PjHhXWSOeCVVv';

app.get('/api/v1/villages', requireAuth, async (req, res) => {
  try {
    const id = String(req.query.id || '').trim();
    const q = String(req.query.q || '').trim();

    // Edit forms resolve the currently linked village by record id.
    if (id) {
      const { data } = await airtableApi.get(`/${AIRTABLE_VILLAGES_TABLE_ID}/${id}`);
      return res.json({ records: [data] });
    }

    // The table lists every village in the country — far too large to send
    // wholesale. Require a search term and cap the results.
    if (q.length < 2) {
      return res.json({ records: [] });
    }

    const escaped = q.toLowerCase().replace(/'/g, "''");
    const { data } = await airtableApi.post(`/${AIRTABLE_VILLAGES_TABLE_ID}/listRecords`, {
      // Airtable SEARCH is case-sensitive in practice — normalise both sides.
      filterByFormula: `SEARCH(LOWER('${escaped}'), LOWER({Summary})) > 0`,
      sort: [{ field: 'Summary', direction: 'asc' }],
      maxRecords: 50,
      fields: ['Village Name', 'Parish Name', 'Sub-County Name', 'District Name', 'Region', 'Summary'],
    });

    return res.json({ records: data.records || [] });
  } catch (error) {
    console.error('/api/v1/villages error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch villages.',
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
    const data = await listAllRecords(AIRTABLE_LANDS_TABLE_ID, {
      filterByFormula: filter,
    });

    console.log('[Lands result]', data.records?.length, data.error);
    return res.json({ records: (data.records || []).map(fromLandsRecord) });
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
    return res.json({ record: fromLandsRecord(data) });
  } catch (error) {
    console.error('/api/v1/lands/:id error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch land.',
    });
  }
});

app.post('/api/v1/lands', requireAuth, requireEditor, async (req, res) => {
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
    return res.status(201).json({ record: fromLandsRecord(data.records?.[0]) });
  } catch (error) {
    console.error('/api/v1/lands POST error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to create land.',
    });
  }
});

app.patch('/api/v1/lands/:id', requireAuth, requireEditor, async (req, res) => {
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
    return res.json({ record: fromLandsRecord(data.records?.[0]) });
  } catch (error) {
    console.error('/api/v1/lands PATCH error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to update land.',
    });
  }
});

app.delete('/api/v1/lands/:id', requireAuth, requireEditor, async (req, res) => {
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
    const data = await listAllRecords(AIRTABLE_SEASONS_TABLE_ID);
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
    const { fpoId } = req.query;

    let cropIds = [];
    if (fpoId) {
      try {
        const { data: fpo } = await airtableApi.get(`/${AIRTABLE_FPOS_TABLE_ID}/${fpoId}`);
        cropIds = Array.isArray(fpo?.fields?.Crops) ? fpo.fields.Crops : [];
      } catch (error) {
        console.warn('/api/v1/input-products FPO lookup failed:', error?.message);
      }
    }

    const data = await listAllRecords(AIRTABLE_PRODUCTS_TABLE_ID);

    let records = data.records || [];
    if (cropIds.length) {
      const allowed = new Set(cropIds);
      records = records.filter((record) =>
        (Array.isArray(record.fields?.Crop) ? record.fields.Crop : []).some((id) => allowed.has(id))
      );
    }

    return res.json({ records });
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
    const data = await listAllRecords(AIRTABLE_ORDERS_TABLE_ID, {
      filterByFormula: filter,
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

app.post('/api/v1/input-orders', requireAuth, requireEditor, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ fields: toOrderFields(fields, true) }],
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

app.patch('/api/v1/input-orders/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fields are required.' });
    }

    const payload = {
      records: [{ id: req.params.id, fields: toOrderFields(fields, false) }],
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

app.delete('/api/v1/input-orders/:id', requireAuth, requireEditor, async (req, res) => {
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
    const data = await listAllRecords(AIRTABLE_LOAN_TYPES_TABLE_ID);
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
    const data = await listAllRecords(AIRTABLE_LOANS_TABLE_ID, {
      filterByFormula: filter,
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

app.post('/api/v1/loans', requireAuth, requireEditor, async (req, res) => {
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

app.patch('/api/v1/loans/:id', requireAuth, requireEditor, async (req, res) => {
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

app.delete('/api/v1/loans/:id', requireAuth, requireEditor, async (req, res) => {
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
    const data = await listAllRecords(AIRTABLE_PAYMENTS_TABLE_ID, {
      filterByFormula: filter,
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

app.post('/api/v1/payments', requireAuth, requireEditor, async (req, res) => {
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

app.patch('/api/v1/payments/:id', requireAuth, requireEditor, async (req, res) => {
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

app.delete('/api/v1/payments/:id', requireAuth, requireEditor, async (req, res) => {
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
    const data = await listAllRecords(AIRTABLE_BUYERS_TABLE_ID);
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

app.post('/api/v1/buyers', requireAuth, requireEditor, async (req, res) => {
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
    const data = await listAllRecords(AIRTABLE_INVENTORY_TABLE_ID);
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
    const { fpoId, fpoName } = req.query;

    if (!fpoId && !fpoName) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'fpoId or fpoName is required.' });
    }

    const filter = buildSalesOrdersFilter(fpoId, fpoName);
    const data = await listAllRecords(AIRTABLE_SALES_ORDERS_TABLE_ID, {
      filterByFormula: filter,
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

app.post('/api/v1/sales-orders', requireAuth, requireEditor, async (req, res) => {
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

app.patch('/api/v1/sales-orders/:id', requireAuth, requireEditor, async (req, res) => {
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

app.delete('/api/v1/sales-orders/:id', requireAuth, requireEditor, async (req, res) => {
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
// Attachment uploads go straight to Airtable's uploadAttachment endpoint —
// no intermediate storage bucket, and Airtable appends the file to the
// field's existing attachments server-side.

const ATTACHMENT_RESOURCES = new Set([
  'farmers',
  'lands',
  'input-orders',
  'loans',
  'payments',
  'sales-orders',
  'buyers',
]);

app.post('/api/v1/:resource/:id/attachments', requireAuth, requireEditor, async (req, res) => {
  try {
    const { resource, id } = req.params;
    if (!ATTACHMENT_RESOURCES.has(resource)) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Unknown resource.' });
    }

    const { field, filename, contentType, file } = req.body || {};
    if (!field || !filename || !file) {
      return res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'field, filename and file are required.' });
    }

    const { data } = await axios.post(
      `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${id}/${encodeURIComponent(field)}/uploadAttachment`,
      { contentType: contentType || 'application/octet-stream', file, filename },
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return res.status(201).json({ record: data });
  } catch (error) {
    console.error('/api/v1/:resource/:id/attachments error:', error?.response?.data || error.message);
    const status = error?.response?.status || 500;
    return res.status(status).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to upload attachment.',
    });
  }
});

// ----------------------------------------------------------------------

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ----------------------------------------------------------------------
// Scheduled loan SMS
//
// The Airtable `SMS` table holds the rules (trigger text + Luganda message
// template + loan type). Each loan carries `SMS N` (sent message) and
// `SMS N date` (send timestamp) fields — used both as the audit trail and
// for deduplication, so a one-shot rule never fires twice on the same loan
// and the weekly overdue rule fires at most once per day.
// ----------------------------------------------------------------------

const AIRTABLE_SMS_TABLE_ID = process.env.AIRTABLE_SMS_TABLE_ID || 'tblpQLSLnjSX9fv7M';
const CRON_SECRET = process.env.CRON_SECRET || '';

// All timestamps compared in East Africa Time (UTC+3).
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const todayEAT = () => new Date(Date.now() + EAT_OFFSET_MS).toISOString().slice(0, 10);
const asDay = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
const firstVal = (v) => (Array.isArray(v) ? v[0] : v);

const SMS_LOAN_FIELDS = [
  'Loan Status',
  'Loan Type',
  'Loan ID',
  'Issue Date',
  'Repayment Due Date',
  'Last Payment Date',
  'Total Amount Pending',
  'Penalty per week',
  'Verified Mobile Money Number',
  'Name (from Farmer)',
  'Farmer',
  'Farmers',
  'FPO',
  'FPO Full Name',
  ...Array.from({ length: 20 }, (_, i) => `SMS ${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `SMS ${i + 1} date`),
];

// Map the human-readable rule row into an executable trigger.
function parseSmsRule(fields) {
  const name = String(fields.Name || '');
  const idx = name.match(/sms\s*(\d+)/i);
  if (!idx) return null;

  const what = String(fields['Trigger (What)'] || '').toLowerCase();
  const when = String(fields['Trigger (When)'] || '').toLowerCase();
  const combined = `${what} ${when}`;

  const smsRef = what.match(/sms\s*(\d+)/i);
  const after = when.match(/(\d+)\s*days?\s*after/);
  const before = when.match(/(\d+)\s*days?\s*before/);

  let trigger = null;
  if (/has passed|every week|\d+\/\d+/.test(combined)) trigger = { kind: 'overdueWeekly' };
  else if (/approved to active/.test(combined)) trigger = { kind: 'activation' };
  else if (smsRef && after) trigger = { kind: 'afterSms', refSms: Number(smsRef[1]), days: Number(after[1]) };
  else if (/<=\s*0/.test(combined)) trigger = { kind: 'paidOff' };
  else if (before) trigger = { kind: 'beforeDue', days: Number(before[1]) };
  if (!trigger) return null;

  return {
    smsIndex: Number(idx[1]),
    name,
    loanTypes: (fields['Loan type'] || []).map((t) => String(t).toLowerCase()),
    trigger,
    template: String(fields.Message || ''),
    fieldSpecs: [1, 2, 3].map((n) => String(fields[`Field ${n}`] || '').trim()),
  };
}

function fmtSmsValue(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  const s = String(v);
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return s;
}

function renderSmsMessage(rule, loan, weekBoundary) {
  return rule.template.replace(/\(field\s*(\d)\)/gi, (_, n) => {
    const spec = rule.fieldSpecs[Number(n) - 1];
    if (!spec) return '';
    // "Repayment Due Date + 7/14/21/… days" → end of the current overdue week.
    if (/\+\s*7\/14/.test(spec) || /\+.*days/i.test(spec)) return fmtSmsValue(weekBoundary);
    const key = spec.replace(/^loans\//i, '').trim().toLowerCase();
    const field = Object.keys(loan.fields).find((k) => k.trim().toLowerCase() === key);
    return fmtSmsValue(field ? firstVal(loan.fields[field]) : undefined);
  });
}

// True when the rule's trigger condition holds for this loan today and the
// SMS N fields show it hasn't already been sent.
function smsShouldFire(rule, loan, today) {
  const pending = Number(loan.fields['Total Amount Pending'] ?? 0);
  const due = asDay(loan.fields['Repayment Due Date']);
  const issued = asDay(loan.fields['Issue Date']);
  const lastPaid = asDay(loan.fields['Last Payment Date']);
  const status = String(loan.fields['Loan Status'] || '');
  const sentAt = asDay(loan.fields[`SMS ${rule.smsIndex} date`]);

  if (sentAt === today) return false;
  if (rule.trigger.kind !== 'overdueWeekly' && sentAt) return false;

  switch (rule.trigger.kind) {
    case 'activation':
      // Recency guard: without it the first run would welcome every
      // already-active loan issued months ago.
      return status === 'Active' && !!issued && daysBetween(issued, today) <= 7;
    case 'paidOff':
      // Same guard via Last Payment Date — only congratulate fresh payoffs.
      return pending <= 0 && !!issued && !!lastPaid && daysBetween(lastPaid, today) <= 7;
    case 'beforeDue':
      return pending > 0 && !!due && daysBetween(today, due) === rule.trigger.days;
    case 'afterSms': {
      const ref = asDay(loan.fields[`SMS ${rule.trigger.refSms} date`]);
      return pending > 0 && !!ref && daysBetween(ref, today) === rule.trigger.days;
    }
    case 'overdueWeekly': {
      if (pending <= 0 || !due) return false;
      const late = daysBetween(due, today);
      return late >= 1 && late % 7 === 1;
    }
    default:
      return false;
  }
}

// ----------------------------------------------------------------------
// Feature config — stored as one special record in the SMS rules table
// (its Name doesn't parse as a rule, so the job and the rules endpoint
// ignore it). Managed via /api/v1/sms/config. Defaults keep the feature
// disabled until an admin explicitly enables it.

const SMS_CONFIG_NAME = 'Z_CONFIG — SMS feature settings (managed in the app)';
const SMS_CONFIG_DEFAULTS = { enabled: false, mode: 'test', testPhone: '' };

function parseSmsConfigFields(fields) {
  let extra = {};
  try {
    extra = JSON.parse(fields?.Message || '{}');
  } catch {
    extra = {};
  }
  const merged = { ...SMS_CONFIG_DEFAULTS, ...extra };
  merged.mode = merged.mode === 'live' ? 'live' : 'test';
  merged.enabled = merged.enabled === true;
  merged.testPhone = String(merged.testPhone || '');
  return merged;
}

async function getSmsConfig(smsRecords) {
  const records = smsRecords || (await listAllRecords(AIRTABLE_SMS_TABLE_ID)).records || [];
  const rec = records.find((r) => r.fields?.Name === SMS_CONFIG_NAME);
  if (rec) return { id: rec.id, ...parseSmsConfigFields(rec.fields) };
  const { data } = await airtableApi.post(`/${AIRTABLE_SMS_TABLE_ID}`, {
    records: [{ fields: { Name: SMS_CONFIG_NAME, Message: JSON.stringify(SMS_CONFIG_DEFAULTS) } }],
  });
  return { id: data.records[0].id, ...SMS_CONFIG_DEFAULTS };
}

async function loadSmsContext() {
  const [rulesData, loansData, loanTypesData] = await Promise.all([
    listAllRecords(AIRTABLE_SMS_TABLE_ID),
    listAllRecords(AIRTABLE_LOANS_TABLE_ID, { fields: SMS_LOAN_FIELDS }),
    listAllRecords(AIRTABLE_LOAN_TYPES_TABLE_ID, { fields: ['Loan Object', 'Loan Type'] }),
  ]);

  const config = await getSmsConfig(rulesData.records);

  const typeNameById = {};
  (loanTypesData.records || []).forEach((r) => {
    typeNameById[r.id] = String(r.fields?.['Loan Object'] || r.fields?.['Loan Type'] || '');
  });

  const rules = (rulesData.records || []).map((r) => parseSmsRule(r.fields)).filter(Boolean);
  const farmerCache = new Map();
  const farmerPhone = async (loan) => {
    const direct = firstVal(loan.fields['Verified Mobile Money Number']);
    if (direct) return toE164(direct);
    const farmerId = firstVal(loan.fields.Farmer) || firstVal(loan.fields.Farmers);
    if (!farmerId) return null;
    if (!farmerCache.has(farmerId)) {
      try {
        const { data } = await airtableApi.get(`/${AIRTABLE_FARMERS_TABLE_ID}/${farmerId}`);
        farmerCache.set(farmerId, data);
      } catch {
        farmerCache.set(farmerId, null);
      }
    }
    const f = farmerCache.get(farmerId)?.fields;
    const raw = f?.['Mobile Money Number'] || f?.['Phone Number'];
    return raw ? toE164(raw) : null;
  };

  return { config, rules, loans: loansData.records || [], typeNameById, farmerPhone };
}

// Which messages would fire on a given date ("YYYY-MM-DD").
async function evaluateSmsDay({ rules, loans, typeNameById, farmerPhone }, today) {
  const plan = [];
  const skipped = [];
  for (const loan of loans) {
    const typeId = firstVal(loan.fields['Loan Type']);
    const typeName = (typeId && typeNameById[typeId] ? typeNameById[typeId] : '').toLowerCase();

    for (const rule of rules) {
      if (rule.loanTypes.length && !rule.loanTypes.some((t) => typeName.includes(t) || t.includes(typeName))) {
        continue;
      }
      if (!smsShouldFire(rule, loan, today)) continue;

      const due = asDay(loan.fields['Repayment Due Date']);
      const late = due ? daysBetween(due, today) : 0;
      const weekBoundary =
        rule.trigger.kind === 'overdueWeekly' && due ? addDays(due, Math.ceil(late / 7) * 7) : null;

      const message = renderSmsMessage(rule, loan, weekBoundary).trim();
      if (!message) {
        skipped.push({ loan: loan.id, rule: rule.name, reason: 'empty message' });
        continue;
      }
      const to = await farmerPhone(loan);
      if (!to) {
        skipped.push({ loan: loan.id, rule: rule.name, reason: 'no phone' });
        continue;
      }
      plan.push({
        loan: loan.id,
        loanRef: firstVal(loan.fields['Loan ID']) || '',
        farmer: firstVal(loan.fields['Name (from Farmer)']) || '',
        rule: rule.name,
        smsIndex: rule.smsIndex,
        to,
        message,
      });
    }
  }
  return { plan, skipped };
}

async function runSmsJob({ dry = false, forDate } = {}) {
  const ctx = await loadSmsContext();
  const today = forDate || todayEAT();
  const { plan, skipped } = await evaluateSmsDay(ctx, today);

  const errors = [];
  const delivered = [];
  const disabled = !ctx.config.enabled;
  const testMode = ctx.config.mode === 'test';

  if (!dry && !disabled) {
    const testPhone = testMode ? toE164(ctx.config.testPhone) : null;
    for (const item of plan) {
      const to = testMode ? testPhone : item.to;
      if (!to) {
        errors.push({ loan: item.loan, rule: item.rule, error: 'test mode: no test phone configured' });
        continue;
      }
      const body = testMode ? `[TEST] ${item.message}` : item.message;
      try {
        const { status } = await sendAtSms(to, body);
        if (status && !String(status).startsWith('Success')) {
          errors.push({ loan: item.loan, rule: item.rule, to, error: String(status) });
        } else {
          delivered.push(item);
        }
      } catch (e) {
        errors.push({
          loan: item.loan,
          rule: item.rule,
          to,
          error: e?.response?.data?.SMSMessageData?.Message || e.message,
        });
      }
    }

    // Record sends on the loans (audit trail + dedup) in batches of 10 —
    // live mode only; test sends must not mark loans as sent.
    if (!testMode) {
      for (let i = 0; i < delivered.length; i += 10) {
        const records = delivered.slice(i, i + 10).map((item) => ({
          id: item.loan,
          fields: { [`SMS ${item.smsIndex}`]: item.message, [`SMS ${item.smsIndex} date`]: today },
        }));
        try {
          await airtableApi.patch(`/${AIRTABLE_LOANS_TABLE_ID}`, { records });
        } catch (e) {
          errors.push({ batch: records.map((r) => r.id), error: e?.response?.data?.error?.message || e.message });
        }
      }
    }
  }

  return {
    today,
    enabled: ctx.config.enabled,
    mode: ctx.config.mode,
    disabled,
    rules: ctx.rules.length,
    loansEvaluated: ctx.loans.length,
    planned: plan.length,
    sent: dry || disabled ? 0 : delivered.length,
    skipped,
    errors,
    messages: dry ? plan : undefined,
  };
}

app.all('/api/v1/jobs/send-sms', async (req, res) => {
  const auth = String(req.headers.authorization || '');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid cron secret.' });
  }
  if (!AT_API_KEY || !AT_USERNAME) {
    return res.status(503).json({ error: 'SMS_NOT_CONFIGURED', message: 'Missing AT credentials.' });
  }

  const dry = req.query.dry === '1' || req.query.dry === 'true';
  try {
    const result = await runSmsJob({ dry });
    return res.json({ ok: true, dry, ...result });
  } catch (error) {
    console.error('/api/v1/jobs/send-sms error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'JOB_FAILED',
      message: error?.response?.data?.error?.message || error.message,
    });
  }
});

// Ops-only schema listing — same auth as the job endpoint. Used to
// diagnose client-side Airtable renames (tables/fields change names and
// ids are not knowable from the UI).
app.get('/api/v1/jobs/meta-tables', async (req, res) => {
  if (req.query.sample) {
    try {
      const data = await airtableApi
        .get(`/${req.query.sample}`, { params: { maxRecords: 3 } })
        .then((r) => r.data);
      return res.json({
        sample: (data.records || []).map((r) => ({ id: r.id, fields: r.fields })),
      });
    } catch (error) {
      return res
        .status(error?.response?.status || 500)
        .json({ error: error?.response?.data?.error || String(error) });
    }
  }
  const auth = String(req.headers.authorization || '');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid cron secret.' });
  }
  try {
    const { data } = await airtableApi.get(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`
    );
    const tables = (data.tables || []).map((t) => ({
      id: t.id,
      name: t.name,
      fields: (t.fields || []).map((f) => `${f.name} (${f.type})`),
    }));
    return res.json({ tables });
  } catch (error) {
    console.error('/api/v1/jobs/meta-tables error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'META_FAILED',
      message: error?.response?.data?.error?.message || error.message,
    });
  }
});

// ----------------------------------------------------------------------
// Admin SMS management — NetGecko Admin only, powers the /dashboard/sms page.

app.get('/api/v1/sms/rules', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = await listAllRecords(AIRTABLE_SMS_TABLE_ID);
    const rules = (data.records || [])
      .map((r) => {
        const parsed = parseSmsRule(r.fields);
        if (!parsed) return null;
        return {
          id: r.id,
          name: parsed.name,
          smsIndex: parsed.smsIndex,
          triggerWhat: String(r.fields['Trigger (What)'] || ''),
          triggerWhen: String(r.fields['Trigger (When)'] || ''),
          loanTypes: r.fields['Loan type'] || [],
          message: parsed.template,
          fieldSpecs: parsed.fieldSpecs.filter(Boolean),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.smsIndex - b.smsIndex || a.name.localeCompare(b.name));
    return res.json({ rules });
  } catch (error) {
    console.error('/api/v1/sms/rules error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch SMS rules.',
    });
  }
});

app.get('/api/v1/sms/log', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sentFormula = `OR(${Array.from({ length: 20 }, (_, i) => `{SMS ${i + 1} date}`).join(',')})`;
    const data = await listAllRecords(AIRTABLE_LOANS_TABLE_ID, {
      filterByFormula: sentFormula,
      fields: [
        'Loan ID',
        'Name (from Farmer)',
        'Verified Mobile Money Number',
        ...Array.from({ length: 20 }, (_, i) => `SMS ${i + 1}`),
        ...Array.from({ length: 20 }, (_, i) => `SMS ${i + 1} date`),
      ],
    });

    const entries = [];
    for (const loan of data.records || []) {
      for (let n = 1; n <= 20; n += 1) {
        const sentAt = loan.fields[`SMS ${n} date`];
        const message = loan.fields[`SMS ${n}`];
        if (!sentAt || !message) continue;
        entries.push({
          loanId: loan.id,
          loanRef: firstVal(loan.fields['Loan ID']) || '',
          farmer: firstVal(loan.fields['Name (from Farmer)']) || '',
          phone: firstVal(loan.fields['Verified Mobile Money Number']) || '',
          smsIndex: n,
          message: String(message),
          sentAt: String(sentAt),
        });
      }
    }
    entries.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
    return res.json({ entries: entries.slice(0, 200) });
  } catch (error) {
    console.error('/api/v1/sms/log error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch SMS log.',
    });
  }
});

app.get('/api/v1/sms/config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const config = await getSmsConfig();
    return res.json({ config });
  } catch (error) {
    console.error('/api/v1/sms/config error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to fetch SMS config.',
    });
  }
});

app.post('/api/v1/sms/config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const current = await getSmsConfig();
    const body = req.body || {};
    const next = {
      enabled: body.enabled === undefined ? current.enabled : body.enabled === true,
      mode: body.mode === undefined ? current.mode : body.mode === 'live' ? 'live' : 'test',
      testPhone: body.testPhone === undefined ? current.testPhone : String(body.testPhone || ''),
    };
    await airtableApi.patch(`/${AIRTABLE_SMS_TABLE_ID}`, {
      records: [{ id: current.id, fields: { Message: JSON.stringify(next) } }],
    });
    return res.json({ config: { id: current.id, ...next } });
  } catch (error) {
    console.error('/api/v1/sms/config save error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to save SMS config.',
    });
  }
});

// Sends planned for today and the following N days (default 4, max 14).
app.get('/api/v1/sms/schedule', requireAuth, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 4, 1), 14);
    const ctx = await loadSmsContext();
    const base = todayEAT();
    const schedule = [];
    for (let i = 0; i < days; i += 1) {
      const date = addDays(base, i);
      // eslint-disable-next-line no-await-in-loop
      const { plan, skipped } = await evaluateSmsDay(ctx, date);
      schedule.push({ date, planned: plan.length, skipped: skipped.length, messages: plan });
    }
    return res.json({ schedule, config: { enabled: ctx.config.enabled, mode: ctx.config.mode } });
  } catch (error) {
    console.error('/api/v1/sms/schedule error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'AIRTABLE_ERROR',
      message: error?.response?.data?.error?.message || 'Unable to evaluate the SMS schedule.',
    });
  }
});

app.post('/api/v1/sms/run', requireAuth, requireAdmin, async (req, res) => {
  if (!AT_API_KEY || !AT_USERNAME) {
    return res.status(503).json({ error: 'SMS_NOT_CONFIGURED', message: 'Missing AT credentials.' });
  }
  const dry = req.body?.dry === true || req.query.dry === '1' || req.query.dry === 'true';
  const dateParam = String(req.body?.date || req.query.date || '');
  const forDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
  try {
    const result = await runSmsJob({ dry, forDate });
    return res.json({ ok: true, dry, ...result });
  } catch (error) {
    console.error('/api/v1/sms/run error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'JOB_FAILED',
      message: error?.response?.data?.error?.message || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`FPO app server running on http://localhost:${PORT}`);
});
