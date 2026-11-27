import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  LayoutDashboard,
  LogOut,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusLabel } from '../components/StatusLabel';
import { BOOTSTRAP_ADMIN_EMAIL, db } from '../lib/firebase';
import {
  adminAdjustUserBalance,
  adminDeleteCourse,
  adminReviewCourseOrderServer,
  adminReviewPayment,
  adminReviewReferral,
  adminReviewWithdrawal,
  adminSaveCourse,
  adminSavePlan,
  adminSaveSettings,
  adminSendNotification,
  adminToggleUserBlock,
  adminUpdateUserCourseAccess,
  fetchCourseOrderScreenshot,
  generateRecordId,
  uploadImageAsset,uploadVideoAsset, 
} from '../lib/firestoreService';
import { formatDateTime, formatINR } from '../lib/formatters';
import {
  Course,
  CourseLesson,
  CourseOrder,
  MembershipPlan,
  NotificationItem,
  PaymentSubmission,
  PlatformSettings,
  ReferralRecord,
  UserProfile,
  WalletTransaction,
  WithdrawalRequest,
} from '../types/models';

type AdminTab =
  | 'overview'
  | 'payments'
  | 'withdrawals'
  | 'referrals'
  | 'users'
  | 'plans'
  | 'courses'
  | 'settings'
  | 'notifications';

const VALID_ADMIN_TABS: AdminTab[] = [
  'overview',
  'payments',
  'withdrawals',
  'referrals',
  'users',
  'plans',
  'courses',
  'settings',
  'notifications',
];

