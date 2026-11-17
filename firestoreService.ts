import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { DEFAULT_COURSES, DEFAULT_PLANS, DEFAULT_SETTINGS } from '../lib/seedDefaults';
import {
  AdminRecord,
  Course,
  MembershipPlan,
  PaymentMethod,
  PaymentSubmission,
  PlatformNotification,
  PlatformSettings,
  ReferralRecord,
  UserProfile,
  WalletTransaction,
  WithdrawalRequest,
} from '../types/domain';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128);
}

function generateUniqueUserId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `SMU-${num}`;
}

function generateReferralCode(fullName: string): string {
  const prefix = fullName
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, 'S');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SM${prefix}${suffix}`;
}

async function verifyAdminActionWithServer(
  action: string,
  targetId: string,
  amount?: number
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated.');
  const token = await currentUser.getIdToken();
  const res = await fetch('/api/admin/verify-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, targetId, amount }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Server verification of admin session failed.');
  }
}

export async function lookupReferralCode(
  code: string
): Promise<{ code: string; ownerId: string; ownerName: string; active: boolean } | null> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 4 || clean.length > 20) return null;
  try {
    const snap = await getDoc(doc(db, 'referralCodes', clean));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      code: data.code,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      active: data.active === true,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `referralCodes/${clean}`);
  }
}

export async function createOrEnsureUserProfile(params: {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  referralCodeInput?: string;
}): Promise<UserProfile> {
  const userRef = doc(db, 'users', params.uid);
  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      return existingSnap.data() as UserProfile;
    }

    const cleanName = params.fullName.trim().slice(0, 100) || 'SkillMint Member';
    const cleanEmail = params.email.trim().slice(0, 160);
    const cleanPhone = (params.phone || '').trim().slice(0, 24);

    // Ensure a unique referral code
    let newRefCode = generateReferralCode(cleanName);
    for (let attempt = 0; attempt < 4; attempt++) {
      const check = await getDoc(doc(db, 'referralCodes', newRefCode));
      if (!check.exists()) break;
      newRefCode = generateReferralCode(cleanName);
    }

    // Validate entered referral code (prevent self-referral)
    let referredByCode: string | null = null;
    let referredByUid: string | null = null;
    if (params.referralCodeInput && params.referralCodeInput.trim().length >= 4) {
      const refLookup = await lookupReferralCode(params.referralCodeInput);
      if (refLookup && refLookup.active && refLookup.ownerId !== params.uid) {
        referredByCode = refLookup.code;
        referredByUid = refLookup.ownerId;
      }
    }

    const uniqueId = generateUniqueUserId();
    const batch = writeBatch(db);

    const newUserDoc: Record<string, any> = {
      uid: params.uid,
      uniqueId,
      fullName: cleanName,
      email: cleanEmail,
      referralCode: newRefCode,
      referredByCode,
      referredByUid,
      role: 'user',
      isBlocked: false,
      walletBalance: 0,
      bonusBalance: 0,
      totalEarnings: 0,
      totalReferrals: 0,
      activePlanId: null,
      activePlanName: null,
      courseAccess: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanPhone) newUserDoc.phone = cleanPhone;

    batch.set(userRef, newUserDoc);
    batch.set(doc(db, 'referralCodes', newRefCode), {
      code: newRefCode,
      ownerId: params.uid,
      ownerName: cleanName,
      active: true,
      createdAt: serverTimestamp(),
    });

    if (referredByCode && referredByUid) {
      batch.set(doc(db, 'referrals', params.uid), {
        id: params.uid,
        referrerId: referredByUid,
        referrerCode: referredByCode,
        referredUserId: params.uid,
        referredUserName: cleanName,
        qualifyingPlanId: null,
        rewardAmount: 0,
        status: 'pending_verification',
        createdAt: serverTimestamp(),
        rewardedAt: null,
      });
    }

    await batch.commit();
    const createdSnap = await getDoc(userRef);
    return createdSnap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function updateOwnProfile(
  uid: string,
  updates: { fullName: string; phone: string; upiId: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName: updates.fullName.trim().slice(0, 100),
      phone: updates.phone.trim().slice(0, 24),
      upiId: updates.upiId.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedInitialCatalogIfEmpty(): Promise<void> {
  try {
    const plansSnap = await getDocs(collection(db, 'plans'));
    const coursesSnap = await getDocs(collection(db, 'courses'));
    const settingsSnap = await getDoc(doc(db, 'settings', 'platform'));

    const batch = writeBatch(db);
    let hasWrites = false;

    if (plansSnap.empty) {
      for (const plan of DEFAULT_PLANS) {
        batch.set(doc(db, 'plans', plan.id), {
          ...plan,
          updatedAt: serverTimestamp(),
        });
        hasWrites = true;
      }
    }

    if (coursesSnap.empty) {
      for (const course of DEFAULT_COURSES) {
        batch.set(doc(db, 'courses', course.id), {
          ...course,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        hasWrites = true;
      }
    }

    if (!settingsSnap.exists()) {
      batch.set(doc(db, 'settings', 'platform'), {
        ...DEFAULT_SETTINGS,
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'catalog/seed');
  }
}

export async function submitManualPayment(params: {
  user: UserProfile;
  plan: MembershipPlan;
  paymentMethod: PaymentMethod;
  transactionId: string;
  screenshotUrl: string;
}): Promise<string> {
  const normalizedUtr = params.transactionId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '');

  if (normalizedUtr.length < 6 || normalizedUtr.length > 64) {
    throw new Error('Transaction ID / UTR must be 6 to 64 alphanumeric characters.');
  }
  if (!params.screenshotUrl || params.screenshotUrl.length < 5) {
    throw new Error('Please upload a payment screenshot proof.');
  }

  // Ensure plan exists in Firestore first
  const planSnap = await getDoc(doc(db, 'plans', params.plan.id));
  if (!planSnap.exists()) {
    throw new Error(
      'Plans catalog is awaiting initial sync by an administrator. Please ask admin to open /admin once to publish plans.'
    );
  }

  const utrRef = doc(db, 'transactionRefs', normalizedUtr);
  const existingUtr = await getDoc(utrRef);
  if (existingUtr.exists()) {
    throw new Error('This Transaction ID / UTR has already been submitted.');
  }

  const paymentId = sanitizeId(`pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const batch = writeBatch(db);

  batch.set(doc(db, 'payments', paymentId), {
    id: paymentId,
    userId: params.user.uid,
    userEmail: params.user.email,
    userName: params.user.fullName,
    planId: params.plan.id,
    planName: params.plan.name,
    amount: params.plan.price,
    paymentMethod: params.paymentMethod,
    transactionId: normalizedUtr,
    screenshotUrl: params.screenshotUrl,
    status: 'pending',
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(utrRef, {
    utr: normalizedUtr,
    paymentId,
    userId: params.user.uid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return paymentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `payments/${paymentId}`);
  }
}

export async function submitWithdrawalRequest(params: {
  user: UserProfile;
  amount: number;
  upiId: string;
  minWithdrawalAmount: number;
}): Promise<string> {
  const amount = Math.floor(Number(params.amount));
  const cleanUpi = params.upiId.trim().slice(0, 100);

  if (params.user.isBlocked) {
    throw new Error('Your account is currently restricted. Contact support.');
  }
  if (Number.isNaN(amount) || amount < params.minWithdrawalAmount) {
    throw new Error(`Minimum withdrawal amount is ₹${params.minWithdrawalAmount}.`);
  }
  if (amount > params.user.walletBalance) {
    throw new Error('Insufficient available wallet balance.');
  }
  if (!cleanUpi.includes('@') || cleanUpi.length < 5) {
    throw new Error('Please enter a valid UPI ID (e.g. name@okaxis).');
  }

  // Check if user already has a pending withdrawal exceeding remaining balance
  const pendingSnap = await getDocs(
    query(
      collection(db, 'withdrawals'),
      where('userId', '==', params.user.uid),
      where('status', '==', 'pending')
    )
  );
  let pendingTotal = 0;
  pendingSnap.forEach((d) => {
    pendingTotal += Number(d.data().amount || 0);
  });
  if (pendingTotal + amount > params.user.walletBalance) {
    throw new Error(
      `You already have ₹${pendingTotal} in pending withdrawals. Remaining withdrawable balance is ₹${Math.max(0, params.user.walletBalance - pendingTotal)}.`
    );
  }

  const withdrawalId = sanitizeId(`wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  try {
    await setDoc(doc(db, 'withdrawals', withdrawalId), {
      id: withdrawalId,
      userId: params.user.uid,
      userEmail: params.user.email,
      userName: params.user.fullName,
      amount,
      upiId: cleanUpi,
      status: 'pending',
      adminNote: null,
      payoutReference: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return withdrawalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `withdrawals/${withdrawalId}`);
  }
}

// ==========================================
// ADMIN OPERATIONS (Atomic & Server-Audited)
// ==========================================

export async function adminApprovePayment(
  paymentId: string,
  adminUid: string,
  adminNote = 'Verified via UTR statement'
): Promise<void> {
  await verifyAdminActionWithServer('approve_payment', paymentId);

  try {
    await runTransaction(db, async (tx) => {
      const paymentRef = doc(db, 'payments', paymentId);
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists()) throw new Error('Payment record not found.');

      const payment = paymentSnap.data() as PaymentSubmission;
      if (payment.status !== 'pending') {
        throw new Error(`Payment already ${payment.status}.`);
      }

      const userRef = doc(db, 'users', payment.userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('Member profile not found.');
      const member = userSnap.data() as UserProfile;

      const planRef = doc(db, 'plans', payment.planId);
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists()) throw new Error('Membership plan not found.');
      const plan = planSnap.data() as MembershipPlan;

      const settingsRef = doc(db, 'settings', 'platform');
      const settingsSnap = await tx.get(settingsRef);
      const settings = settingsSnap.exists()
        ? (settingsSnap.data() as PlatformSettings)
        : (DEFAULT_SETTINGS as PlatformSettings);

      const referralRef = doc(db, 'referrals', payment.userId);
      const referralSnap = await tx.get(referralRef);

      let referrerSnap: any = null;
      let referrerRef: any = null;
      if (referralSnap.exists()) {
        const refData = referralSnap.data() as ReferralRecord;
        if (
          refData.status === 'pending_verification' &&
          refData.referrerId !== payment.userId &&
          settings.referralEnabled
        ) {
          referrerRef = doc(db, 'users', refData.referrerId);
          referrerSnap = await tx.get(referrerRef);
        }
      }

      // Merge newly unlocked courses
      const mergedCourses = Array.from(
        new Set([...(member.courseAccess || []), ...(plan.includedCourseIds || [])])
      ).slice(0, 50);

      const signupBonus = Number(plan.signupBonus || 0);
      const newBonusBalance = Number(member.bonusBalance || 0) + signupBonus;
      const newTotalEarnings = Number(member.totalEarnings || 0) + signupBonus;

      // 1. Mark Payment Approved
      tx.update(paymentRef, {
        status: 'approved',
        adminNote: adminNote.trim().slice(0, 500),
        reviewedBy: adminUid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Activate Plan, Courses & Welcome Bonus on Member
      tx.update(userRef, {
        activePlanId: plan.id,
        activePlanName: plan.name,
        courseAccess: mergedCourses,
        bonusBalance: newBonusBalance,
        totalEarnings: newTotalEarnings,
        updatedAt: serverTimestamp(),
      });

      // 3. Record Welcome Bonus Ledger Entry
      if (signupBonus > 0) {
        const bonusTxId = sanitizeId(`tx_pb_${paymentId}`);
        tx.set(doc(db, 'transactions', bonusTxId), {
          id: bonusTxId,
          userId: member.uid,
          type: 'plan_bonus',
          walletTarget: 'bonusBalance',
          direction: 'credit',
          amount: signupBonus,
          description: `${plan.name} activation bonus (UTR ${payment.transactionId})`,
          referenceId: paymentId,
          createdBy: adminUid,
          createdAt: serverTimestamp(),
        });
      }

      // 4. Notify Member
      const memberNotifId = sanitizeId(`notif_pay_${paymentId}`);
      tx.set(doc(db, 'notifications', memberNotifId), {
        id: memberNotifId,
        targetUserId: member.uid,
        title: `${plan.name} Activated`,
        message: `Your payment (UTR ${payment.transactionId}) was verified. Courses unlocked and ₹${signupBonus} bonus added.`,
        type: 'payment',
        createdAt: serverTimestamp(),
      });

      // 5. Credit Referrer if qualifying referral exists
      if (referrerSnap && referrerSnap.exists() && referrerRef) {
        const referrer = referrerSnap.data() as UserProfile;
        const reward = Number(plan.referralBonus || 0);
        if (reward > 0 && !referrer.isBlocked) {
          tx.update(referrerRef, {
            walletBalance: Number(referrer.walletBalance || 0) + reward,
            totalEarnings: Number(referrer.totalEarnings || 0) + reward,
            totalReferrals: Number(referrer.totalReferrals || 0) + 1,
            updatedAt: serverTimestamp(),
          });

          tx.update(referralRef, {
            qualifyingPlanId: plan.id,
            rewardAmount: reward,
            status: 'qualified_rewarded',
            rewardedAt: serverTimestamp(),
          });

          const refTxId = sanitizeId(`tx_ref_${paymentId}`);
          tx.set(doc(db, 'transactions', refTxId), {
            id: refTxId,
            userId: referrer.uid,
            type: 'referral_reward',
            walletTarget: 'walletBalance',
            direction: 'credit',
            amount: reward,
            description: `Verified referral reward from ${member.fullName} (${plan.name})`,
            referenceId: paymentId,
            createdBy: adminUid,
            createdAt: serverTimestamp(),
          });

          const refNotifId = sanitizeId(`notif_ref_${paymentId}`);
          tx.set(doc(db, 'notifications', refNotifId), {
            id: refNotifId,
            targetUserId: referrer.uid,
            title: `Referral Reward Credited: ₹${reward}`,
            message: `${member.fullName}'s ${plan.name} payment was verified. ₹${reward} added to your withdrawable wallet.`,
            type: 'referral',
            createdAt: serverTimestamp(),
          });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
  }
}

