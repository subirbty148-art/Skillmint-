import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, MessageCircle, Share2, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusLabel } from '../components/StatusLabel';
import { formatDateTime, formatINR } from '../lib/formatters';

export const ReferralsPage: React.FC = () => {
  const { firebaseUser, profile, referrals, referredCourseOrders, transactions, settings } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Users className="w-8 h-8 text-emerald-700 mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-900">Sign in to access your Referral Link</h1>
          <p className="text-sm text-slate-600">
            Create an account to receive your unique referral code and earn 50% verified affiliate commissions.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/login"
              className="min-h-[44px] px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="min-h-[44px] px-5 py-2.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/register?ref=${profile.referralCode}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Join ${settings.siteName} online skill courses with my referral code ${profile.referralCode}: ${referralLink}`
  )}`;

  const rewardedCount = referrals.filter((r) => r.status === 'rewarded').length;
  const approvedCoursePurchases = referredCourseOrders.filter((o) => o.status === 'approved');
  const pendingCourseCommission = referredCourseOrders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + Number(o.commissionAmount || 0), 0);

  const txCommissionEarned = transactions
    .filter((tx) => tx.status === 'completed' && tx.type === 'referral_reward' && tx.direction === 'credit')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const txCommissionReversed = transactions
    .filter(
      (tx) =>
        tx.status === 'completed' &&
        tx.type === 'admin_debit' &&
        tx.direction === 'debit' &&
        (tx.title || '').toLowerCase().includes('commission')
    )
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const netCommissionEarned = Math.max(
    0,
    txCommissionEarned > 0
      ? txCommissionEarned - txCommissionReversed
      : referrals.reduce((sum, r) => sum + Number(r.rewardAmount || 0), 0)
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${settings.siteName}`,
          text: `Register on ${settings.siteName} with my referral code ${profile.referralCode}.`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopy();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Affiliate &amp; Referral Program</h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Share your unique referral link. Earn a 50% direct commission on every verified course purchase (e.g. ₹50 on
          ₹100, ₹100 on ₹200, ₹200 on ₹400), credited once Admin verifies the buyer&apos;s UPI payment.
        </p>
      </div>

      {/* Referral Summary & Share Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-slate-500">Your Unique Referral Code</div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5 select-all">
                {profile.referralCode}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-slate-500">Qualified Referrals</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                {rewardedCount} <span className="text-sm font-normal text-slate-500">/ {referrals.length}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ref-link-box" className="block text-xs font-semibold text-slate-700">
              Shareable Referral Link
            </label>
            <input
              id="ref-link-box"
              type="text"
              readOnly
              value={referralLink}
              onClick={(e) => e.currentTarget.select()}
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="min-h-[44px] px-4 py-2.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Link</span>
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2.5 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <ShieldCheck className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            <span>Affiliate Commission Rules (50% Direct)</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{settings.referralConditionSummary}</p>
          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Total Earned</div>
              <div className="text-base font-bold font-mono tabular-nums text-emerald-700">
                {formatINR(netCommissionEarned)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Pending Comm.</div>
              <div className="text-base font-bold font-mono tabular-nums text-amber-700">
                {formatINR(pendingCourseCommission)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Course Sales</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                {approvedCoursePurchases.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referred Course Purchase & Commission History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Referred Course Purchases &amp; 50% Commissions</h2>
          <Link to="/courses" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Share Course Links →
          </Link>
        </div>

        {referredCourseOrders.length === 0 ? (
          <div className="py-8 text-center space-y-1.5">
            <p className="text-sm font-medium text-slate-700">No referred course orders yet</p>
            <p className="text-xs text-slate-500">
              When buyers purchase a course through your referral link, their order and your 50% commission appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 pr-4 font-semibold">Buyer</th>
                  <th className="py-3 pr-4 font-semibold">Course</th>
                  <th className="py-3 pr-4 font-semibold text-right">Course Price</th>
                  <th className="py-3 pr-4 font-semibold text-right">Your 50% Comm.</th>
                  <th className="py-3 pr-4 font-semibold">Commission Status</th>
                  <th className="py-3 font-semibold">Order Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {referredCourseOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">{order.buyerName}</div>
                      <div className="text-slate-500">{order.buyerEmail}</div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{order.courseTitle}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-700">
                      {formatINR(order.coursePrice)}
                    </td>
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

      {/* Registered Referred Users History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Registered Referred Users</h2>

        {referrals.length === 0 ? (
          <div className="py-10 text-center space-y-1.5">
            <p className="text-sm font-medium text-slate-700">No referred signups yet</p>
            <p className="text-xs text-slate-500">
              Share your link above. When friends register with your code, they appear here immediately.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 pr-4 font-semibold">Referred User</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold text-right">Reward</th>
                  <th className="py-3 font-semibold">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">{r.referredName}</div>
                      <div className="text-slate-500">{r.referredEmail}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusLabel status={r.status} />
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(r.rewardAmount)}
                    </td>
                    <td className="py-3 text-slate-600">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

