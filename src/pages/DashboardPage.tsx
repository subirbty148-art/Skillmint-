import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  Check,
  Copy,
  CreditCard,
  MailWarning,
  MessageCircle,
  Share2,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusLabel } from '../components/StatusLabel';
import { formatDateTime, formatINR } from '../lib/formatters';

const VERIFIED_EARNING_TX_TYPES = new Set(['referral_reward', 'plan_bonus', 'admin_credit']);

function toValidDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (typeof ts.toMillis === 'function') {
    const d = new Date(ts.toMillis());
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts.seconds === 'number') {
    const d = new Date(ts.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

export const DashboardPage: React.FC = () => {
  const {
    firebaseUser,
    profile,
    isAdmin,
    courses,
    transactions,
    payments,
    referrals,
    referredCourseOrders,
    notifications,
    settings,
    resendVerificationEmail,
    refreshAuthUser,
  } = useAuth();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  const { dailyEarning, weeklyEarning, yearlyEarning, currentYear } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
    const startOfNextWeek = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + 7,
      0,
      0,
      0,
      0
    );

    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);

    let daily = 0;
    let weekly = 0;
    let yearly = 0;

    for (const tx of transactions) {
      if (tx.status !== 'completed') continue;
      if (tx.direction !== 'credit') continue;
      if (!VERIFIED_EARNING_TX_TYPES.has(tx.type)) continue;

      const amount = Number(tx.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const txDate = toValidDate(tx.createdAt);
      if (!txDate) continue;

      if (txDate >= startOfToday && txDate < startOfTomorrow) {
        daily += amount;
      }
      if (txDate >= startOfWeek && txDate < startOfNextWeek) {
        weekly += amount;
      }
      if (txDate >= startOfYear && txDate < startOfNextYear) {
        yearly += amount;
      }
    }

    return {
      dailyEarning: daily,
      weeklyEarning: weekly,
      yearlyEarning: yearly,
      currentYear: now.getFullYear(),
    };
  }, [transactions]);

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/register?ref=${profile.referralCode}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Join ${settings.siteName} skill courses using my referral code ${profile.referralCode}: ${referralLink}`
  )}`;
  const unlockedCourses = courses.filter((c) => (profile.courseAccess || []).includes(c.id));
  const pendingPaymentsCount = payments.filter((p) => p.status === 'pending').length;

  const successfulReferralPurchases = referredCourseOrders.filter((o) => o.status === 'approved');
  const pendingReferralCommission = referredCourseOrders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + Number(o.commissionAmount || 0), 0);
  const totalReferralCommissionEarned = transactions
    .filter((tx) => tx.status === 'completed' && tx.type === 'referral_reward' && tx.direction === 'credit')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalCommissionReversed = transactions
    .filter(
      (tx) =>
        tx.status === 'completed' &&
        tx.type === 'admin_debit' &&
        tx.direction === 'debit' &&
        (tx.title || '').toLowerCase().includes('commission')
    )
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const netReferralCommission = Math.max(0, totalReferralCommissionEarned - totalCommissionReversed);
  const referralTransactions = transactions.filter(
    (tx) =>
      tx.type === 'referral_reward' ||
      (tx.type === 'admin_debit' && (tx.title || '').toLowerCase().includes('commission'))
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${settings.siteName}`,
          text: `Explore online skill courses on ${settings.siteName} using my referral code ${profile.referralCode}.`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyLink();
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail();
      setVerifyMsg('Verification email sent. Check your inbox.');
    } catch (e: any) {
      setVerifyMsg(e?.message || 'Could not send email right now.');
    }
  };

  const handleRefreshVerification = async () => {
    const ok = await refreshAuthUser();
    setVerifyMsg(ok ? 'Email verified successfully.' : 'Email is still pending verification.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Header Greeting & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-mono">
            Member ID: {profile.uniqueUserId} <span aria-hidden="true">·</span> Code: {profile.referralCode}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Welcome back, {profile.displayName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="min-h-[44px] px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Admin Console</span>
            </button>
          )}
          
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Wallet className="w-4 h-4" aria-hidden="true" />
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {/* Email Verification Prompt if unverified */}
      {firebaseUser && !firebaseUser.emailVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900">
            <MailWarning className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold">Verify your email address ({firebaseUser.email}).</span>{' '}
              <span>{verifyMsg || 'Check your inbox for the Firebase verification link.'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResendVerification}
              className="min-h-[36px] px-3 py-1.5 bg-white border border-amber-300 text-amber-900 text-xs font-semibold rounded-lg hover:bg-amber-100"
            >
              Resend Link
            </button>
            <button
              type="button"
              onClick={handleRefreshVerification}
              className="min-h-[36px] px-3 py-1.5 bg-amber-900 text-white text-xs font-semibold rounded-lg hover:bg-amber-800"
            >
              Refresh Status
            </button>
          </div>
        </div>
      )}

      {/* Announcement */}
      {settings.announcementText && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-2.5">
          <Bell className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{settings.announcementText}</span>
        </div>
      )}

      {/* 4 Core Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-700 rounded-2xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-white">Total Wallet Balance</div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
            {formatINR(profile.walletBalance)}
          </div>
          <div className="text-xs text-white font-medium">Withdrawable via UPI</div>
        </div>

        <div className="bg-green-700 rounded-2xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-white">Available Bonus</div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
            {formatINR(profile.bonusBalance)}
          </div>
          <div className="text-xs text-white">Plan membership bonus</div>
        </div>

        <div className="bg-green-700 rounded-2xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-white">Total Earnings</div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
            {formatINR(profile.totalEarnings)}
          </div>
          <div className="text-xs text-white">Cumulative verified rewards</div>
        </div>

        <div className="bg-green-700 rounded-2xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-white">Total Referrals</div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
            {profile.totalReferrals}
          </div>
          <div className="text-xs text-white">Verified qualified partners</div>
        </div>
      </div>

      {/* Period Earning Breakdown Cards (Today / Weekly / Yearly) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Verified Earnings Summary">
        <div className="bg-red-600 rounded-2xl p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">Today / Daily Earning</span>
            <Calendar className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
            {formatINR(dailyEarning)}
          </div>
          <div className="text-xs text-white font-medium">Verified earnings today</div>
        </div>

        <div className="bg-green-700 rounded-2xl p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">Weekly Earning</span>
            <CalendarDays className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
            {formatINR(weeklyEarning)}
          </div>
          <div className="text-xs text-white font-medium">Current calendar week</div>
        </div>

        <div className="bg-yellow-400 rounded-2xl p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-950">Yearly Earning</span>
            <TrendingUp className="w-4 h-4 text-slate-950 shrink-0" aria-hidden="true" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-950 font-mono tabular-nums">
            {formatINR(yearlyEarning)}
          </div>
          <div className="text-xs text-slate-900 font-medium">Calendar year {currentYear}</div>
        </div>
      </div>

      {/* Active Plan + Course Access + Referral Link Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Plan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500">Active Plan</div>
            <div className="text-xl font-bold text-slate-900">
              {profile.activePlanName || 'No Active Membership'}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {profile.activePlanName
                ? 'Your membership is verified and active.'
                : pendingPaymentsCount > 0
                ? `You have ${pendingPaymentsCount} payment submission pending Admin verification.`
                : 'Select a ₹100, ₹200, or ₹400 plan to unlock video courses and bonus rewards.'}
            </p>
          </div>
          <Link
            to="/plans"
            className="min-h-[44px] px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center justify-center gap-2"
          >
            <span>{profile.activePlanName ? 'View Membership Plans' : 'Choose a Plan'}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Course Access */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">Course Access</div>
            <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              {unlockedCourses.length} / {courses.length} Courses Unlocked
            </div>
            {unlockedCourses.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-700">
                {unlockedCourses.map((c) => (
                  <li key={c.id} className="truncate">
                    <Link to={`/courses/${c.id}`} className="hover:text-emerald-700 font-medium">
                      • {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600">
                Unlock independent digital skill courses by activating a membership plan.
              </p>
            )}
          </div>
          <Link
            to="/courses"
            className="min-h-[44px] px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center justify-center gap-2"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open Courses</span>
          </Link>
        </div>

        {/* Referral Quick Share */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">Your Referral Link</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{profile.referralCode}</div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 truncate">
              {referralLink}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[44px] px-2.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleShareLink}
              className="min-h-[44px] px-2.5 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Share</span>
            </button>
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-2.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 inline-flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* Affiliate & Course Referral Earnings Overview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Affiliate &amp; Course Referral Earnings (50% Direct)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              My Referral ID: <span className="font-mono font-bold text-slate-900">{profile.referralCode}</span> ·
              Registered Referrals: <span className="font-mono font-semibold">{referrals.length}</span>
            </p>
          </div>
          <Link to="/referrals" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Full Affiliate Hub →
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Total Referrals</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {Math.max(Number(profile.totalReferrals || 0), referrals.length)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Successful Purchases</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {successfulReferralPurchases.length}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Total Commission</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-700">
              {formatINR(netReferralCommission)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Available Commission</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatINR(profile.walletBalance)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1 col-span-2 lg:col-span-1">
            <div className="text-xs text-slate-500">Pending Commission</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-700">
              {formatINR(pendingReferralCommission)}
            </div>
          </div>
        </div>

        {/* Referral Transaction History */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-900">Referral Purchase &amp; Commission History</div>
          {referredCourseOrders.length === 0 && referralTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">
              No referral course purchases or commission transactions yet. Share your course link to earn 50% per
              verified purchase.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {referredCourseOrders.slice(0, 6).map((order) => (
                <div key={order.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {order.buyerName} · {order.courseTitle}
                    </div>
                    <div className="text-slate-500">
                      Order {formatINR(order.coursePrice)} · {formatDateTime(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="font-mono font-bold text-emerald-700">+{formatINR(order.commissionAmount)}</div>
                    <StatusLabel status={order.commissionStatus || order.status} />
                  </div>
                </div>
              ))}
              {referredCourseOrders.length === 0 &&
                referralTransactions.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{tx.title}</div>
                      <div className="text-slate-500">{formatDateTime(tx.createdAt)}</div>
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
      </div>

      {/* Recent Transactions + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
            <Link to="/wallet" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              Full Ledger →
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-700">No verified wallet transactions yet</p>
              <p className="text-xs text-slate-500">
                Transactions appear here after an administrator verifies a membership payment, referral reward, or
                withdrawal payout.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{tx.title}</div>
                    <div className="text-xs text-slate-500">
                      {tx.balanceType === 'bonus' ? 'Bonus Balance' : 'Wallet Balance'} <span aria-hidden="true">·</span>{' '}
                      {formatDateTime(tx.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        tx.direction === 'credit' ? 'text-emerald-700' : 'text-slate-900'
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

        {/* Notifications */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Notifications</h2>
            <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>

          {notifications.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No notifications yet. Account updates and platform announcements appear here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="py-3 space-y-1">
                  <div className="text-xs font-semibold text-slate-900">{n.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                  <div className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