export async function adminRejectPayment(
  paymentId: string,
  adminUid: string,
  reason: string
): Promise<void> {
  await verifyAdminActionWithServer('reject_payment', paymentId);
  try {
    await runTransaction(db, async (tx) => {
      const paymentRef = doc(db, 'payments', paymentId);
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists()) throw new Error('Payment not found.');
      const payment = paymentSnap.data() as PaymentSubmission;
      if (payment.status !== 'pending') {
        throw new Error(`Payment already ${payment.status}.`);
      }

      tx.update(paymentRef, {
        status: 'rejected',
        adminNote: (reason || 'UTR could not be matched').trim().slice(0, 500),
        reviewedBy: adminUid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const notifId = sanitizeId(`notif_rej_${paymentId}`);
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        targetUserId: payment.userId,
        title: 'Payment Verification Declined',
        message: `Payment UTR ${payment.transactionId} was rejected: ${reason || 'Could not verify transaction.'}`,
        type: 'payment',
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
  }
}

export async function adminApproveWithdrawal(
  withdrawalId: string,
  adminUid: string,
  payoutReference: string,
  adminNote = 'Paid via UPI'
): Promise<void> {
  await verifyAdminActionWithServer('approve_withdrawal', withdrawalId);
  try {
    await runTransaction(db, async (tx) => {
      const wdRef = doc(db, 'withdrawals', withdrawalId);
      const wdSnap = await tx.get(wdRef);
      if (!wdSnap.exists()) throw new Error('Withdrawal request not found.');
      const wd = wdSnap.data() as WithdrawalRequest;
      if (wd.status !== 'pending') {
        throw new Error(`Withdrawal already ${wd.status}.`);
      }

      const userRef = doc(db, 'users', wd.userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User account not found.');
      const user = userSnap.data() as UserProfile;

      if (Number(user.walletBalance || 0) < Number(wd.amount)) {
        throw new Error(
          `Insufficient user wallet balance (₹${user.walletBalance}) for ₹${wd.amount} withdrawal.`
        );
      }

      tx.update(userRef, {
        walletBalance: Number(user.walletBalance) - Number(wd.amount),
        updatedAt: serverTimestamp(),
      });

      tx.update(wdRef, {
        status: 'approved',
        payoutReference: (payoutReference || `UPI-${Date.now()}`).trim().slice(0, 100),
        adminNote: adminNote.trim().slice(0, 500),
        reviewedBy: adminUid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const txId = sanitizeId(`tx_wd_${withdrawalId}`);
      tx.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: wd.userId,
        type: 'withdrawal_debit',
        walletTarget: 'walletBalance',
        direction: 'debit',
        amount: Number(wd.amount),
        description: `UPI withdrawal to ${wd.upiId} (Ref: ${payoutReference || 'Settled'})`,
        referenceId: withdrawalId,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
      });

      const notifId = sanitizeId(`notif_wd_${withdrawalId}`);
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        targetUserId: wd.userId,
        title: `Withdrawal Settled: ₹${wd.amount}`,
        message: `₹${wd.amount} has been sent to ${wd.upiId}. Payout reference: ${payoutReference || 'Settled'}.`,
        type: 'withdrawal',
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${withdrawalId}`);
  }
}

export async function adminRejectWithdrawal(
  withdrawalId: string,
  adminUid: string,
  reason: string
): Promise<void> {
  await verifyAdminActionWithServer('reject_withdrawal', withdrawalId);
  try {
    await runTransaction(db, async (tx) => {
      const wdRef = doc(db, 'withdrawals', withdrawalId);
      const wdSnap = await tx.get(wdRef);
      if (!wdSnap.exists()) throw new Error('Withdrawal not found.');
      const wd = wdSnap.data() as WithdrawalRequest;
      if (wd.status !== 'pending') throw new Error(`Withdrawal already ${wd.status}.`);

      tx.update(wdRef, {
        status: 'rejected',
        adminNote: (reason || 'Rejected by admin').trim().slice(0, 500),
        reviewedBy: adminUid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const notifId = sanitizeId(`notif_wdr_${withdrawalId}`);
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        targetUserId: wd.userId,
        title: 'Withdrawal Request Declined',
        message: `Your withdrawal of ₹${wd.amount} was declined: ${reason || 'Please check your UPI ID.'}`,
        type: 'withdrawal',
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${withdrawalId}`);
  }
}

export async function adminToggleUserBlock(targetUid: string, block: boolean): Promise<void> {
  await verifyAdminActionWithServer('toggle_block', targetUid);
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      isBlocked: block,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function adminAdjustUserBalance(params: {
  targetUid: string;
  adminUid: string;
  walletTarget: 'walletBalance' | 'bonusBalance';
  direction: 'credit' | 'debit';
  amount: number;
  note: string;
}): Promise<void> {
  const cleanAmount = Number(params.amount);
  if (Number.isNaN(cleanAmount) || cleanAmount <= 0) {
    throw new Error('Adjustment amount must be greater than 0.');
  }
  await verifyAdminActionWithServer('adjust_balance', params.targetUid, cleanAmount);

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', params.targetUid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as UserProfile;

      const currentVal = Number(user[params.walletTarget] || 0);
      const nextVal =
        params.direction === 'credit' ? currentVal + cleanAmount : currentVal - cleanAmount;
      if (nextVal < 0) {
        throw new Error(`Cannot debit ₹${cleanAmount}; current balance is ₹${currentVal}.`);
      }

      const updatePayload: Record<string, any> = {
        [params.walletTarget]: nextVal,
        updatedAt: serverTimestamp(),
      };
      if (params.direction === 'credit') {
        updatePayload.totalEarnings = Number(user.totalEarnings || 0) + cleanAmount;
      }

      tx.update(userRef, updatePayload);

      const txId = sanitizeId(`tx_adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      tx.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: params.targetUid,
        type: 'admin_adjustment',
        walletTarget: params.walletTarget,
        direction: params.direction,
        amount: cleanAmount,
        description: params.note.trim().slice(0, 300) || 'Manual admin adjustment',
        referenceId: txId,
        createdBy: params.adminUid,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${params.targetUid}`);
  }
}

export async function adminSavePlan(plan: Omit<MembershipPlan, 'updatedAt'>): Promise<void> {
  await verifyAdminActionWithServer('save_plan', plan.id);
  const cleanId = sanitizeId(plan.id);
  try {
    await setDoc(doc(db, 'plans', cleanId), {
      ...plan,
      id: cleanId,
      name: plan.name.trim().slice(0, 100),
      description: plan.description.trim().slice(0, 500),
      eligibilityConditions: plan.eligibilityConditions.slice(0, 15),
      includedCourseIds: plan.includedCourseIds.slice(0, 20),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `plans/${cleanId}`);
  }
}

export async function adminSaveCourse(
  course: Omit<Course, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  await verifyAdminActionWithServer('save_course', course.id);
  const cleanId = sanitizeId(course.id);
  try {
    const ref = doc(db, 'courses', cleanId);
    const existing = isNew ? null : await getDoc(ref);
    await setDoc(ref, {
      ...course,
      id: cleanId,
      title: course.title.trim().slice(0, 140),
      subtitle: (course.subtitle || '').trim().slice(0, 200),
      description: course.description.trim().slice(0, 1500),
      category: course.category.trim().slice(0, 60),
      imageUrl: course.imageUrl.trim().slice(0, 1000),
      instructor: course.instructor.trim().slice(0, 100),
      durationLabel: (course.durationLabel || '').trim().slice(0, 50),
      requiredPlanIds: course.requiredPlanIds.slice(0, 10),
      lessons: course.lessons.slice(0, 30),
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `courses/${cleanId}`);
  }
}

export async function adminDeleteCourse(courseId: string): Promise<void> {
  await verifyAdminActionWithServer('delete_course', courseId);
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `courses/${courseId}`);
  }
}

export async function adminSaveSettings(
  settings: Omit<PlatformSettings, 'updatedAt'>
): Promise<void> {
  await verifyAdminActionWithServer('save_settings', 'platform');
  try {
    await setDoc(doc(db, 'settings', 'platform'), {
      ...settings,
      siteName: settings.siteName.trim().slice(0, 80),
      supportEmail: settings.supportEmail.trim().slice(0, 160),
      supportPhone: (settings.supportPhone || '').trim().slice(0, 30),
      announcementText: (settings.announcementText || '').trim().slice(0, 400),
      merchantName: (settings.merchantName || '').trim().slice(0, 100),
      phonepeUpiId: (settings.phonepeUpiId || '').trim().slice(0, 100),
      phonepeQrUrl: (settings.phonepeQrUrl || '').trim().slice(0, 200000),
      gpayUpiId: (settings.gpayUpiId || '').trim().slice(0, 100),
      gpayQrUrl: (settings.gpayQrUrl || '').trim().slice(0, 200000),
      paytmUpiId: (settings.paytmUpiId || '').trim().slice(0, 100),
      paytmQrUrl: (settings.paytmQrUrl || '').trim().slice(0, 200000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/platform');
  }
}

export async function adminSendNotification(params: {
  targetUserId: string;
  title: string;
  message: string;
  type: PlatformNotification['type'];
}): Promise<void> {
  const notifId = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  await verifyAdminActionWithServer('send_notification', notifId);
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      targetUserId: params.targetUserId.trim() || 'all',
      title: params.title.trim().slice(0, 140),
      message: params.message.trim().slice(0, 600),
      type: params.type,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }
}

export async function adminGrantAdminAccess(
  targetUser: UserProfile,
  adminUid: string
): Promise<void> {
  await verifyAdminActionWithServer('grant_admin', targetUser.uid);
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'admins', targetUser.uid), {
      uid: targetUser.uid,
      email: targetUser.email,
      addedBy: adminUid,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', targetUser.uid), {
      role: 'admin',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admins/${targetUser.uid}`);
  }
}

export async function adminRevokeAdminAccess(targetUid: string): Promise<void> {
  await verifyAdminActionWithServer('revoke_admin', targetUid);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'admins', targetUid));
    batch.update(doc(db, 'users', targetUid), {
      role: 'user',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${targetUid}`);
  }
}

export async function fetchAdminOverviewCollections(): Promise<{
  users: UserProfile[];
  payments: PaymentSubmission[];
  withdrawals: WithdrawalRequest[];
  referrals: ReferralRecord[];
  admins: AdminRecord[];
}> {
  try {
    const [uSnap, pSnap, wSnap, rSnap, aSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(200))),
      getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(200))),
      getDocs(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'), limit(200))),
      getDocs(query(collection(db, 'referrals'), orderBy('createdAt', 'desc'), limit(200))),
      getDocs(collection(db, 'admins')),
    ]);

    return {
      users: uSnap.docs.map((d) => d.data() as UserProfile),
      payments: pSnap.docs.map((d) => d.data() as PaymentSubmission),
      withdrawals: wSnap.docs.map((d) => d.data() as WithdrawalRequest),
      referrals: rSnap.docs.map((d) => d.data() as ReferralRecord),
      admins: aSnap.docs.map((d) => d.data() as AdminRecord),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin/overview');
  }
}
