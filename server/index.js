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

    const form = new URLSearchParams({
      username: AT_USERNAME,
      to: e164,
      message: `Your NetGecko sign-in code is ${code}. It expires in 5 minutes.`,
    });
    if (AT_SENDER_ID) form.set('from', AT_SENDER_ID);

    const { data } = await axios.post(
      'https://api.africastalking.com/version1/messaging',
      form.toString(),
      {
        headers: {
          apiKey: AT_API_KEY,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const smsStatus = data?.SMSMessageData?.Recipients?.[0]?.status;
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

function buildFpoFilter(fpoName) {
  const escaped = fpoName.replace(/'/g, "''");
  return `SEARCH('${escaped}', ARRAYJOIN({Name (from FPO)}, ',')) > 0`;
}

function toAirtableFields(input, fpoId) {
  const fields = { ...input };

  // Link fields expect arrays of record IDs.
  if (fields['Main product sold to Partner'] && typeof fields['Main product sold to Partner'] === 'string') {
    fields['Main product sold to Partner'] = [fields['Main product sold to Partner']];
  }

  if (fpoId) {
    fields.Partner = [fpoId];
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
    'Main Product (1)',
    'Other product (2)',
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

app.get('/api/v1/crops', requireAuth, async (req, res) => {
  try {
    const data = await listAllRecords(AIRTABLE_CROPS_TABLE_ID);

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

const AIRTABLE_VILLAGES_TABLE_ID = process.env.AIRTABLE_VILLAGES_TABLE_ID || 'tbl3PjHhXWSOeCVVv';

app.get('/api/v1/villages', requireAuth, async (req, res) => {
  try {
    const data = await listAllRecords(AIRTABLE_VILLAGES_TABLE_ID);

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

app.listen(PORT, () => {
  console.log(`FPO app server running on http://localhost:${PORT}`);
});
