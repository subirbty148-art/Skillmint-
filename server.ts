import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = fs.existsSync(path.join(process.cwd(), 'firebase-applet-config.json'))
  ? path.join(process.cwd(), 'firebase-applet-config.json')
  : path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(
  fs.readFileSync('/etc/secrets/serviceAccountKey.json', 'utf-8')
);

const adminApp = initializeApp({
  credential: cert(serviceAccount),
  projectId: PROJECT_ID,
});

const adminDb = getFirestore(adminApp);
const PROJECT_ID: string = firebaseConfig.projectId;
const STORAGE_BUCKET: string = firebaseConfig.storageBucket || `${PROJECT_ID}.firebasestorage.app`;
const DATABASE_ID = '(default)';
const BOOTSTRAP_ADMIN_EMAIL = 'subirbty148@gmail.com';
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const FIRESTORE_DOC_NAME_PREFIX = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

async function verifyFirebaseIdToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const emailVerified = Boolean(payload.email_verified);

  if (!uid) {
    throw new Error('Invalid Firebase token subject.');
  }

  return { uid, email, emailVerified };
}

function fromFsValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(fromFsValue);
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      out[k] = fromFsValue(v);
    }
    return out;
  }
  return null;
}

function toFsValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFsValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFsValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFsFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFsValue(v);
  }
  return fields;
}

function decodeFsDoc(docJson: any): { data: Record<string, any>; updateTime: string; name: string } {
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(docJson.fields || {})) {
    data[k] = fromFsValue(v);
  }
  return {
    data,
    updateTime: docJson.updateTime || '',
    name: docJson.name || '',
  };
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fsGetDoc(docPath: string, idToken: string, transaction?: string) {
  const url = new URL(`${FIRESTORE_REST_BASE}/${docPath}`);
  if (transaction) url.searchParams.set('transaction', transaction);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Firestore read failed for ${docPath}`;
    if (res.status === 403) {
      throw new HttpError(403, `Firestore permission denied on "${docPath}": ${msg}`);
    }
    throw new HttpError(res.status, msg);
  }
  return decodeFsDoc(json);
}

async function fsBeginTransaction(idToken: string): Promise<string> {
  const res = await fetch(`${FIRESTORE_REST_BASE}:beginTransaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ options: { readWrite: {} } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.transaction) {
    throw new HttpError(res.status || 500, json?.error?.message || 'Unable to start Firestore transaction.');
  }
  return json.transaction;
}

async function fsCommitTransaction(transaction: string, writes: any[], idToken: string) {
  const res = await fetch(`${FIRESTORE_REST_BASE}:commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ transaction, writes }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || 'Firestore atomic commit failed.';
    if (res.status === 403) {
      throw new HttpError(
        403,
        `Firestore Security Rules denied this atomic transaction (${msg}). Update and deploy Firestore rules to enable course affiliate orders.`
      );
    }
    throw new HttpError(res.status || 500, msg);
  }
  return json;
}

function makeServerId(prefix: string): string {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}_${Date.now()}_${rand}`;
}

function buildCreateWrite(docPath: string, fields: Record<string, any>, timestampFields: string[]) {
  return {
    update: {
      name: `${FIRESTORE_DOC_NAME_PREFIX}/${docPath}`,
      fields: toFsFields(fields),
    },
    currentDocument: { exists: false },
    updateTransforms: timestampFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    })),
  };
}

function buildUpdateWrite(
  docPath: string,
  fields: Record<string, any>,
  updateTime: string,
  timestampFields: string[]
) {
  const fieldPaths = Object.keys(fields);
  return {
    update: {
      name: `${FIRESTORE_DOC_NAME_PREFIX}/${docPath}`,
      fields: toFsFields(fields),
    },
    updateMask: { fieldPaths },
    currentDocument: { updateTime },
    updateTransforms: timestampFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    })),
  };
}

