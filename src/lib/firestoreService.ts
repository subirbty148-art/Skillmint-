import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { DEFAULT_COURSES, DEFAULT_PLANS, DEFAULT_SETTINGS } from '../data/defaults';
import { auth, db, handleFirestoreError, OperationType, storage } from './firebase';
import {
  Course,
  MembershipPlan,
  NotificationItem,
  PaymentMethod,
  PlatformSettings,
  UserProfile,
} from '../types/models';

const REFERRAL_STORAGE_KEY = 'skillmint_ref_code';

export function saveCapturedReferralCode(rawCode: string): string {
  const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length >= 4 && clean.length <= 20) {
    try {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, clean);
    } catch {
      // Ignore storage access restrictions
    }
    return clean;
  }
  return '';
}

export function getCapturedReferralCode(): string {
  try {
    return window.localStorage.getItem(REFERRAL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function captureReferralCodeFromSearch(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const ref = params.get('ref');
    if (ref) {
      return saveCapturedReferralCode(ref);
    }
  } catch {
    // Ignore malformed search string
  }
  return '';
}

export function sanitizeId(input: string): string {
  return input.trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

export function generateRecordId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${Date.now()}_${rand}`;
}

export async function compressImageToDataUrlAndBlob(
  file: File,
  maxWidth = 900,
  quality = 0.76
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file selected.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image.'));
              return;
            }
            resolve({ blob, dataUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadImageAsset(file: File, storagePath: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a valid image file (PNG, JPG, WEBP).');
  }
  const { blob, dataUrl } = await compressImageToDataUrlAndBlob(file, 880, 0.74);

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (err) {
    console.warn('Firebase Storage upload unavailable, using compressed inline asset fallback:', err);
    if (dataUrl.length > 230000) {
      const smaller = await compressImageToDataUrlAndBlob(file, 560, 0.6);
      if (smaller.dataUrl.length > 230000) {
        throw new Error('Image is too large. Please select a smaller screenshot under 2 MB.');
      }
      return smaller.dataUrl;
    }
    return dataUrl;
  }
}

export async function uploadVideoAsset(
  file: File,
  storagePath: string
): Promise<string> {
  if (
    file.type !== 'video/mp4' &&
    !file.name.toLowerCase().endsWith('.mp4')
  ) {
    throw new Error('Please upload an MP4 video.');
  }

  const video = document.createElement('video');
  video.preload = 'metadata';

  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          reject(new Error('Invalid video duration.'));
        } else if (video.duration > 600) {
          reject(new Error('Video must be 10 minutes or less.'));
        } else {
          resolve();
        }
      };

      video.onerror = () => reject(new Error('Unable to read video.'));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: 'video/mp4',
  });

  return await getDownloadURL(storageRef);
}

export async function lookupReferralCode(code: string): Promise<{
  code: string;
  ownerUid: string;
  ownerName: string;
  active: boolean;
} | null> {
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanCode.length < 4 || cleanCode.length > 20) return null;
  const path = `referralCodes/${cleanCode}`;
  try {
    const snap = await getDoc(doc(db, 'referralCodes', cleanCode));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      code: data.code,
      ownerUid: data.ownerUid,
      ownerName: data.ownerName,
      active: Boolean(data.active),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createOrLoadUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  referralCodeInput?: string;
}): Promise<UserProfile> {
  const userRef = doc(db, 'users', params.uid);
  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      return existingSnap.data() as UserProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${params.uid}`);
  }

  const safeName = (params.displayName || params.email.split('@')[0] || 'Member').trim().slice(0, 80);
  const cleanUidUpper = params.uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (cleanUidUpper + 'ABCDEF').slice(0, 6);
  const uniqueUserId = `SM-${suffix}`;
  const myReferralCode = `SM${suffix}`;

  let referredByCode = '';
  let referredByUid = '';
  const candidateReferralCode = (params.referralCodeInput || getCapturedReferralCode() || '').trim();

  if (candidateReferralCode) {
    const refLookup = await lookupReferralCode(candidateReferralCode);
    if (refLookup && refLookup.active && refLookup.ownerUid !== params.uid) {
      referredByCode = refLookup.code;
      referredByUid = refLookup.ownerUid;
    }
  }

  const batch = writeBatch(db);
  const now = serverTimestamp();

  const newUserDoc: Record<string, any> = {
    uid: params.uid,
    uniqueUserId,
    displayName: safeName.length >= 2 ? safeName : 'SkillMint Member',
    email: params.email.slice(0, 200),
    phone: '',
    upiId: '',
    referralCode: myReferralCode,
    referredByCode,
    referredByUid,
    walletBalance: 0,
    bonusBalance: 0,
    totalEarnings: 0,
    totalReferrals: 0,
    activePlanId: '',
    activePlanName: '',
    courseAccess: [],
    isBlocked: false,
    role: 'user',
    createdAt: now,
    updatedAt: now,
  };

  batch.set(userRef, newUserDoc);
  batch.set(doc(db, 'referralCodes', myReferralCode), {
    code: myReferralCode,
    ownerUid: params.uid,
    ownerName: newUserDoc.displayName,
    active: true,
    createdAt: now,
  });

  if (referredByUid && referredByCode) {
    batch.set(doc(db, 'referrals', params.uid), {
      id: params.uid,
      referrerUid: referredByUid,
      referrerCode: referredByCode,
      referredUid: params.uid,
      referredName: newUserDoc.displayName,
      referredEmail: newUserDoc.email,
      status: 'registered',
      rewardAmount: 0,
      qualifyingPlanId: '',
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    await batch.commit();
    const createdSnap = await getDoc(userRef);
    return createdSnap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function updateOwnProfile(
  uid: string,
  updates: { displayName: string; phone: string; upiId: string }
): Promise<void> {
  const cleanName = updates.displayName.trim().slice(0, 80);
  if (cleanName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: cleanName,
      phone: updates.phone.trim().slice(0, 20),
      upiId: updates.upiId.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedInitialCatalogIfAdmin(): Promise<void> {
  try {
    const [plansSnap, coursesSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'plans')),
      getDocs(collection(db, 'courses')),
      getDoc(doc(db, 'settings', 'platform')),
    ]);

    const batch = writeBatch(db);
    let hasWrites = false;
    const now = serverTimestamp();

    if (plansSnap.empty) {
      for (const plan of DEFAULT_PLANS) {
        batch.set(doc(db, 'plans', plan.id), {
          ...plan,
          updatedAt: now,
        });
      }
      hasWrites = true;
    }

    if (coursesSnap.empty) {
      for (const course of DEFAULT_COURSES) {
        batch.set(doc(db, 'courses', course.id), {
          ...course,
          createdAt: now,
          updatedAt: now,
        });
      }
      hasWrites = true;
    }

    if (!settingsSnap.exists()) {
      batch.set(doc(db, 'settings', 'platform'), {
        ...DEFAULT_SETTINGS,
        updatedAt: now,
      });
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (error) {
    console.warn('Catalog seed skipped or insufficient permissions:', error);
  }
}

export async function submitPaymentProof(params: {
  user: UserProfile;
  plan: MembershipPlan;
  method: PaymentMethod;
  transactionId: string;
  screenshotFile: File;
}): Promise<string> {
  const cleanTxId = params.transactionId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleanTxId.length < 6 || cleanTxId.length > 64) {
    throw new Error('Transaction ID / UTR must be 6 to 64 alphanumeric characters.');
  }

  // Ensure plan exists in live Firestore (required by security rule)
  const planSnap = await getDoc(doc(db, 'plans', params.plan.id));
  if (!planSnap.exists()) {
    throw new Error(
      'Plans are not yet published in Firestore. Please ask the administrator to sign in to /admin once to initialize the catalog.'
    );
  }

  // Duplicate UTR / Transaction ID check
  const txLockRef = doc(db, 'transactionIds', cleanTxId);
  const txLockSnap = await getDoc(txLockRef);
  if (txLockSnap.exists()) {
    throw new Error('This UPI Transaction ID has already been submitted. Duplicate UTRs are not permitted.');
  }

  const paymentId = generateRecordId('PAY');
  const screenshotUrl = await uploadImageAsset(
    params.screenshotFile,
    `payment-screenshots/${params.user.uid}/${paymentId}.jpg`
  );

  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.set(txLockRef, {
    txId: cleanTxId,
    paymentId,
    userId: params.user.uid,
    createdAt: now,
  });

  batch.set(doc(db, 'payments', paymentId), {
    id: paymentId,
    userId: params.user.uid,
    userName: params.user.displayName.slice(0, 80),
    userEmail: params.user.email.slice(0, 200),
    planId: params.plan.id,
    planName: params.plan.name.slice(0, 80),
    amount: params.plan.price,
    bonusAmount: params.plan.bonus,
    method: params.method,
    transactionId: cleanTxId,
    screenshotUrl,
    status: 'pending',
    adminNote: '',
    createdAt: now,
    updatedAt: now,
  });

  try {
    await batch.commit();
    return paymentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payments/${paymentId}`);
  }
}

export async function submitWithdrawalRequest(params: {
  user: UserProfile;
  amount: number;
  upiId: string;
  minWithdrawal: number;
  pendingHoldAmount: number;
}): Promise<string> {
  const cleanAmount = Math.floor(Number(params.amount));
  const cleanUpi = params.upiId.trim();

  if (isNaN(cleanAmount) || cleanAmount < params.minWithdrawal) {
    throw new Error(`Minimum withdrawal amount is ₹${params.minWithdrawal}.`);
  }
  const availableAfterHold = params.user.walletBalance - params.pendingHoldAmount;
  if (cleanAmount > availableAfterHold) {
    throw new Error(
      `Insufficient available wallet balance. Available after pending requests: ₹${Math.max(0, availableAfterHold)}.`
    );
  }
  if (!cleanUpi.includes('@') || cleanUpi.length < 5 || cleanUpi.length > 100) {
    throw new Error('Please enter a valid UPI ID (example: username@okicici).');
  }

  const withdrawalId = generateRecordId('WDR');
  const now = serverTimestamp();

  try {
    await setDoc(doc(db, 'withdrawals', withdrawalId), {
      id: withdrawalId,
      userId: params.user.uid,
      userName: params.user.displayName.slice(0, 80),
      userEmail: params.user.email.slice(0, 200),
      amount: cleanAmount,
      upiId: cleanUpi,
      status: 'pending',
      adminNote: '',
      payoutRef: '',
      createdAt: now,
      updatedAt: now,
    });
    return withdrawalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `withdrawals/${withdrawalId}`);
  }
}

// --- Admin Atomic Actions ---

export async function adminReviewPayment(params: {
  paymentId: string;
  decision: 'approved' | 'rejected';
  adminUid: string;
  adminNote: string;
}): Promise<void> {
  const paymentRef = doc(db, 'payments', params.paymentId);
  try {
    await runTransaction(db, async (tx) => {
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists()) {
        throw new Error('Payment document not found.');
      }
      const payment = paymentSnap.data();
      if (payment.status !== 'pending') {
        throw new Error(`Payment is already ${payment.status}.`);
      }

      const now = serverTimestamp();

      if (params.decision === 'rejected') {
        tx.update(paymentRef, {
          status: 'rejected',
          adminNote: (params.adminNote || 'Payment proof could not be verified.').slice(0, 300),
          reviewedBy: params.adminUid,
          reviewedAt: now,
          updatedAt: now,
        });

        const notifId = generateRecordId('NTF');
        tx.set(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: payment.userId,
          title: 'Payment Verification Update',
          message: `Your payment of ₹${payment.amount} (UTR: ${payment.transactionId}) was rejected. ${params.adminNote || ''}`.trim().slice(0, 600),
          type: 'warning',
          createdAt: now,
        });
        return;
      }

      const userRef = doc(db, 'users', payment.userId);
      const planRef = doc(db, 'plans', payment.planId);
      const referralRef = doc(db, 'referrals', payment.userId);

      const [userSnap, planSnap, referralSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(planRef),
        tx.get(referralRef),
      ]);

      if (!userSnap.exists()) throw new Error('Target user profile not found.');
      if (!planSnap.exists()) throw new Error('Target membership plan not found.');

      const user = userSnap.data() as UserProfile;
      const plan = planSnap.data() as MembershipPlan;

      let referrerSnap: any = null;
      if (
        referralSnap.exists() &&
        referralSnap.data().status === 'registered' &&
        referralSnap.data().referrerUid &&
        referralSnap.data().referrerUid !== user.uid
      ) {
        referrerSnap = await tx.get(doc(db, 'users', referralSnap.data().referrerUid));
      }

      const mergedCourses = Array.from(new Set([...(user.courseAccess || []), ...(plan.courseIds || [])])).slice(0, 50);
      const planBonus = Number(plan.bonus || 0);

      tx.update(paymentRef, {
        status: 'approved',
        adminNote: (params.adminNote || 'Verified and activated.').slice(0, 300),
        reviewedBy: params.adminUid,
        reviewedAt: now,
        updatedAt: now,
      });

      tx.update(userRef, {
        activePlanId: plan.id,
        activePlanName: plan.name,
        courseAccess: mergedCourses,
        bonusBalance: Number(user.bonusBalance || 0) + planBonus,
        totalEarnings: Number(user.totalEarnings || 0) + planBonus,
        updatedAt: now,
      });

      const activationTxId = generateRecordId('TX');
      tx.set(doc(db, 'transactions', activationTxId), {
        id: activationTxId,
        userId: user.uid,
        type: 'plan_activation',
        amount: Number(payment.amount),
        balanceType: 'wallet',
        direction: 'credit',
        title: `${plan.name} Activated (UTR ${payment.transactionId})`.slice(0, 160),
        referenceId: payment.id,
        status: 'completed',
        createdAt: now,
      });

      if (planBonus > 0) {
        const bonusTxId = generateRecordId('TX');
        tx.set(doc(db, 'transactions', bonusTxId), {
          id: bonusTxId,
          userId: user.uid,
          type: 'plan_bonus',
          amount: planBonus,
          balanceType: 'bonus',
          direction: 'credit',
          title: `${plan.name} Membership Bonus`.slice(0, 160),
          referenceId: payment.id,
          status: 'completed',
          createdAt: now,
        });
      }

      const userNotifId = generateRecordId('NTF');
      tx.set(doc(db, 'notifications', userNotifId), {
        id: userNotifId,
        userId: user.uid,
        title: `${plan.name} Activated`,
        message: `Your payment of ₹${payment.amount} is verified. ₹${planBonus} bonus and ${plan.courseIds.length} course(s) are now unlocked.`.slice(0, 600),
        type: 'success',
        createdAt: now,
      });

      // Process verified referral reward atomically if applicable
      if (referrerSnap && referrerSnap.exists()) {
        const referrer = referrerSnap.data() as UserProfile;
        const reward = Number(plan.referralReward || 0);
        if (!referrer.isBlocked && reward > 0) {
          tx.update(referralRef, {
            status: 'rewarded',
            rewardAmount: reward,
            qualifyingPlanId: plan.id,
            updatedAt: now,
          });

          tx.update(doc(db, 'users', referrer.uid), {
            walletBalance: Number(referrer.walletBalance || 0) + reward,
            totalEarnings: Number(referrer.totalEarnings || 0) + reward,
            totalReferrals: Number(referrer.totalReferrals || 0) + 1,
            updatedAt: now,
          });

          const refTxId = generateRecordId('TX');
          tx.set(doc(db, 'transactions', refTxId), {
            id: refTxId,
            userId: referrer.uid,
            type: 'referral_reward',
            amount: reward,
            balanceType: 'wallet',
            direction: 'credit',
            title: `Verified Referral Reward · ${user.displayName}`.slice(0, 160),
            referenceId: referralRef.id,
            status: 'completed',
            createdAt: now,
          });

          const refNotifId = generateRecordId('NTF');
          tx.set(doc(db, 'notifications', refNotifId), {
            id: refNotifId,
            userId: referrer.uid,
            title: 'Referral Reward Credited',
            message: `₹${reward} has been added to your Wallet Balance after ${user.displayName}'s ${plan.name} payment was verified.`.slice(0, 600),
            type: 'success',
            createdAt: now,
          });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payments/${params.paymentId}`);
  }
}

export async function adminReviewWithdrawal(params: {
  withdrawalId: string;
  decision: 'approved' | 'rejected';
  adminUid: string;
  payoutRef?: string;
  adminNote?: string;
}): Promise<void> {
  const withdrawalRef = doc(db, 'withdrawals', params.withdrawalId);
  try {
    await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(withdrawalRef);
      if (!wSnap.exists()) throw new Error('Withdrawal request not found.');
      const withdrawal = wSnap.data();
      if (withdrawal.status !== 'pending') {
        throw new Error(`Withdrawal is already ${withdrawal.status}.`);
      }

      const now = serverTimestamp();

      if (params.decision === 'rejected') {
        tx.update(withdrawalRef, {
          status: 'rejected',
          adminNote: (params.adminNote || 'Withdrawal request declined by admin.').slice(0, 300),
          payoutRef: '',
          reviewedBy: params.adminUid,
          reviewedAt: now,
          updatedAt: now,
        });

        const notifId = generateRecordId('NTF');
        tx.set(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: withdrawal.userId,
          title: 'Withdrawal Request Declined',
          message: `Your withdrawal request of ₹${withdrawal.amount} was declined. ${params.adminNote || ''}`.trim().slice(0, 600),
          type: 'warning',
          createdAt: now,
        });
        return;
      }

      const userRef = doc(db, 'users', withdrawal.userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User record not found.');
      const user = userSnap.data() as UserProfile;

      if (Number(user.walletBalance || 0) < Number(withdrawal.amount)) {
        throw new Error('User wallet balance is lower than the requested withdrawal amount.');
      }

      tx.update(withdrawalRef, {
        status: 'approved',
        payoutRef: (params.payoutRef || 'UPI-PAID').slice(0, 80),
        adminNote: (params.adminNote || 'Payout sent to UPI ID.').slice(0, 300),
        reviewedBy: params.adminUid,
        reviewedAt: now,
        updatedAt: now,
      });

      tx.update(userRef, {
        walletBalance: Number(user.walletBalance) - Number(withdrawal.amount),
        updatedAt: now,
      });

      const txId = generateRecordId('TX');
      tx.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: user.uid,
        type: 'withdrawal',
        amount: Number(withdrawal.amount),
        balanceType: 'wallet',
        direction: 'debit',
        title: `UPI Withdrawal (${withdrawal.upiId})`.slice(0, 160),
        referenceId: withdrawal.id,
        status: 'completed',
        createdAt: now,
      });

      const notifId = generateRecordId('NTF');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: user.uid,
        title: 'Withdrawal Paid',
        message: `₹${withdrawal.amount} has been transferred to ${withdrawal.upiId} (Ref: ${params.payoutRef || 'UPI-PAID'}).`.slice(0, 600),
        type: 'success',
        createdAt: now,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `withdrawals/${params.withdrawalId}`);
  }
}

export async function adminSavePlan(plan: MembershipPlan): Promise<void> {
  const path = `plans/${plan.id}`;
  try {
    await setDoc(doc(db, 'plans', plan.id), {
      id: sanitizeId(plan.id),
      name: plan.name.trim().slice(0, 80),
      tagline: (plan.tagline || '').trim().slice(0, 160),
      price: Number(plan.price),
      bonus: Number(plan.bonus),
      referralReward: Number(plan.referralReward),
      courseIds: plan.courseIds.slice(0, 20),
      conditions: plan.conditions.filter((c) => c.trim().length > 0).slice(0, 20),
      isActive: Boolean(plan.isActive),
      sortOrder: Number(plan.sortOrder || 1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminSaveCourse(course: Course, isNew: boolean): Promise<void> {
  const cleanId = sanitizeId(course.id || generateRecordId('course'));
  const path = `courses/${cleanId}`;
  try {
    const payload: Record<string, any> = {
      id: cleanId,
      title: course.title.trim().slice(0, 120),
      description: course.description.trim().slice(0, 1000),
      imageUrl: course.imageUrl.trim(),
      category: course.category.trim().slice(0, 60),
      instructor: course.instructor.trim().slice(0, 80),
      planIdRequired: (course.planIdRequired || '').trim().slice(0, 64),
      lessons: (course.lessons || []).slice(0, 30),
      isActive: Boolean(course.isActive),
      createdAt: isNew || !course.createdAt ? serverTimestamp() : course.createdAt,
      updatedAt: serverTimestamp(),
    };

    const parsedPrice = Number(course.price);
    if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
      payload.price = Math.round(parsedPrice * 100) / 100;
    } else if (course.price !== undefined) {
      payload.price = 0;
    }

    if (course.qrCodeUrl !== undefined) {
      payload.qrCodeUrl = course.qrCodeUrl.trim().slice(0, 250000);
    }
    if (course.upiId !== undefined) {
      payload.upiId = course.upiId.trim().slice(0, 100);
    }

    await setDoc(doc(db, 'courses', cleanId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminDeleteCourse(courseId: string): Promise<void> {
  const path = `courses/${courseId}`;
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function adminSaveSettings(settings: PlatformSettings): Promise<void> {
  const path = 'settings/platform';
  try {
    await setDoc(doc(db, 'settings', 'platform'), {
      siteName: settings.siteName.trim().slice(0, 60),
      supportEmail: settings.supportEmail.trim().slice(0, 160),
      supportPhone: (settings.supportPhone || '').trim().slice(0, 30),
      minWithdrawal: Math.max(1, Number(settings.minWithdrawal || 100)),
      referralBonusDefault: Math.max(0, Number(settings.referralBonusDefault || 50)),
      referralConditionSummary: settings.referralConditionSummary.trim().slice(0, 500),
      phonepeUpiId: (settings.phonepeUpiId || '').trim().slice(0, 100),
      phonepeQrUrl: (settings.phonepeQrUrl || '').trim().slice(0, 250000),
      gpayUpiId: (settings.gpayUpiId || '').trim().slice(0, 100),
      gpayQrUrl: (settings.gpayQrUrl || '').trim().slice(0, 250000),
      paytmUpiId: (settings.paytmUpiId || '').trim().slice(0, 100),
      paytmQrUrl: (settings.paytmQrUrl || '').trim().slice(0, 250000),
      announcementText: (settings.announcementText || '').trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminToggleUserBlock(uid: string, isBlocked: boolean): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      isBlocked,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminAdjustUserBalance(params: {
  targetUid: string;
  balanceType: 'wallet' | 'bonus';
  direction: 'credit' | 'debit';
  amount: number;
  reason: string;
}): Promise<void> {
  const amount = Number(params.amount);
  if (isNaN(amount) || amount <= 0) throw new Error('Adjustment amount must be positive.');
  const userRef = doc(db, 'users', params.targetUid);
  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as UserProfile;
      const now = serverTimestamp();
      const currentVal = params.balanceType === 'wallet' ? Number(user.walletBalance || 0) : Number(user.bonusBalance || 0);
      const nextVal = params.direction === 'credit' ? currentVal + amount : Math.max(0, currentVal - amount);

      tx.update(userRef, {
        [params.balanceType === 'wallet' ? 'walletBalance' : 'bonusBalance']: nextVal,
        totalEarnings:
          params.direction === 'credit' ? Number(user.totalEarnings || 0) + amount : Number(user.totalEarnings || 0),
        updatedAt: now,
      });

      const txId = generateRecordId('TX');
      tx.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: user.uid,
        type: params.direction === 'credit' ? 'admin_credit' : 'admin_debit',
        amount,
        balanceType: params.balanceType,
        direction: params.direction,
        title: params.reason.trim().slice(0, 160) || 'Admin Balance Adjustment',
        referenceId: txId,
        status: 'completed',
        createdAt: now,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.targetUid}`);
  }
}

export async function adminUpdateUserCourseAccess(uid: string, courseAccess: string[]): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      courseAccess: courseAccess.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}


