/**
 * Optional Firebase Cloud Functions (Blaze Plan) for automated server-side
 * payment verification, wallet ledger writes, and custom admin claims.
 *
 * Note: The web app enforces identical invariants immediately via hardened
 * Firestore Security Rules + Atomic Transactions + Express token verification
 * so mobile users without a computer terminal can operate the full platform.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export interface ApprovePaymentPayload {
  paymentId: string;
  decision: 'approved' | 'rejected';
  adminNote?: string;
}

export async function processPaymentServerSide(
  db: admin.firestore.Firestore,
  adminUid: string,
  payload: ApprovePaymentPayload
) {
  const adminDoc = await db.doc(`admins/${adminUid}`).get();
  if (!adminDoc.exists) {
    throw new Error('Unauthorized: Caller is not an authorized administrator.');
  }

  return db.runTransaction(async (tx: admin.firestore.Transaction) => {
    const paymentRef = db.doc(`payments/${payload.paymentId}`);
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) throw new Error('Payment record not found.');

    const payment = paymentSnap.data()!;
    if (payment.status !== 'pending') {
      throw new Error('Payment has already been finalized.');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    if (payload.decision === 'rejected') {
      tx.update(paymentRef, {
        status: 'rejected',
        adminNote: payload.adminNote || 'Verification failed.',
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      });
      return { status: 'rejected' };
    }

    const userRef = db.doc(`users/${payment.userId}`);
    const planRef = db.doc(`plans/${payment.planId}`);
    const [userSnap, planSnap] = await Promise.all([tx.get(userRef), tx.get(planRef)]);
    if (!userSnap.exists || !planSnap.exists) {
      throw new Error('User or plan not found.');
    }

    const user = userSnap.data()!;
    const plan = planSnap.data()!;
    const mergedCourses = Array.from(
      new Set([...(user.courseAccess || []), ...(plan.includedCourseIds || [])])
    );

    const signupBonus = Number(plan.signupBonus || 0);

    tx.update(paymentRef, {
      status: 'approved',
      adminNote: payload.adminNote || 'Payment verified.',
      reviewedBy: adminUid,
      reviewedAt: now,
      updatedAt: now,
    });

    tx.update(userRef, {
      activePlanId: plan.id,
      activePlanName: plan.name,
      courseAccess: mergedCourses,
      bonusBalance: (user.bonusBalance || 0) + signupBonus,
      totalEarnings: (user.totalEarnings || 0) + signupBonus,
      updatedAt: now,
    });

    if (signupBonus > 0) {
      const bonusTxRef = db.collection('transactions').doc();
      tx.set(bonusTxRef, {
        id: bonusTxRef.id,
        userId: payment.userId,
        type: 'plan_bonus',
        walletTarget: 'bonusBalance',
        direction: 'credit',
        amount: signupBonus,
        description: `${plan.name} activation bonus`,
        referenceId: payment.id,
        createdBy: adminUid,
        createdAt: now,
      });
    }

    if (user.referredByUid && user.referredByUid !== user.uid) {
      const referralRef = db.doc(`referrals/${user.uid}`);
      const referralSnap = await tx.get(referralRef);
      if (referralSnap.exists && referralSnap.data()?.status === 'pending_verification') {
        const referrerRef = db.doc(`users/${user.referredByUid}`);
        const referrerSnap = await tx.get(referrerRef);
        const reward = Number(plan.referralBonus || 0);
        if (referrerSnap.exists && reward > 0) {
          const referrer = referrerSnap.data()!;
          tx.update(referralRef, {
            status: 'qualified_rewarded',
            rewardAmount: reward,
            qualifyingPlanId: plan.id,
            rewardedAt: now,
          });
          tx.update(referrerRef, {
            walletBalance: (referrer.walletBalance || 0) + reward,
            totalEarnings: (referrer.totalEarnings || 0) + reward,
            totalReferrals: (referrer.totalReferrals || 0) + 1,
            updatedAt: now,
          });
          const refTx = db.collection('transactions').doc();
          tx.set(refTx, {
            id: refTx.id,
            userId: user.referredByUid,
            type: 'referral_reward',
            walletTarget: 'walletBalance',
            direction: 'credit',
            amount: reward,
            description: `Verified referral reward from ${user.fullName}`,
            referenceId: payment.id,
            createdBy: adminUid,
            createdAt: now,
          });
        }
      }
    }

    return { status: 'approved' };
  });
}