function extractBearerToken(req: express.Request): string {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

function isValidServerId(id: string): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

function isValidBuyerScreenshotUrl(rawUrl: string, buyerUid: string): boolean {
  if (!rawUrl || !isValidServerId(buyerUid)) return false;

  // Allow compressed raster image data URIs generated by the client compressor (no SVG/HTML)
  if (rawUrl.startsWith('data:')) {
    if (rawUrl.length < 64 || rawUrl.length > 250000) return false;
    return /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(rawUrl);
  }

  // Otherwise allow ONLY Firebase Storage download URLs scoped to this project's bucket and buyer's own folder
  if (rawUrl.length < 20 || rawUrl.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'firebasestorage.googleapis.com') {
    return false;
  }

  const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match) return false;

  let bucket = '';
  let objectPath = '';
  try {
    bucket = decodeURIComponent(match[1]);
    objectPath = decodeURIComponent(match[2]);
  } catch {
    return false;
  }

  if (bucket !== STORAGE_BUCKET) return false;

  const expectedPrefix = `payment-screenshots/${buyerUid}/`;
  if (!objectPath.startsWith(expectedPrefix) || objectPath.includes('..')) {
    return false;
  }

  const fileName = objectPath.slice(expectedPrefix.length);
  return /^[a-zA-Z0-9._-]{1,128}$/.test(fileName);
}