export async function adminSendNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: NotificationItem['type'];
}): Promise<void> {
  const id = generateRecordId('NTF');
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      userId: params.userId.trim() || 'all',
      title: params.title.trim().slice(0, 120),
      message: params.message.trim().slice(0, 600),
      type: params.type,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${id}`);
  }
}

export async function fetchAllReferralsForUser(uid: string) {
  const path = 'referrals';
  try {
    const q = query(collection(db, 'referrals'), where('referrerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminReviewReferral(params: {
  referralId: string;
  decision: 'rewarded' | 'rejected';
  rewardAmount: number;
}): Promise<void> {
  const refDoc = doc(db, 'referrals', params.referralId);
  try {
    await runTransaction(db, async (tx) => {
      const refSnap = await tx.get(refDoc);
      if (!refSnap.exists()) throw new Error('Referral record not found.');
      const referral = refSnap.data();

      if (referral.status === 'rewarded' || referral.status === 'rejected') {
        throw new Error(`Referral is already ${referral.status}.`);
      }

      const now = serverTimestamp();

      if (params.decision === 'rejected') {
        tx.update(refDoc, {
          status: 'rejected',
          rewardAmount: 0,
          qualifyingPlanId: referral.qualifyingPlanId || '',
          updatedAt: now,
        });
        return;
      }

      const amount = Math.max(1, Number(params.rewardAmount || 0));
      const referrerRef = doc(db, 'users', referral.referrerUid);
      const referrerSnap = await tx.get(referrerRef);
      if (!referrerSnap.exists()) throw new Error('Referrer user not found.');
      const referrer = referrerSnap.data() as UserProfile;

      tx.update(refDoc, {
        status: 'rewarded',
        rewardAmount: amount,
        qualifyingPlanId: referral.qualifyingPlanId || 'manual_admin',
        updatedAt: now,
      });

      tx.update(referrerRef, {
        walletBalance: Number(referrer.walletBalance || 0) + amount,
        totalEarnings: Number(referrer.totalEarnings || 0) + amount,
        totalReferrals: Number(referrer.totalReferrals || 0) + 1,
        updatedAt: now,
      });

      const txId = generateRecordId('TX');
      tx.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: referrer.uid,
        type: 'referral_reward',
        amount,
        balanceType: 'wallet',
        direction: 'credit',
        title: `Verified Referral Reward · ${referral.referredName}`.slice(0, 160),
        referenceId: referral.id,
        status: 'completed',
        createdAt: now,
      });

      const notifId = generateRecordId('NTF');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: referrer.uid,
        title: 'Referral Reward Credited',
        message: `₹${amount} has been credited to your Wallet Balance for referring ${referral.referredName}.`.slice(0, 600),
        type: 'success',
        createdAt: now,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `referrals/${params.referralId}`);
  }
}

async function uploadCoursePaymentScreenshot(
  file: File,
  storagePath: string
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a valid image file (PNG, JPG, WEBP).');
  }
  const { blob, dataUrl } = await compressImageToDataUrlAndBlob(file, 880, 0.74);

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(storageRef);
  } catch (err) {
    // Only used in isolated private courseOrderProofs/{orderId} (never stored on courseOrders)
    console.warn('Firebase Storage upload unavailable, falling back to private proof document:', err);
    if (dataUrl.length > 230000) {
      const smaller = await compressImageToDataUrlAndBlob(file, 560, 0.6);
      if (smaller.dataUrl.length > 230000) {
        throw new Error('Image is too large. Please select a smaller screenshot under 2 MB.');
      }
      return smaller.dataUrl;
    }
    return dataUrl;
  }
}

export async function fetchCourseOrderScreenshot(orderId: string): Promise<string> {
  const cleanId = sanitizeId(orderId);
  if (!cleanId) {
    throw new Error('Invalid order identifier.');
  }
  const path = `courseOrderProofs/${cleanId}`;
  try {
    const proofSnap = await getDoc(doc(db, 'courseOrderProofs', cleanId));
    if (!proofSnap.exists()) {
      throw new Error('Payment screenshot proof not found for this order.');
    }
    const url = String(proofSnap.data()?.screenshotUrl || '').trim();
    if (!url) {
      throw new Error('Payment screenshot proof is empty.');
    }
    return url;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Payment screenshot proof')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitCourseOrderServer(params: {
  courseId: string;
  method: PaymentMethod;
  transactionId: string;
  screenshotFile: File;
  referralCode?: string;
}): Promise<{
  ok: boolean;
  orderId: string;
  coursePrice: number;
  referralCode: string;
  commissionAmount: number;
  status: string;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to purchase this course.');
  }

  const cleanTxId = params.transactionId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleanTxId.length < 6 || cleanTxId.length > 64) {
    throw new Error('Transaction ID / UTR must be 6 to 64 alphanumeric characters.');
  }

  const proofId = generateRecordId('ORDPROOF');
  const screenshotUrl = await uploadCoursePaymentScreenshot(
    params.screenshotFile,
    `payment-screenshots/${currentUser.uid}/${proofId}.jpg`
  );

  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/course-orders/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      courseId: params.courseId,
      method: params.method,
      transactionId: cleanTxId,
      screenshotUrl,
      referralCode: (params.referralCode || '').trim().toUpperCase(),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Unable to submit course payment order.');
  }
  return data;
}

export async function adminReviewCourseOrderServer(params: {
  orderId: string;
  decision: 'approved' | 'rejected' | 'refunded' | 'cancelled';
  adminNote?: string;
}): Promise<{
  ok: boolean;
  orderId: string;
  status: string;
  commissionCredited?: number;
  reversedCommission?: number;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Administrator session expired. Please sign in again.');
  }

  const idToken = await currentUser.getIdToken(true);
  const res = await fetch('/api/admin/course-orders/review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      orderId: params.orderId,
      decision: params.decision,
      adminNote: params.adminNote || '',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Unable to process course order action.');
  }
  return data;
}