export const AdminPage: React.FC = () => {
  const {
    firebaseUser,
    isAdmin,
    plans,
    courses,
    settings,
    logout,
  } = useAuth();

  // Server-side verification state
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);
  const [serverAuthMethod, setServerAuthMethod] = useState<string>('');
  const [serverCheckError, setServerCheckError] = useState<string>('');

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminTab | null;
  const [tab, setTab] = useState<AdminTab>(
    tabParam && VALID_ADMIN_TABS.includes(tabParam) ? tabParam : 'overview'
  );
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentSubmission[]>([]);
  const [allCourseOrders, setAllCourseOrders] = useState<CourseOrder[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [allReferrals, setAllReferrals] = useState<ReferralRecord[]>([]);
  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([]);
  const [listenerErrors, setListenerErrors] = useState<Record<string, string>>({});

  const selectTab = (nextTab: AdminTab) => {
    setTab(nextTab);
    setSearchParams(nextTab === 'overview' ? {} : { tab: nextTab }, { replace: true });
  };

  useEffect(() => {
    if (tabParam && VALID_ADMIN_TABS.includes(tabParam)) {
      setTab(tabParam);
    } else if (!tabParam) {
      setTab('overview');
    }
  }, [tabParam]);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'pending' | 'all'>('pending');
  const [courseOrderFilter, setCourseOrderFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [withdrawalFilter, setWithdrawalFilter] = useState<'pending' | 'all'>('pending');
  const [referralFilter, setReferralFilter] = useState<'registered' | 'all'>('all');

  // Review modal state
  const [screenshotModalUrl, setScreenshotModalUrl] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [payoutRefById, setPayoutRefById] = useState<Record<string, string>>({});
  const [referralRewardById, setReferralRewardById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // User balance adjustment modal
  const [adjustTarget, setAdjustTarget] = useState<UserProfile | null>(null);
  const [adjustBalanceType, setAdjustBalanceType] = useState<'wallet' | 'bonus'>('wallet');
  const [adjustDirection, setAdjustDirection] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Plan editor
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

  // Course editor
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isNewCourse, setIsNewCourse] = useState(false);
  const [uploadingCourseQr, setUploadingCourseQr] = useState(false);
const [uploadingPlanQr, setUploadingPlanQr] = useState(false);
  // Settings form
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>(settings);
  const [uploadingQr, setUploadingQr] = useState<string | null>(null);

  // Notification sender
  const [notifTarget, setNotifTarget] = useState('all');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<NotificationItem['type']>('info');

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  // Cryptographic Server-Side Admin Session Verification
  useEffect(() => {
    let active = true;
    async function verifyWithServer() {
      if (!firebaseUser) {
        if (active) {
          setServerVerified(null);
          setServerAuthMethod('');
          setServerCheckError('');
        }
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch('/api/admin/verify-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.authorized) {
          setServerVerified(true);
          setServerAuthMethod(data.method || 'server-verified');
          setServerCheckError('');
        } else {
          setServerVerified(false);
          setServerCheckError(data.error || 'Server denied administrator access.');
        }
      } catch (err: any) {
        if (active) {
          setServerVerified(false);
          setServerCheckError(err?.message || 'Unable to reach verification server.');
        }
      }
    }
    void verifyWithServer();
    return () => {
      active = false;
    };
  }, [firebaseUser, isAdmin]);

  const authorizedAdmin = Boolean(firebaseUser && isAdmin && serverVerified === true);

  useEffect(() => {
    if (!authorizedAdmin || !firebaseUser) return;

    setListenerErrors({});

    const sortDesc = <T extends { createdAt?: any }>(list: T[]) =>
      [...list].sort((a, b) => {
        const tA = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });

    const clearListenerError = (collectionName: string) => {
      setListenerErrors((prev) => {
        if (!prev[collectionName]) return prev;
        const next = { ...prev };
        delete next[collectionName];
        return next;
      });
    };

    const recordListenerError = (collectionName: string, err: any) => {
      const code = err?.code || '';
      const message =
        code === 'permission-denied'
          ? `Permission denied reading "${collectionName}" (${code}). Existing Firestore security rules may restrict listing this collection.`
          : `${err?.message || `Unable to read "${collectionName}".`}${code ? ` (${code})` : ''}`;
      setListenerErrors((prev) => ({ ...prev, [collectionName]: message }));
    };

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        clearListenerError('users');
        setAllUsers(sortDesc(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Partial<UserProfile>) }) as UserProfile)));
      },
      (err) => recordListenerError('users', err)
    );

    const unsubPayments = onSnapshot(
      collection(db, 'payments'),
      (snap) => {
        clearListenerError('payments');
        setAllPayments(
          sortDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<PaymentSubmission>) }) as PaymentSubmission))
        );
      },
      (err) => recordListenerError('payments', err)
    );

    const unsubWithdrawals = onSnapshot(
      collection(db, 'withdrawals'),
      (snap) => {
        clearListenerError('withdrawals');
        setAllWithdrawals(
          sortDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<WithdrawalRequest>) }) as WithdrawalRequest))
        );
      },
      (err) => recordListenerError('withdrawals', err)
    );

    const unsubReferrals = onSnapshot(
      collection(db, 'referrals'),
      (snap) => {
        clearListenerError('referrals');
        setAllReferrals(
          sortDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<ReferralRecord>) }) as ReferralRecord))
        );
      },
      (err) => recordListenerError('referrals', err)
    );

    const unsubCourseOrders = onSnapshot(
      collection(db, 'courseOrders'),
      (snap) => {
        clearListenerError('courseOrders');
        setAllCourseOrders(
          sortDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<CourseOrder>) }) as CourseOrder))
        );
      },
      (err) => recordListenerError('courseOrders', err)
    );

    const unsubTransactions = onSnapshot(
      collection(db, 'transactions'),
      (snap) => {
        clearListenerError('transactions');
        setAllTransactions(
          sortDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<WalletTransaction>) }) as WalletTransaction))
        );
      },
      (err) => recordListenerError('transactions', err)
    );

    return () => {
      unsubUsers();
      unsubPayments();
      unsubWithdrawals();
      unsubReferrals();
      unsubCourseOrders();
      unsubTransactions();
    };
  }, [authorizedAdmin, firebaseUser]);

  if (!firebaseUser) {
    return null;
  }

  if (serverVerified === null) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-2">
        <div className="text-sm font-semibold text-slate-900">Verifying Server Admin Session...</div>
        <div className="text-xs text-slate-500">Validating cryptographic Firebase token and administrator access.</div>
      </div>
    );
  }

  if (!authorizedAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white border border-red-200 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg">
            <ShieldAlert className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>Access Denied — Not an Authorized Administrator</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Signed in as <span className="font-semibold text-slate-900">{firebaseUser.email}</span>.{' '}
            {serverCheckError || 'Only the verified authorized administrator account may access this console.'}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>
      </div>
    );
  }

  const pendingPayments = allPayments.filter((p) => p.status === 'pending');
  const approvedPaymentsTotal = allPayments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pendingCourseOrders = allCourseOrders.filter((o) => o.status === 'pending');
  const approvedCourseOrders = allCourseOrders.filter((o) => o.status === 'approved');
  const approvedCourseOrdersTotal = approvedCourseOrders.reduce((sum, o) => sum + Number(o.coursePrice || 0), 0);
  const visibleCourseOrders =
    courseOrderFilter === 'pending'
      ? pendingCourseOrders
      : courseOrderFilter === 'approved'
      ? approvedCourseOrders
      : allCourseOrders;

  const referredCourseOrders = allCourseOrders.filter((o) => Boolean(o.referrerUid));
  const pendingCourseCommissionTotal = referredCourseOrders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + Number(o.commissionAmount || 0), 0);
  const paidCourseCommissionTotal = referredCourseOrders
    .filter((o) => o.commissionStatus === 'paid')
    .reduce((sum, o) => sum + Number(o.commissionAmount || 0), 0);

  const commissionHistoryTxs = allTransactions.filter(
    (tx) =>
      tx.type === 'referral_reward' ||
      (tx.type === 'admin_debit' && (tx.title || '').toLowerCase().includes('commission'))
  );

  const pendingWithdrawals = allWithdrawals.filter((w) => w.status === 'pending');
  const approvedWithdrawalsTotal = allWithdrawals
    .filter((w) => w.status === 'approved')
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  const pendingReferrals = allReferrals.filter((r) => r.status === 'registered' || r.status === 'qualified');
  const totalReferralRewardsPaid =
    allReferrals
      .filter((r) => r.status === 'rewarded')
      .reduce((sum, r) => sum + Number(r.rewardAmount || 0), 0) + paidCourseCommissionTotal;

  const visiblePayments = paymentFilter === 'pending' ? pendingPayments : allPayments;
  const visibleWithdrawals = withdrawalFilter === 'pending' ? pendingWithdrawals : allWithdrawals;
  const visibleReferrals = referralFilter === 'registered' ? pendingReferrals : allReferrals;

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.uniqueUserId || '').toLowerCase().includes(q) ||
      (u.referralCode || '').toLowerCase().includes(q)
    );
  });

  const showSuccess = (text: string) => setFeedback({ type: 'success', text });
  const showError = (err: any) => setFeedback({ type: 'error', text: err?.message || 'Operation failed.' });

  const handlePaymentDecision = async (paymentId: string, decision: 'approved' | 'rejected') => {
    setBusyId(paymentId);
    setFeedback(null);
    try {
      await adminReviewPayment({
        paymentId,
        decision,
        adminUid: firebaseUser.uid,
        adminNote: noteById[paymentId] || '',
      });
      showSuccess(
        decision === 'approved'
          ? `Payment ${paymentId} approved. Membership, bonus, courses, and referral rewards updated atomically.`
          : `Payment ${paymentId} marked as rejected.`
      );
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleCourseOrderDecision = async (
    orderId: string,
    decision: 'approved' | 'rejected' | 'refunded' | 'cancelled'
  ) => {
    setBusyId(orderId);
    setFeedback(null);
    try {
      const res = await adminReviewCourseOrderServer({
        orderId,
        decision,
        adminNote: noteById[orderId] || '',
      });
      if (decision === 'approved') {
        const commText =
          res.commissionCredited && res.commissionCredited > 0
            ? ` and ₹${res.commissionCredited} (50%) affiliate commission credited.`
            : '.';
        showSuccess(`Course order ${orderId} approved. Buyer unlocked${commText}`);
      } else if (decision === 'rejected') {
        showSuccess(`Course order ${orderId} marked as rejected.`);
      } else {
        const revText =
          res.reversedCommission && res.reversedCommission > 0
            ? ` ₹${res.reversedCommission} commission reversed from referrer.`
            : '';
        showSuccess(`Course order ${orderId} marked ${decision} and course access revoked.${revText}`);
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenCourseScreenshot = async (order: CourseOrder) => {
    if (order.screenshotUrl) {
      setScreenshotModalUrl(order.screenshotUrl);
      return;
    }
    setBusyId(order.id);
    setFeedback(null);
    try {
      const url = await fetchCourseOrderScreenshot(order.id);
      setScreenshotModalUrl(url);
    } catch (err: any) {
      showError(
        err?.message?.includes('permission-denied')
          ? new Error('Permission denied reading courseOrderProofs. Update and deploy Firestore rules for courseOrderProofs.')
          : err
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCourseQrUpload = async (file?: File) => {
    if (!file || !editingCourse) return;
    setUploadingCourseQr(true);
    setFeedback(null);
    try {
      const url = await uploadImageAsset(file, `qr-codes/course_${editingCourse.id}_${Date.now()}.jpg`);
      setEditingCourse((prev) => (prev ? { ...prev, qrCodeUrl: url } : null));
      showSuccess('Course QR uploaded. Tap "Save Course" to publish.');
    } catch (err) {
      showError(err);
    } finally {
      setUploadingCourseQr(false);
    }
  };
const handlePlanQrUpload = async (file?: File) => {
  if (!file || !editingPlan) return;
  setUploadingPlanQr(true);
  setFeedback(null);

  try {
    const url = await uploadImageAsset(
      file,
      `qr-codes/plan_${editingPlan.id}_${Date.now()}.jpg`
    );

    setEditingPlan((prev) =>
      prev ? { ...prev, qrCodeUrl: url } : null
    );

    showSuccess('Plan QR uploaded. Tap Save Plan Changes to publish.');
  } catch (err) {
    showError(err);
  } finally {
    setUploadingPlanQr(false);
  }
};
  const handleWithdrawalDecision = async (withdrawalId: string, decision: 'approved' | 'rejected') => {
    setBusyId(withdrawalId);
    setFeedback(null);
    try {
      await adminReviewWithdrawal({
        withdrawalId,
        decision,
        adminUid: firebaseUser.uid,
        payoutRef: payoutRefById[withdrawalId] || '',
        adminNote: noteById[withdrawalId] || '',
      });
      showSuccess(
        decision === 'approved'
          ? `Withdrawal ${withdrawalId} approved and wallet balance debited.`
          : `Withdrawal ${withdrawalId} rejected.`
      );
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleReferralDecision = async (referralId: string, decision: 'rewarded' | 'rejected') => {
    setBusyId(referralId);
    setFeedback(null);
    try {
      const customReward = Number(referralRewardById[referralId] || settings.referralBonusDefault || 50);
      await adminReviewReferral({
        referralId,
        decision,
        rewardAmount: customReward,
      });
      showSuccess(
        decision === 'rewarded'
          ? `Referral reward of ₹${customReward} credited to referrer wallet.`
          : 'Referral marked as rejected.'
      );
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleAdjustBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setFeedback(null);
    try {
      await adminAdjustUserBalance({
        targetUid: adjustTarget.uid,
        balanceType: adjustBalanceType,
        direction: adjustDirection,
        amount: Number(adjustAmount),
        reason: adjustReason,
      });
      showSuccess(`Updated ${adjustTarget.displayName}'s ${adjustBalanceType} balance.`);
      setAdjustTarget(null);
      setAdjustAmount('');
      setAdjustReason('');
    } catch (err) {
      showError(err);
    }
  };

  const handleQrUpload = async (field: 'phonepeQrUrl' | 'gpayQrUrl' | 'paytmQrUrl', file?: File) => {
    if (!file) return;
    setUploadingQr(field);
    try {
      const url = await uploadImageAsset(file, `qr-codes/${field}_${Date.now()}.jpg`);
      setSettingsForm((prev) => ({ ...prev, [field]: url }));
      showSuccess('QR image uploaded. Click "Save Website & QR Settings" to publish.');
    } catch (err) {
      showError(err);
    } finally {
      setUploadingQr(null);
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await adminSaveSettings(settingsForm);
      showSuccess('Website, referral, withdrawal, and QR settings saved.');
    } catch (err) {
      showError(err);
    }
  };

  const handleSendNotifSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await adminSendNotification({
        userId: notifTarget,
        title: notifTitle,
        message: notifMessage,
        type: notifType,
      });
      setNotifTitle('');
      setNotifMessage('');
      showSuccess('Notification dispatched.');
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Server-Verified Admin Session ({serverAuthMethod})</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Admin Control Panel</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{firebaseUser.email}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-[40px] px-3.5 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Total Users</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">{allUsers.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Approved Sales</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatINR(approvedPaymentsTotal + approvedCourseOrdersTotal)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {allPayments.length} plans · {allCourseOrders.length} courses
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Pending Approvals</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">
            {pendingPayments.length + pendingCourseOrders.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Paid Withdrawals</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatINR(approvedWithdrawalsTotal)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Pending Withdrawals</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">{pendingWithdrawals.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Referral Rewards Paid</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatINR(totalReferralRewardsPaid)}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {Object.keys(listenerErrors).length > 0 && (
        <div
          role="alert"
          className="p-4 rounded-2xl border bg-amber-50 border-amber-200 text-amber-900 text-xs space-y-1.5"
        >
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>Firestore Read Permission Notice</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {Object.entries(listenerErrors).map(([col, msg]) => (
              <li key={col}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Admin Dashboard Sections"
        className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl w-full"
      >
        {(
          [
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'payments', label: `Payments (${pendingPayments.length + pendingCourseOrders.length})`, icon: CreditCard },
            { id: 'withdrawals', label: `Withdrawals (${pendingWithdrawals.length})`, icon: Wallet },
            { id: 'referrals', label: `Referrals (${allReferrals.length + referredCourseOrders.length})`, icon: UserCheck },
            { id: 'users', label: 'Users', icon: Users },

            { id: 'courses', label: 'Courses', icon: BookOpen },
            { id: 'settings', label: 'QR & Settings', icon: Settings },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ] as { id: AdminTab; label: string; icon: React.FC<any> }[]
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(item.id)}
              className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-lg inline-flex items-center justify-center lg:justify-start gap-1.5 whitespace-nowrap transition-colors cursor-pointer touch-manipulation select-none ${
                active
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 0: OVERVIEW */}
      {tab === 'overview' && (
        <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Pending Payment Approvals</h2>
              <button
                type="button"
                onClick={() => selectTab('payments')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Review All →
              </button>
            </div>
            {pendingPayments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">All payment submissions have been reviewed.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingPayments.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.userName || 'Member'}</div>
                      <div className="text-slate-500 font-mono">
                        {p.planName || 'Plan'} · UTR: {p.transactionId || '—'}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900 shrink-0">{formatINR(p.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Pending Withdrawal Requests</h2>
              <button
                type="button"
                onClick={() => selectTab('withdrawals')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Process Queue →
              </button>
            </div>
            {pendingWithdrawals.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No pending withdrawal requests.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingWithdrawals.slice(0, 4).map((w) => (
                  <div key={w.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{w.userName || 'Member'}</div>
                      <div className="text-slate-500 font-mono truncate">{w.upiId || '—'}</div>
                    </div>
                    <div className="font-mono font-bold text-slate-900 shrink-0">{formatINR(w.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: PAYMENTS (PLAN PAYMENTS + COURSE AFFILIATE ORDERS) */}
      {tab === 'payments' && (
        <div role="tabpanel" className="space-y-6">
          {/* Course Affiliate Orders Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Course Purchase &amp; 50% Affiliate Orders</h2>
                <p className="text-xs text-slate-500">
                  Approving unlocks the course for the buyer and atomically credits 50% commission to the direct referrer.
                  Refunding or cancelling revokes course access and reverses commission.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCourseOrderFilter('pending')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    courseOrderFilter === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Pending ({pendingCourseOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCourseOrderFilter('approved')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    courseOrderFilter === 'approved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Approved ({approvedCourseOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCourseOrderFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    courseOrderFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  All ({allCourseOrders.length})
                </button>
              </div>
            </div>

            {visibleCourseOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No course orders in this view.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleCourseOrders.map((order) => (
                  <div key={order.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{order.buyerName || 'Buyer'}</span>
                        <span className="text-xs text-slate-500">{order.buyerEmail || '—'}</span>
                        <StatusLabel status={order.status || 'pending'} />
                        {order.commissionStatus && order.commissionStatus !== 'none' && (
                          <span className="text-[11px] font-mono text-emerald-700">
                            Comm: {order.commissionStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">
                        Course: <span className="font-semibold text-slate-900">{order.courseTitle}</span> · Price:{' '}
                        <span className="font-mono font-semibold">{formatINR(order.coursePrice)}</span> · Method:{' '}
                        <span className="uppercase">{order.method || 'upi'}</span> · UTR:{' '}
                        <span className="font-mono font-semibold text-slate-900 select-all">
                          {order.transactionId || '—'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {order.referrerUid ? (
                          <>
                            Referrer: <span className="font-semibold text-slate-900">{order.referrerName || 'Partner'}</span>{' '}
                            (<span className="font-mono">{order.referralCode}</span>) · 50% Commission:{' '}
                            <span className="font-mono font-bold text-emerald-700">
                              {formatINR(order.commissionAmount)}
                            </span>{' '}
                            · Platform Share: <span className="font-mono">{formatINR(order.platformShare)}</span>
                          </>
                        ) : (
                          <>
                            Direct Purchase (No referral) · Platform Share:{' '}
                            <span className="font-mono">{formatINR(order.coursePrice)}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Submitted {formatDateTime(order.createdAt)} · Order ID: {order.id}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={(!order.hasScreenshot && !order.screenshotUrl) || busyId === order.id}
                        onClick={() => void handleOpenCourseScreenshot(order)}
                        className="min-h-[44px] px-3 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {busyId === order.id
                            ? 'Loading...'
                            : order.hasScreenshot || order.screenshotUrl
                            ? 'Screenshot'
                            : 'No Screenshot'}
                        </span>
                      </button>

                      {order.status === 'pending' && (
                        <>
                          <input
                            type="text"
                            placeholder="Review note (optional)"
                            value={noteById[order.id] || ''}
                            onChange={(e) => setNoteById((prev) => ({ ...prev, [order.id]: e.target.value }))}
                            className="min-h-[44px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl w-40"
                          />
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => void handleCourseOrderDecision(order.id, 'approved')}
                            className="min-h-[44px] px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-50"
                          >
                            Approve &amp; Unlock
                          </button>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => void handleCourseOrderDecision(order.id, 'rejected')}
                            className="min-h-[44px] px-3.5 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {order.status === 'approved' && (
                        <>
                          <input
                            type="text"
                            placeholder="Refund / cancel reason"
                            value={noteById[order.id] || ''}
                            onChange={(e) => setNoteById((prev) => ({ ...prev, [order.id]: e.target.value }))}
                            className="min-h-[44px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl w-40"
                          />
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => void handleCourseOrderDecision(order.id, 'refunded')}
                            className="min-h-[44px] px-3.5 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
                          >
                            Refund &amp; Reverse
                          </button>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => void handleCourseOrderDecision(order.id, 'cancelled')}
                            className="min-h-[44px] px-3.5 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Membership Plan Payment Verification Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">Membership Plan Payment Verification Queue</h2>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPaymentFilter('pending')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    paymentFilter === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Pending ({pendingPayments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    paymentFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  All ({allPayments.length})
                </button>
              </div>
            </div>

            {visiblePayments.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No payments in this view.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visiblePayments.map((p) => (
                  <div key={p.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{p.userName || 'Member'}</span>
                        <span className="text-xs text-slate-500">{p.userEmail || '—'}</span>
                        <StatusLabel status={p.status || 'pending'} />
                      </div>
                      <div className="text-xs text-slate-600">
                        Plan: <span className="font-semibold text-slate-900">{p.planName || 'Plan'}</span> · Amount:{' '}
                        <span className="font-mono font-semibold">{formatINR(p.amount)}</span> · Method:{' '}
                        <span className="uppercase">{p.method || 'upi'}</span> · UTR:{' '}
                        <span className="font-mono font-semibold text-slate-900 select-all">
                          {p.transactionId || '—'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Submitted {formatDateTime(p.createdAt)} · ID: {p.id}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!p.screenshotUrl}
                        onClick={() => p.screenshotUrl && setScreenshotModalUrl(p.screenshotUrl)}
                        className="min-h-[40px] px-3 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{p.screenshotUrl ? 'Screenshot' : 'No Screenshot'}</span>
                      </button>

                      {p.status === 'pending' && (
                        <>
                          <input
                            type="text"
                            placeholder="Review note (optional)"
                            value={noteById[p.id] || ''}
                            onChange={(e) => setNoteById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl w-44"
                          />
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handlePaymentDecision(p.id, 'approved')}
                            className="min-h-[40px] px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handlePaymentDecision(p.id, 'rejected')}
                            className="min-h-[40px] px-3.5 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WITHDRAWALS */}
      {tab === 'withdrawals' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">Withdrawal Requests</h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setWithdrawalFilter('pending')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  withdrawalFilter === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Pending ({pendingWithdrawals.length})
              </button>
              <button
                type="button"
                onClick={() => setWithdrawalFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  withdrawalFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                All ({allWithdrawals.length})
              </button>
            </div>
          </div>

          {visibleWithdrawals.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">No withdrawal requests in this view.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleWithdrawals.map((w) => (
                <div key={w.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{w.userName || 'Member'}</span>
                      <span className="text-xs text-slate-500">{w.userEmail || '—'}</span>
                      <StatusLabel status={w.status || 'pending'} />
                    </div>
                    <div className="text-xs text-slate-700">
                      Amount: <span className="font-mono font-bold text-slate-900">{formatINR(w.amount)}</span> · UPI
                      ID: <span className="font-mono font-semibold select-all">{w.upiId || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Requested {formatDateTime(w.createdAt)} {w.payoutRef ? `· Payout Ref: ${w.payoutRef}` : ''}
                    </div>
                  </div>

                  {w.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Payout UTR / Ref"
                        value={payoutRefById[w.id] || ''}
                        onChange={(e) => setPayoutRefById((prev) => ({ ...prev, [w.id]: e.target.value }))}
                        className="min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl w-36"
                      />
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={noteById[w.id] || ''}
                        onChange={(e) => setNoteById((prev) => ({ ...prev, [w.id]: e.target.value }))}
                        className="min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl w-36"
                      />
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() => handleWithdrawalDecision(w.id, 'approved')}
                        className="min-h-[40px] px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-50"
                      >
                        Mark Paid & Deduct
                      </button>
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() => handleWithdrawalDecision(w.id, 'rejected')}
                        className="min-h-[40px] px-3.5 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REFERRAL REWARDS & AFFILIATE COMMISSIONS */}
      {tab === 'referrals' && (
        <div role="tabpanel" className="space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">Registered Referrals</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">{allReferrals.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">Referred Course Orders</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {referredCourseOrders.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">Pending Commissions</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">
                {formatINR(pendingCourseCommissionTotal)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">Paid Course Commissions</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {formatINR(paidCourseCommissionTotal)}
              </div>
            </div>
          </div>

          {/* Referred Course Purchases & 50% Commissions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Referred Course Purchases (50% Commission)</h2>
                <p className="text-xs text-slate-500">
                  Direct affiliate attributions from course checkout links. Approve or refund in the Payments tab.
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectTab('payments')}
                className="min-h-[40px] px-3.5 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Open Payments Queue →
              </button>
            </div>

            {referredCourseOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No referred course purchases recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-3 pr-4 font-semibold">Buyer</th>
                      <th className="py-3 pr-4 font-semibold">Referrer</th>
                      <th className="py-3 pr-4 font-semibold">Course</th>
                      <th className="py-3 pr-4 font-semibold text-right">Price</th>
                      <th className="py-3 pr-4 font-semibold text-right">50% Comm.</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {referredCourseOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-slate-900">{order.buyerName}</div>
                          <div className="text-slate-500">{order.buyerEmail}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-slate-900">{order.referrerName || 'Partner'}</div>
                          <div className="font-mono text-slate-500">{order.referralCode}</div>
                        </td>
                        <td className="py-3 pr-4 font-medium text-slate-900">{order.courseTitle}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatINR(order.coursePrice)}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                          {formatINR(order.commissionAmount)}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusLabel status={order.commissionStatus || order.status} />
                        </td>
                        <td className="py-3 text-slate-600">{formatDateTime(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Commission Transaction Ledger */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Commission Transaction History</h2>
            {commissionHistoryTxs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No commission ledger transactions yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {commissionHistoryTxs.slice(0, 25).map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{tx.title}</div>
                      <div className="text-slate-500 font-mono">
                        UID: {tx.userId} · Ref: {tx.referenceId || tx.id} · {formatDateTime(tx.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div
                        className={`font-mono font-bold ${
                          tx.direction === 'credit' ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {tx.direction === 'credit' ? '+' : '-'}
                        {formatINR(tx.amount)}
                      </div>
                      <StatusLabel status={tx.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Existing Registered Referrals Management */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Registered Referral Users &amp; Manual Rewards</h2>
                <p className="text-xs text-slate-500">
                  Referrals auto-credit when a referred user&apos;s plan payment is approved, or you can manually
                  verify/reject referrals below.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setReferralFilter('registered')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    referralFilter === 'registered' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Unrewarded ({pendingReferrals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReferralFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    referralFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  All ({allReferrals.length})
                </button>
              </div>
            </div>

            {visibleReferrals.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No referral records in this view.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleReferrals.map((r) => (
                  <div key={r.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{r.referredName || 'Member'}</span>
                        <span className="text-xs text-slate-500">{r.referredEmail || '—'}</span>
                        <StatusLabel status={r.status || 'registered'} />
                      </div>
                      <div className="text-xs text-slate-600">
                        Referrer Code: <span className="font-mono font-semibold">{r.referrerCode || '—'}</span> · Referrer
                        UID: <span className="font-mono">{r.referrerUid || '—'}</span> · Reward:{' '}
                        <span className="font-mono font-semibold">{formatINR(r.rewardAmount)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Registered {formatDateTime(r.createdAt)}</div>
                    </div>

                    {(r.status === 'registered' || r.status === 'qualified') && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={1}
                          placeholder={`₹${settings.referralBonusDefault || 50}`}
                          value={referralRewardById[r.id] || ''}
                          onChange={(e) => setReferralRewardById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          className="min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl w-28"
                        />
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleReferralDecision(r.id, 'rewarded')}
                          className="min-h-[40px] px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-50"
                        >
                          Credit Reward
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleReferralDecision(r.id, 'rejected')}
                          className="min-h-[40px] px-3.5 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: USERS & BALANCES */}
      {tab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">Manage Users, Bonuses & Course Access</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" aria-hidden="true" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email, ID, code..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              {allUsers.length === 0 ? 'No user records loaded yet.' : 'No users match your search.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const userIsAdmin = (u.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
                return (
                  <div key={u.uid} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{u.displayName || 'Member'}</span>
                        <span className="text-xs font-mono text-slate-500">{u.uniqueUserId || u.uid}</span>
                        {userIsAdmin && <span className="text-xs font-semibold text-emerald-700">Admin</span>}
                        {u.isBlocked && <StatusLabel status="blocked" />}
                      </div>
                      <div className="text-xs text-slate-600">
                        {u.email || '—'} · Ref Code: <span className="font-mono">{u.referralCode || '—'}</span> · Plan:{' '}
                        {u.activePlanName || 'None'}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-700">
                        Wallet: {formatINR(u.walletBalance)} · Bonus: {formatINR(u.bonusBalance)} · Referrals:{' '}
                        {u.totalReferrals || 0} · Courses: {(u.courseAccess || []).length}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAdjustTarget(u)}
                        className="min-h-[38px] px-3 py-1.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50"
                      >
                        Adjust Wallet / Bonus
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const allCourseIds = courses.map((c) => c.id);
                            const hasAll =
                              allCourseIds.length > 0 &&
                              allCourseIds.every((id) => (u.courseAccess || []).includes(id));
                            await adminUpdateUserCourseAccess(u.uid, hasAll ? [] : allCourseIds);
                            showSuccess(
                              hasAll
                                ? `Revoked course access for ${u.displayName || u.email || 'user'}.`
                                : `Granted all ${allCourseIds.length} courses to ${u.displayName || u.email || 'user'}.`
                            );
                          } catch (err) {
                            showError(err);
                          }
                        }}
                        className="min-h-[38px] px-3 py-1.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50"
                      >
                        {courses.length > 0 && (u.courseAccess || []).length >= courses.length
                          ? 'Revoke Courses'
                          : 'Grant All Courses'}
                      </button>

                      {u.uid !== firebaseUser.uid && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await adminToggleUserBlock(u.uid, !u.isBlocked);
                              showSuccess(
                                u.isBlocked
                                  ? `Unblocked ${u.displayName || u.email || 'user'}.`
                                  : `Blocked ${u.displayName || u.email || 'user'}.`
                              );
                            } catch (err) {
                              showError(err);
                            }
                          }}
                          className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-xl text-white ${
                            u.isBlocked ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {u.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}                
                      

      {/* TAB 6: COURSES CMS */}
      {tab === 'courses' && (
        <div role="tabpanel" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">Courses ({courses.length})</h2>
            <button
              type="button"
              onClick={() => {
                setIsNewCourse(true);
                setEditingCourse({
                  id: generateRecordId('course'),
                  title: '',
                  description: '',
                  imageUrl: courses[0]?.imageUrl || '',
                  category: 'Digital Skills',
                  instructor: 'SkillMint Faculty',
                  price: 100,
                  qrCodeUrl: '',
                  upiId: '',
                  planIdRequired: 'plan_starter',
                  lessons: [
                    {
                      id: 'lesson_01',
                      title: '01. Introduction & Curriculum Overview',
                      duration: '08:00',
                      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                      summary: 'Getting started with the course workflow.',
                    },
                  ],
                  isActive: true,
                });
              }}
              className="min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 active:bg-slate-950 inline-flex items-center gap-1.5 shrink-0 cursor-pointer touch-manipulation select-none"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Course</span>
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
              No courses available yet. Tap &ldquo;Add Course&rdquo; above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {courses.map((c) => {
                const safeLessons = c.lessons || [];
                const isSelected = !isNewCourse && editingCourse?.id === c.id;
                const linkedPlan = plans.find((p) => p.id === c.planIdRequired);
                const displayPrice = Number(c.price || linkedPlan?.price || 0);
                return (
                  <div
                    key={c.id}
                    className={`bg-white border rounded-2xl overflow-hidden flex flex-col justify-between transition-colors ${
                      isSelected ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.title || 'Course cover'}
                          referrerPolicy="no-referrer"
                          className="w-full h-36 object-cover bg-slate-100"
                        />
                      ) : (
                        <div className="w-full h-36 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                          No cover image
                        </div>
                      )}
                      <div className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            {c.category || 'General'} · {safeLessons.length} lessons
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {displayPrice > 0 ? formatINR(displayPrice) : 'Plan'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{c.title || 'Untitled Course'}</h3>
                        <p className="text-xs text-slate-600 line-clamp-2">{c.description || ''}</p>
                        <div className="text-[11px] text-slate-500 font-mono">
                          QR: {c.qrCodeUrl ? 'Course QR set' : 'Uses platform QR'}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 pb-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewCourse(false);
                          setEditingCourse({
                            ...c,
                            price: c.price !== undefined ? Number(c.price) : Number(linkedPlan?.price || 0),
                            qrCodeUrl: c.qrCodeUrl || '',
                            upiId: c.upiId || '',
                            lessons: [...safeLessons],
                          });
                        }}
                        className="flex-1 min-h-[44px] px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer touch-manipulation select-none"
                      >
                        {isSelected ? 'Editing' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await adminDeleteCourse(c.id);
                            showSuccess(`Deleted course "${c.title || c.id}".`);
                          } catch (err) {
                            showError(err);
                          }
                        }}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-xl hover:bg-red-50 inline-flex items-center justify-center cursor-pointer touch-manipulation"
                        aria-label={`Delete ${c.title || c.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {editingCourse && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={isNewCourse ? 'Create New Course' : `Edit ${editingCourse.title || 'Course'}`}
              className="fixed inset-0 z-50 bg-black/50 overflow-y-auto p-3 sm:p-6 flex items-start sm:items-center justify-center"
              onClick={() => setEditingCourse(null)}
            >
              <div
                className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {isNewCourse ? 'Create New Course' : `Edit ${editingCourse.title || 'Course'}`}
                    </h3>
                    <div className="text-[11px] text-slate-500 font-mono">{editingCourse.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCourse(null)}
                    aria-label="Close course editor"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer touch-manipulation"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Course Title</label>
                    <input
                      type="text"
                      value={editingCourse.title || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                      className="w-full min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Category</label>
                    <input
                      type="text"
                      value={editingCourse.category || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, category: e.target.value })}
                      className="w-full min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Instructor</label>
                    <input
                      type="text"
                      value={editingCourse.instructor || ''}
                      onChange={(e) => setEditingCourse({ ...editingCourse, instructor: e.target.value })}
                      className="w-full min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Cover Image URL or Upload</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingCourse.imageUrl || ''}
                        onChange={(e) => setEditingCourse({ ...editingCourse, imageUrl: e.target.value })}
                        className="flex-1 min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                      />
                      <label className="min-h-[44px] min-w-[44px] px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center justify-center touch-manipulation">
                        <Upload className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const url = await uploadImageAsset(file, `course-images/${editingCourse.id}.jpg`);
                              setEditingCourse({ ...editingCourse, imageUrl: url });
                            } catch (err) {
                              showError(err);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Course Description</label>
                  <textarea
                    rows={3}
                    value={editingCourse.description || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                    className="w-full p-3 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                {/* Course Price & 50% Affiliate Commission Split + Course QR Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-slate-900">Course Price (₹)</label>
                    <div className="flex flex-wrap gap-2">
                      {[100, 200, 400].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditingCourse({ ...editingCourse, price: preset })}
                          className={`min-h-[38px] px-3 py-1.5 text-xs font-mono font-semibold rounded-xl border cursor-pointer touch-manipulation ${
                            Number(editingCourse.price || 0) === preset
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          ₹{preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      placeholder="Custom price in ₹"
                      value={Number(editingCourse.price || 0)}
                      onChange={(e) => setEditingCourse({ ...editingCourse, price: Number(e.target.value) })}
                      className="w-full min-h-[44px] px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                    />
                    <div className="text-[11px] font-mono text-emerald-700">
                      50% Referrer Commission: {formatINR(Math.round(Number(editingCourse.price || 0) * 50) / 100)} ·
                      Platform: {formatINR(Number(editingCourse.price || 0) - Math.round(Number(editingCourse.price || 0) * 50) / 100)}
                    </div>
                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-semibold text-slate-700">Course UPI ID (optional)</label>
                      <input
                        type="text"
                        placeholder="merchant@upi"
                        value={editingCourse.upiId || ''}
                        onChange={(e) => setEditingCourse({ ...editingCourse, upiId: e.target.value })}
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-slate-900">Course Payment QR Code</label>
                    <div className="flex items-start gap-3">
                      {editingCourse.qrCodeUrl ? (
                        <img
                          src={editingCourse.qrCodeUrl}
                          alt="Course payment QR preview"
                          className="w-28 h-28 object-contain bg-white border border-slate-200 rounded-xl p-1 shrink-0"
                        />
                      ) : (
                        <div className="w-28 h-28 bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-[11px] text-slate-400 shrink-0 text-center p-2">
                          <QrCode className="w-5 h-5 mb-1" />
                          <span>No Course QR</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <label className="min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 touch-manipulation">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {uploadingCourseQr
                              ? 'Uploading...'
                              : editingCourse.qrCodeUrl
                              ? 'Replace QR Code'
                              : 'Upload QR Code'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => void handleCourseQrUpload(e.target.files?.[0])}
                          />
                        </label>
                        {editingCourse.qrCodeUrl && (
                          <button
                            type="button"
                            onClick={() => setEditingCourse({ ...editingCourse, qrCodeUrl: '' })}
                            className="min-h-[40px] px-3 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-xl hover:bg-red-50 inline-flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove QR Code</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
  <label className="text-xs font-bold text-slate-900">
    Course Video (MP4)
  </label>

  <input
    type="text"
    placeholder="MP4 Video URL"
    value={editingCourse.videoUrl || ''}
    onChange={(e) =>
      setEditingCourse({
        ...editingCourse,
        videoUrl: e.target.value,
      })
    }
    className="w-full min-h-[40px] px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
  />
</div>

                  <div className="space-y-3">
  <label className="text-xs font-bold text-slate-900">
    Course Video (MP4 - Max 10 Minutes)
  </label>

  <input
    type="file"
    accept="video/mp4,.mp4"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const videoUrl = await uploadVideoAsset(
          file,
          `courses/${editingCourse.id}/${file.name}`
        );

    setEditingCourse((prev) =>
  prev ? { ...prev, videoUrl } : prev
);

        showSuccess('Video uploaded successfully.');
      } catch (err) {
        showError(err);
      }
    }}
    className="w-full min-h-[40px] text-xs"
  />

  {editingCourse.videoUrl && (
    <p className="text-xs text-emerald-700">
      Video uploaded successfully.
    </p>
  )}
</div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingCourse(null)}
                    className="min-h-[44px] px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await adminSaveCourse(editingCourse, isNewCourse);
                        setEditingCourse(null);
                        showSuccess('Course saved successfully.');
                      } catch (err) {
                        showError(err);
                      }
                    }}
                    className="min-h-[44px] px-5 py-2.5 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 cursor-pointer touch-manipulation"
                  >
                    Save Course
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: QR CODES & WEBSITE SETTINGS */}
      {tab === 'settings' && (
        <form onSubmit={handleSaveSettingsSubmit} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">Website, Referral & Withdrawal Settings</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Platform Name</label>
                <input
                  type="text"
                  required
                  value={settingsForm.siteName || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, siteName: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Support Email</label>
                <input
                  type="email"
                  required
                  value={settingsForm.supportEmail || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Support Phone / WhatsApp</label>
                <input
                  type="text"
                  value={settingsForm.supportPhone || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, supportPhone: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Minimum Withdrawal (₹)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={Number(settingsForm.minWithdrawal || 0)}
                  onChange={(e) => setSettingsForm({ ...settingsForm, minWithdrawal: Number(e.target.value) })}
                  className="w-full min-h-[40px] px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Default Referral Bonus (₹)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={Number(settingsForm.referralBonusDefault || 0)}
                  onChange={(e) => setSettingsForm({ ...settingsForm, referralBonusDefault: Number(e.target.value) })}
                  className="w-full min-h-[40px] px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Referral Eligibility Conditions Summary</label>
              <textarea
                rows={3}
                required
                value={settingsForm.referralConditionSummary || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, referralConditionSummary: e.target.value })}
                className="w-full p-3 text-xs border border-slate-300 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Dashboard Announcement Banner</label>
              <input
                type="text"
                value={settingsForm.announcementText || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, announcementText: e.target.value })}
                className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">Payment QR Codes & UPI IDs</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(
                [
                  { label: 'PhonePe', upiKey: 'phonepeUpiId', qrKey: 'phonepeQrUrl' },
                  { label: 'Google Pay', upiKey: 'gpayUpiId', qrKey: 'gpayQrUrl' },
                  { label: 'Paytm', upiKey: 'paytmUpiId', qrKey: 'paytmQrUrl' },
                ] as const
              ).map((item) => (
                <div key={item.label} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="text-sm font-bold text-slate-900">{item.label}</div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">{item.label} UPI ID</label>
                    <input
                      type="text"
                      placeholder="merchant@upi"
                      value={settingsForm[item.upiKey] || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, [item.upiKey]: e.target.value })}
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  {settingsForm[item.qrKey] ? (
                    <img
                      src={settingsForm[item.qrKey]}
                      alt={`${item.label} QR`}
                      className="w-36 h-36 object-contain bg-white border border-slate-200 rounded-xl mx-auto p-1"
                    />
                  ) : (
                    <div className="w-36 h-36 bg-white border border-dashed border-slate-300 rounded-xl mx-auto flex flex-col items-center justify-center text-[11px] text-slate-400">
                      <QrCode className="w-6 h-6 mb-1" />
                      <span>No QR uploaded</span>
                    </div>
                  )}

                  <label className="min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingQr === item.qrKey ? 'Uploading...' : `Upload ${item.label} QR`}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => void handleQrUpload(item.qrKey, e.target.files?.[0])}
                    />
                  </label>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="min-h-[44px] px-6 py-2.5 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800"
            >
              Save Website & QR Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 8: NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl space-y-5">
          <h2 className="text-base font-bold text-slate-900">Send Notification</h2>
          <form onSubmit={handleSendNotifSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Recipient</label>
                <select
                  value={notifTarget}
                  onChange={(e) => setNotifTarget(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="all">All Registered Users (Broadcast)</option>
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email || 'Member'} ({u.uniqueUserId || u.uid})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Type</label>
                <select
                  value={notifType}
                  onChange={(e) => setNotifType(e.target.value as NotificationItem['type'])}
                  className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="info">Information</option>
                  <option value="success">Success / Payout</option>
                  <option value="warning">Alert / Policy</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Notification Title</label>
              <input
                type="text"
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="e.g. Weekend Course Live Workshop"
                className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Message</label>
              <textarea
                rows={3}
                required
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Write a clear message..."
                className="w-full p-3 text-xs border border-slate-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800"
            >
              Send Notification
            </button>
          </form>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {screenshotModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setScreenshotModalUrl(null)}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Uploaded Payment Screenshot</span>
              <button type="button" onClick={() => setScreenshotModalUrl(null)}>
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <img
              src={screenshotModalUrl}
              alt="Payment proof"
              className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-100"
            />
          </div>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAdjustBalanceSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Adjust Balance · {adjustTarget.displayName}</h3>
              <button type="button" onClick={() => setAdjustTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={adjustBalanceType}
                onChange={(e) => setAdjustBalanceType(e.target.value as 'wallet' | 'bonus')}
                className="min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="wallet">Wallet Balance</option>
                <option value="bonus">Bonus Balance</option>
              </select>
              <select
                value={adjustDirection}
                onChange={(e) => setAdjustDirection(e.target.value as 'credit' | 'debit')}
                className="min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (-)</option>
              </select>
            </div>

            <input
              type="number"
              required
              min={1}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="Amount (₹)"
              className="w-full min-h-[40px] px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
            />
            <input
              type="text"
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Audit reason (recorded in user ledger)"
              className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
            />

            <button
              type="submit"
              className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl"
            >
              Apply Audited Adjustment
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