async function resolveAuthoritativeCoursePrice(
  courseData: Record<string, any>,
  idToken: string,
  tx: string
): Promise<number> {
  let authoritativePrice = Number(courseData.price || 0);
  if ((!Number.isFinite(authoritativePrice) || authoritativePrice <= 0) && courseData.planIdRequired) {
    const planId = String(courseData.planIdRequired).trim();
    if (isValidServerId(planId)) {
      const planSnap = await fsGetDoc(`plans/${planId}`, idToken, tx);
      if (planSnap) {
        authoritativePrice = Number(planSnap.data.price || 0);
      }
    }
  }
  if (!Number.isFinite(authoritativePrice) || authoritativePrice <= 0) {
    throw new HttpError(400, 'This course does not have a valid authoritative purchase price configured.');
  }
  return Math.round(authoritativePrice * 100) / 100;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, projectId: PROJECT_ID });
  });

  // Server-side cryptographic verification of Firebase ID Token + sole Admin authorization
  app.post('/api/admin/verify-session', async (req, res) => {
    try {
      const idToken = extractBearerToken(req);
      if (!idToken) {
        res.status(401).json({ authorized: false, error: 'Missing Bearer ID token.' });
        return;
      }

      const decoded = await verifyFirebaseIdToken(idToken);
      const isAuthorizedAdmin =
        decoded.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && decoded.emailVerified;

      if (!isAuthorizedAdmin) {
        res.status(403).json({
          authorized: false,
          uid: decoded.uid,
          email: decoded.email,
          error:
            decoded.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && !decoded.emailVerified
              ? 'Administrator email must be verified before accessing the admin dashboard.'
              : 'Account does not have administrator privileges.',
        });
        return;
      }

      res.json({
        authorized: true,
        uid: decoded.uid,
        email: decoded.email,
        method: 'verified-admin-email',
      });
    } catch (err: any) {
      res.status(401).json({
        authorized: false,
        error: err?.message || 'Invalid or expired authentication token.',
      });
    }
  });

  // Trusted Server Course Purchase Creation (price & 50% commission computed server-side)
  app.post('/api/course-orders/create', async (req, res) => {
    try {console.log('COURSE ORDER API REACHED');
      const idToken = extractBearerToken(req);
      if (!idToken) {
        res.status(401).json({ error: 'Missing authentication token.' });
        return;
      }

      const decoded = await verifyFirebaseIdToken(idToken);
      if (!decoded.email || !decoded.emailVerified) {
        res.status(403).json({
          error: 'Please verify your email address before purchasing a course.',
        });
        return;
      }

      const { courseId, method, transactionId, screenshotUrl, referralCode } = req.body || {};

      const cleanCourseId = String(courseId || '').trim();
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanCourseId)) {
        res.status(400).json({ error: 'Invalid course selected.' });
        return;
      }
      if (!['phonepe', 'googlepay', 'paytm'].includes(method)) {
        res.status(400).json({ error: 'Select a valid UPI payment method (PhonePe, Google Pay, or Paytm).' });
        return;
      }

      const cleanTxId = String(transactionId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanTxId.length < 6 || cleanTxId.length > 64) {
        res.status(400).json({ error: 'UPI Transaction ID / UTR must be 6 to 64 alphanumeric characters.' });
        return;
      }

      const cleanScreenshot = String(screenshotUrl || '').trim();
      if (!isValidBuyerScreenshotUrl(cleanScreenshot, decoded.uid)) {
        res.status(400).json({
          error:
            'Invalid payment screenshot. Please upload your payment screenshot directly through the checkout uploader.',
        });
        return;
      }

      const tx = await fsBeginTransaction(idToken);
      const [userSnap, courseSnap, txLockSnap, existingRefSnap] = await Promise.all([
        fsGetDoc(`users/${decoded.uid}`, idToken, tx),
        fsGetDoc(`courses/${cleanCourseId}`, idToken, tx),
        fsGetDoc(`transactionIds/${cleanTxId}`, idToken, tx),
        fsGetDoc(`referrals/${decoded.uid}`, idToken, tx),
      ]);

      if (!userSnap) {
        throw new HttpError(404, 'User profile not found.');
      }
      if (userSnap.data.isBlocked) {
        throw new HttpError(403, 'Your account is suspended. Purchases are disabled.');
      }
      if (!courseSnap || courseSnap.data.isActive === false) {
        throw new HttpError(404, 'Selected course is not available for purchase.');
      }
      if (txLockSnap) {
        throw new HttpError(409, 'This UPI Transaction ID / UTR has already been submitted.');
      }

      const authoritativePrice = await resolveAuthoritativeCoursePrice(courseSnap.data, idToken, tx);

      // Resolve & enforce anti-self-referral and non-manipulable attribution
      const submittedCode = String(referralCode || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      const lockedCode = String(userSnap.data.referredByCode || '').trim().toUpperCase();
      const lockedUid = String(userSnap.data.referredByUid || '').trim();

      let validReferrerUid = '';
      let validReferrerCode = '';
      let validReferrerName = '';

      if (lockedUid && lockedCode) {
        if (submittedCode && submittedCode !== lockedCode) {
          throw new HttpError(
            400,
            `Your account is already attributed to referral code ${lockedCode}. Referral attribution cannot be changed.`
          );
        }
        if (lockedUid !== decoded.uid) {
          const refCodeSnap = await fsGetDoc(`referralCodes/${lockedCode}`, idToken, tx);
          if (refCodeSnap && refCodeSnap.data.active) {
            validReferrerUid = lockedUid;
            validReferrerCode = lockedCode;
            validReferrerName = String(refCodeSnap.data.ownerName || '');
          }
        }
      } else if (submittedCode) {
        if (submittedCode.length < 4 || submittedCode.length > 20) {
          throw new HttpError(400, 'Referral code format is invalid.');
        }
        if (submittedCode === String(userSnap.data.referralCode || '').toUpperCase()) {
          throw new HttpError(400, 'Self-referral is blocked. You cannot use your own referral code.');
        }
        const refCodeSnap = await fsGetDoc(`referralCodes/${submittedCode}`, idToken, tx);
        if (!refCodeSnap || !refCodeSnap.data.active) {
          throw new HttpError(400, 'The entered referral code does not exist or is inactive.');
        }
        if (refCodeSnap.data.ownerUid === decoded.uid) {
          throw new HttpError(400, 'Self-referral is blocked. You cannot refer yourself.');
        }
        validReferrerUid = String(refCodeSnap.data.ownerUid);
        validReferrerCode = String(refCodeSnap.data.code);
        validReferrerName = String(refCodeSnap.data.ownerName || '');
      }

      // Server-computed 50% direct referral commission
      const commissionRate = validReferrerUid ? 0.5 : 0;
      const commissionAmount = validReferrerUid ? Math.round(authoritativePrice * 50) / 100 : 0;
      const platformShare = Math.round((authoritativePrice - commissionAmount) * 100) / 100;

      const orderId = makeServerId('ORD');
      const screenshotStorageType = cleanScreenshot.startsWith('data:')
        ? 'inline_compressed'
        : 'firebase_storage';
      const writes: any[] = [
        buildCreateWrite(
          `transactionIds/${cleanTxId}`,
          {
            txId: cleanTxId,
            paymentId: orderId,
            userId: decoded.uid,
          },
          ['createdAt']
        ),
        buildCreateWrite(
          `courseOrders/${orderId}`,
          {
            id: orderId,
            buyerUid: decoded.uid,
            buyerName: String(userSnap.data.displayName || 'Member').slice(0, 80),
            buyerEmail: String(userSnap.data.email || decoded.email || '').slice(0, 200),
            courseId: cleanCourseId,
            courseTitle: String(courseSnap.data.title || 'Course').slice(0, 120),
            coursePrice: authoritativePrice,
            method,
            transactionId: cleanTxId,
            hasScreenshot: true,
            screenshotStorageType,
            referralCode: validReferrerCode,
            referrerUid: validReferrerUid,
            referrerName: validReferrerName.slice(0, 80),
            commissionRate,
            commissionAmount,
            platformShare,
            commissionStatus: validReferrerUid ? 'pending' : 'none',
            commissionCredited: false,
            status: 'pending',
            adminNote: '',
          },
          ['createdAt', 'updatedAt']
        ),
        buildCreateWrite(
          `courseOrderProofs/${orderId}`,
          {
            orderId,
            buyerUid: decoded.uid,
            screenshotUrl: cleanScreenshot,
            storageType: screenshotStorageType,
          },
          ['createdAt']
        ),
      ];

      if (validReferrerUid && validReferrerCode && !existingRefSnap) {
        writes.push(
          buildCreateWrite(
            `referrals/${decoded.uid}`,
            {
              id: decoded.uid,
              referrerUid: validReferrerUid,
              referrerCode: validReferrerCode,
              referredUid: decoded.uid,
              referredName: String(userSnap.data.displayName || 'Member').slice(0, 80),
              referredEmail: String(userSnap.data.email || decoded.email || '').slice(0, 200),
              status: 'registered',
              rewardAmount: 0,
              qualifyingPlanId: cleanCourseId,
            },
            ['createdAt', 'updatedAt']
          )
        );
      }

      await fsCommitTransaction(tx, writes, idToken);

      res.json({
        ok: true,
        orderId,
        coursePrice: authoritativePrice,
        referralCode: validReferrerCode,
        commissionAmount,
        status: 'pending',
      });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      res.status(status).json({ error: err?.message || 'Unable to submit course order.' });
    }
  });

  // Trusted Admin Course Order Review & Commission Reversal (atomic + idempotent)
  app.post('/api/admin/course-orders/review', async (req, res) => {
    try {
      const idToken = extractBearerToken(req);
      if (!idToken) {
        res.status(401).json({ error: 'Missing Bearer ID token.' });
        return;
      }

      const decoded = await verifyFirebaseIdToken(idToken);
      const isAuthorizedAdmin =
        decoded.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && decoded.emailVerified;
      if (!isAuthorizedAdmin) {
        res.status(403).json({ error: 'Unauthorized: Administrator privileges required.' });
        return;
      }

      const { orderId, decision, adminNote } = req.body || {};
      const cleanOrderId = String(orderId || '').trim();
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanOrderId)) {
        res.status(400).json({ error: 'Invalid order ID.' });
        return;
      }
      if (!['approved', 'rejected', 'refunded', 'cancelled'].includes(decision)) {
        res.status(400).json({ error: 'Invalid review decision.' });
        return;
      }

      const cleanNote = String(adminNote || '').trim().slice(0, 300);
      const tx = await fsBeginTransaction(idToken);

      const orderSnap = await fsGetDoc(`courseOrders/${cleanOrderId}`, idToken, tx);
      if (!orderSnap) {
        throw new HttpError(404, 'Course order not found.');
      }
      const order = orderSnap.data;

      if (decision === 'rejected') {
        if (order.status !== 'pending') {
          throw new HttpError(409, `Order cannot be rejected because it is already ${order.status}.`);
        }

        const notifId = makeServerId('NTF');
        const writes = [
          buildUpdateWrite(
            `courseOrders/${cleanOrderId}`,
            {
              status: 'rejected',
              commissionStatus: 'none',
              commissionCredited: false,
              adminNote: cleanNote || 'Payment verification failed.',
              reviewedBy: decoded.uid,
            },
            orderSnap.updateTime,
            ['reviewedAt', 'updatedAt']
          ),
          buildCreateWrite(
            `notifications/${notifId}`,
            {
              id: notifId,
              userId: String(order.buyerUid),
              title: 'Course Payment Rejected',
              message: `Your ₹${order.coursePrice} payment for ${order.courseTitle} (UTR: ${order.transactionId}) was rejected. ${cleanNote}`.trim().slice(0, 600),
              type: 'warning',
            },
            ['createdAt']
          ),
        ];

        await fsCommitTransaction(tx, writes, idToken);
        res.json({ ok: true, orderId: cleanOrderId, status: 'rejected' });
        return;
      }

      if (decision === 'approved') {
        if (order.status !== 'pending') {
          throw new HttpError(409, `Order is already finalized (${order.status}). Duplicate approval blocked.`);
        }
        if (order.commissionCredited === true) {
          throw new HttpError(409, 'Commission has already been credited for this order.');
        }

        const buyerUid = String(order.buyerUid || '').trim();
        const courseId = String(order.courseId || '').trim();
        if (!isValidServerId(buyerUid) || !isValidServerId(courseId)) {
          throw new HttpError(400, 'Order contains invalid buyer or course identifier.');
        }

        const [buyerSnap, courseSnap, lockSnap, refDocSnap, proofSnap] = await Promise.all([
          fsGetDoc(`users/${buyerUid}`, idToken, tx),
          fsGetDoc(`courses/${courseId}`, idToken, tx),
          fsGetDoc(`commissionLocks/${cleanOrderId}`, idToken, tx),
          fsGetDoc(`referrals/${buyerUid}`, idToken, tx),
          fsGetDoc(`courseOrderProofs/${cleanOrderId}`, idToken, tx),
        ]);

        if (proofSnap && String(proofSnap.data.buyerUid || '') !== buyerUid) {
          throw new HttpError(409, 'Payment proof ownership mismatch. Reject this order instead of approving.');
        }

        const resolvedProofUrl = String(proofSnap?.data?.screenshotUrl || order.screenshotUrl || '').trim();
        if (!isValidBuyerScreenshotUrl(resolvedProofUrl, buyerUid)) {
          throw new HttpError(
            409,
            'Order payment screenshot URL failed trust validation. Reject this order instead of approving.'
          );
        }

        if (!buyerSnap) {
          throw new HttpError(404, 'Buyer user profile not found.');
        }
        if (!courseSnap) {
          throw new HttpError(404, 'Course not found in catalog. Cannot verify authoritative price.');
        }
        if (lockSnap) {
          throw new HttpError(409, 'Idempotency lock exists: commission was already credited for this order.');
        }

        const authoritativePrice = await resolveAuthoritativeCoursePrice(courseSnap.data, idToken, tx);
        const submittedOrderPrice = Math.round(Number(order.coursePrice || 0) * 100) / 100;
        if (!Number.isFinite(submittedOrderPrice) || Math.abs(submittedOrderPrice - authoritativePrice) > 0.01) {
          throw new HttpError(
            409,
            `Submitted order price (₹${submittedOrderPrice}) does not match authoritative course price (₹${authoritativePrice}) in courses/${courseId}. Reject this order instead of approving.`
          );
        }

        const buyerAccess = Array.isArray(buyerSnap.data.courseAccess) ? buyerSnap.data.courseAccess : [];
        const mergedCourses = Array.from(new Set([...buyerAccess, courseId])).slice(0, 50);

        let commission = 0;
        let referrerSnap: { data: Record<string, any>; updateTime: string; name: string } | null = null;
        const referrerUid = String(order.referrerUid || '').trim();

        if (referrerUid && !isValidServerId(referrerUid)) {
          throw new HttpError(400, 'Order contains an invalid referrer identifier.');
        }

        if (referrerUid && referrerUid !== String(order.buyerUid)) {
          referrerSnap = await fsGetDoc(`users/${referrerUid}`, idToken, tx);
          if (referrerSnap && !referrerSnap.data.isBlocked) {
            const sameEmail =
              String(referrerSnap.data.email || '').toLowerCase() ===
              String(buyerSnap.data.email || '').toLowerCase();
            if (!sameEmail) {
              commission = Math.round(authoritativePrice * 50) / 100;
            } else {
              referrerSnap = null;
            }
          } else {
            referrerSnap = null;
          }
        }

        const platformShare = Math.round((authoritativePrice - commission) * 100) / 100;
        const buyerTxId = makeServerId('TX');
        const buyerNotifId = makeServerId('NTF');

        const buyerUpdates: Record<string, any> = {
          courseAccess: mergedCourses,
        };
        if (referrerSnap && !buyerSnap.data.referredByUid && order.referralCode) {
          buyerUpdates.referredByUid = referrerUid;
          buyerUpdates.referredByCode = String(order.referralCode);
        }

        const writes: any[] = [
          buildUpdateWrite(
            `courseOrders/${cleanOrderId}`,
            {
              status: 'approved',
              coursePrice: authoritativePrice,
              commissionRate: commission > 0 ? 0.5 : 0,
              commissionAmount: commission,
              platformShare,
              commissionStatus: commission > 0 ? 'paid' : 'none',
              commissionCredited: commission > 0,
              adminNote: cleanNote || 'Payment verified and course unlocked.',
              reviewedBy: decoded.uid,
            },
            orderSnap.updateTime,
            ['reviewedAt', 'updatedAt']
          ),
          buildUpdateWrite(`users/${order.buyerUid}`, buyerUpdates, buyerSnap.updateTime, ['updatedAt']),
          buildCreateWrite(
            `transactions/${buyerTxId}`,
            {
              id: buyerTxId,
              userId: String(order.buyerUid),
              type: 'plan_activation',
              amount: authoritativePrice,
              balanceType: 'wallet',
              direction: 'credit',
              title: `Course Unlocked · ${order.courseTitle} (UTR ${order.transactionId})`.slice(0, 160),
              referenceId: cleanOrderId,
              status: 'completed',
            },
            ['createdAt']
          ),
          buildCreateWrite(
            `notifications/${buyerNotifId}`,
            {
              id: buyerNotifId,
              userId: String(order.buyerUid),
              title: 'Course Purchase Approved',
              message: `Your payment of ₹${authoritativePrice} for "${order.courseTitle}" is verified. The course is now unlocked.`.slice(0, 600),
              type: 'success',
            },
            ['createdAt']
          ),
        ];

        if (commission > 0 && referrerSnap) {
          const refTxId = makeServerId('TX');
          const refNotifId = makeServerId('NTF');
          const prevRefRewarded = refDocSnap?.data?.status === 'rewarded';
          const nextTotalReferrals = Number(referrerSnap.data.totalReferrals || 0) + (prevRefRewarded ? 0 : 1);

          writes.push(
            buildCreateWrite(
              `commissionLocks/${cleanOrderId}`,
              {
                orderId: cleanOrderId,
                referrerUid,
                buyerUid: String(order.buyerUid),
                commissionAmount: commission,
              },
              ['createdAt']
            ),
            buildUpdateWrite(
              `users/${referrerUid}`,
              {
                walletBalance: Number(referrerSnap.data.walletBalance || 0) + commission,
                totalEarnings: Number(referrerSnap.data.totalEarnings || 0) + commission,
                totalReferrals: nextTotalReferrals,
              },
              referrerSnap.updateTime,
              ['updatedAt']
            ),
            buildCreateWrite(
              `transactions/${refTxId}`,
              {
                id: refTxId,
                userId: referrerUid,
                type: 'referral_reward',
                amount: commission,
                balanceType: 'wallet',
                direction: 'credit',
                title: `50% Course Commission · ${order.courseTitle} (${order.buyerName})`.slice(0, 160),
                referenceId: cleanOrderId,
                status: 'completed',
              },
              ['createdAt']
            ),
            buildCreateWrite(
              `notifications/${refNotifId}`,
              {
                id: refNotifId,
                userId: referrerUid,
                title: '50% Course Referral Commission Credited',
                message: `₹${commission} (50% of ₹${authoritativePrice}) has been credited to your Wallet Balance after ${order.buyerName}'s purchase of "${order.courseTitle}" was verified.`.slice(0, 600),
                type: 'success',
              },
              ['createdAt']
            )
          );

          if (!refDocSnap) {
            writes.push(
              buildCreateWrite(
                `referrals/${buyerUid}`,
                {
                  id: buyerUid,
                  referrerUid,
                  referrerCode: String(order.referralCode || referrerSnap.data.referralCode || ''),
                  referredUid: buyerUid,
                  referredName: String(order.buyerName || buyerSnap.data.displayName || 'Member').slice(0, 80),
                  referredEmail: String(order.buyerEmail || buyerSnap.data.email || '').slice(0, 200),
                  status: 'rewarded',
                  rewardAmount: commission,
                  qualifyingPlanId: courseId,
                },
                ['createdAt', 'updatedAt']
              )
            );
          } else {
            if (refDocSnap.data.referrerUid && String(refDocSnap.data.referrerUid) !== referrerUid) {
              throw new HttpError(409, 'Referral attribution mismatch on existing referral record.');
            }
            writes.push(
              buildUpdateWrite(
                `referrals/${buyerUid}`,
                {
                  status: 'rewarded',
                  rewardAmount: Math.round((Number(refDocSnap.data.rewardAmount || 0) + commission) * 100) / 100,
                  qualifyingPlanId: courseId,
                },
                refDocSnap.updateTime,
                ['updatedAt']
              )
            );
          }
        }

        await fsCommitTransaction(tx, writes, idToken);
        res.json({
          ok: true,
          orderId: cleanOrderId,
          status: 'approved',
          commissionCredited: commission,
          platformShare,
        });
        return;
      }

      // Refunded / Cancelled with atomic commission reversal, explicit deficit tracking & referral sync
      if (order.status !== 'approved') {
        throw new HttpError(409, `Only approved orders can be marked ${decision}. Current status: ${order.status}.`);
      }

      const buyerUid = String(order.buyerUid || '').trim();
      const courseId = String(order.courseId || '').trim();
      if (!isValidServerId(buyerUid) || !isValidServerId(courseId)) {
        throw new HttpError(400, 'Order contains invalid buyer or course identifier.');
      }

      const [buyerSnap, refDocSnap] = await Promise.all([
        fsGetDoc(`users/${buyerUid}`, idToken, tx),
        fsGetDoc(`referrals/${buyerUid}`, idToken, tx),
      ]);
      if (!buyerSnap) {
        throw new HttpError(404, 'Buyer profile not found.');
      }

      const reversalTargetAmount =
        order.commissionCredited === true && Number(order.commissionAmount || 0) > 0
          ? Math.round(Number(order.commissionAmount) * 100) / 100
          : 0;
      const currentCourses = Array.isArray(buyerSnap.data.courseAccess) ? buyerSnap.data.courseAccess : [];
      const nextCourses = currentCourses.filter((cid: string) => cid !== courseId);
      const buyerNotifId = makeServerId('NTF');

      let recoveredAmount = 0;
      let unrecoveredDeficit = reversalTargetAmount;
      const writes: any[] = [];

      if (reversalTargetAmount > 0 && order.referrerUid) {
        const referrerUid = String(order.referrerUid).trim();
        const referrerSnap = isValidServerId(referrerUid)
          ? await fsGetDoc(`users/${referrerUid}`, idToken, tx)
          : null;

        if (referrerSnap) {
          const currentWallet = Math.max(0, Number(referrerSnap.data.walletBalance || 0));
          const currentEarnings = Math.max(0, Number(referrerSnap.data.totalEarnings || 0));
          recoveredAmount = Math.round(Math.min(currentWallet, reversalTargetAmount) * 100) / 100;
          unrecoveredDeficit = Math.round(Math.max(0, reversalTargetAmount - recoveredAmount) * 100) / 100;
          const nextWallet = Math.round(Math.max(0, currentWallet - recoveredAmount) * 100) / 100;
          const nextEarnings = Math.round(Math.max(0, currentEarnings - reversalTargetAmount) * 100) / 100;

          let nextTotalReferrals = Number(referrerSnap.data.totalReferrals || 0);
          if (refDocSnap && String(refDocSnap.data.referrerUid || '') === referrerUid) {
            const prevRefReward = Math.max(0, Number(refDocSnap.data.rewardAmount || 0));
            const nextRefReward = Math.round(Math.max(0, prevRefReward - reversalTargetAmount) * 100) / 100;
            const wasRewarded = refDocSnap.data.status === 'rewarded';
            const stillRewarded = nextRefReward > 0;

            if (wasRewarded && !stillRewarded) {
              nextTotalReferrals = Math.max(0, nextTotalReferrals - 1);
            }

            writes.push(
              buildUpdateWrite(
                `referrals/${buyerUid}`,
                {
                  status: stillRewarded ? 'rewarded' : 'registered',
                  rewardAmount: nextRefReward,
                  qualifyingPlanId: stillRewarded ? String(refDocSnap.data.qualifyingPlanId || '') : '',
                },
                refDocSnap.updateTime,
                ['updatedAt']
              )
            );
          }

          writes.push(
            buildUpdateWrite(
              `users/${referrerUid}`,
              {
                walletBalance: nextWallet,
                totalEarnings: nextEarnings,
                totalReferrals: nextTotalReferrals,
              },
              referrerSnap.updateTime,
              ['updatedAt']
            )
          );

          if (recoveredAmount > 0) {
            const revTxId = makeServerId('TX');
            writes.push(
              buildCreateWrite(
                `transactions/${revTxId}`,
                {
                  id: revTxId,
                  userId: referrerUid,
                  type: 'admin_debit',
                  amount: recoveredAmount,
                  balanceType: 'wallet',
                  direction: 'debit',
                  title: (
                    unrecoveredDeficit > 0
                      ? `Commission Reversed (${decision}, Partial) · ${order.courseTitle}`
                      : `Commission Reversed (${decision}) · ${order.courseTitle}`
                  ).slice(0, 160),
                  referenceId: cleanOrderId,
                  status: 'completed',
                },
                ['createdAt']
              )
            );
          }

          if (unrecoveredDeficit > 0) {
            const deficitTxId = makeServerId('TX');
            writes.push(
              buildCreateWrite(
                `transactions/${deficitTxId}`,
                {
                  id: deficitTxId,
                  userId: referrerUid,
                  type: 'admin_debit',
                  amount: unrecoveredDeficit,
                  balanceType: 'wallet',
                  direction: 'debit',
                  title: `Unrecovered Commission Deficit (${decision}) · ${order.courseTitle}`.slice(0, 160),
                  referenceId: cleanOrderId,
                  status: 'pending',
                },
                ['createdAt']
              )
            );
          }

          const refNotifId = makeServerId('NTF');
          const deficitNotice =
            unrecoveredDeficit > 0
              ? ` ₹${recoveredAmount} was recovered from your wallet and ₹${unrecoveredDeficit} was recorded as an unrecovered commission deficit (already withdrawn).`
              : '';
          writes.push(
            buildCreateWrite(
              `notifications/${refNotifId}`,
              {
                id: refNotifId,
                userId: referrerUid,
                title: 'Referral Commission Reversed',
                message: `₹${reversalTargetAmount} commission from ${order.buyerName}'s order of "${order.courseTitle}" was reversed because the order was ${decision}.${deficitNotice}`.slice(0, 600),
                type: 'warning',
              },
              ['createdAt']
            )
          );
        }
      } else {
        unrecoveredDeficit = 0;
      }

      writes.unshift(
        buildUpdateWrite(
          `courseOrders/${cleanOrderId}`,
          {
            status: decision,
            commissionStatus: reversalTargetAmount > 0 ? 'reversed' : 'none',
            commissionCredited: false,
            reversalTargetAmount,
            reversalRecoveredAmount: recoveredAmount,
            reversalUnrecoveredAmount: unrecoveredDeficit,
            adminNote: cleanNote || `Order ${decision} and access revoked.`,
            reviewedBy: decoded.uid,
          },
          orderSnap.updateTime,
          ['reversedAt', 'updatedAt']
        ),
        buildUpdateWrite(
          `users/${buyerUid}`,
          { courseAccess: nextCourses },
          buyerSnap.updateTime,
          ['updatedAt']
        ),
        buildCreateWrite(
          `notifications/${buyerNotifId}`,
          {
            id: buyerNotifId,
            userId: buyerUid,
            title: `Course Order ${decision === 'refunded' ? 'Refunded' : 'Cancelled'}`,
            message: `Your order for "${order.courseTitle}" (${cleanOrderId}) was marked ${decision}. ${cleanNote}`.trim().slice(0, 600),
            type: 'warning',
          },
          ['createdAt']
        )
      );

      await fsCommitTransaction(tx, writes, idToken);
      res.json({
        ok: true,
        orderId: cleanOrderId,
        status: decision,
        reversedCommission: reversalTargetAmount,
        recoveredAmount,
        unrecoveredDeficit,
      });
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 500;
      res.status(status).json({ error: err?.message || 'Unable to process course order review.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SkillMint server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
