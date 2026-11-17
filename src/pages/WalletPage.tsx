import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, CheckCircle2, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusLabel } from '../components/StatusLabel';
import { submitWithdrawalRequest } from '../lib/firestoreService';
import { formatDateTime, formatINR } from '../lib/formatters';

type HistoryTab = 'all' | 'referrals' | 'payments' | 'withdrawals';

export const WalletPage: React.FC = () => {
  const { firebaseUser, profile, transactions, payments, withdrawals, settings } = useAuth();
  const [tab, setTab] = useState<HistoryTab>('all');
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState(profile?.upiId || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Wallet className="w-8 h-8 text-emerald-700 mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-900">Sign in to manage your Wallet</h1>
          <p className="text-sm text-slate-600">
            View your withdrawable balance, membership bonus, verified referral payouts, and withdrawal requests.
          </p>
          <Link
            to="/login"
            className="inline-flex min-h-[44px] px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 items-center"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const pendingHold = withdrawals
    .filter((w) => w.status === 'pending')
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const availableToWithdraw = Math.max(0, Number(profile.walletBalance || 0) - pendingHold);

  const referralTransactions = transactions.filter((t) => t.type === 'referral_reward');

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (profile.isBlocked) {
      setError('Your account is currently suspended. Withdrawals are disabled.');
      return;
    }

    setSubmitting(true);
    try {
      const id = await submitWithdrawalRequest({
        user: profile,
        amount: Number(amount),
        upiId: upiId || profile.upiId || '',
        minWithdrawal: settings.minWithdrawal,
        pendingHoldAmount: pendingHold,
      });
      setAmount('');
      setSuccess(
        `Withdrawal request ${id} submitted as Pending. An administrator will verify and transfer to your UPI ID.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Wallet & Withdrawals</h1>
        <p className="text-sm text-slate-600">
          All wallet credits and debits are verified and recorded securely. Users cannot alter balances directly.
        </p>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Available Wallet Balance</div>
          <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(profile.walletBalance)}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Withdrawable after holds: {formatINR(availableToWithdraw)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Bonus Balance</div>
          <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(profile.bonusBalance)}
          </div>
          <div className="text-xs text-slate-500">Non-withdrawable membership bonus</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Pending Withdrawals</div>
          <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums">{formatINR(pendingHold)}</div>
          <div className="text-xs text-slate-500">
            Min. withdrawal: <span className="font-mono font-semibold">{formatINR(settings.minWithdrawal)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Withdrawal Form */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 h-fit">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Request UPI Withdrawal</h2>
            <p className="text-xs text-slate-500">
              Minimum payout is {formatINR(settings.minWithdrawal)}. Processed manually after audit.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="withdraw-amount" className="block text-xs font-semibold text-slate-700">
                Amount (INR)
              </label>
              <input
                id="withdraw-amount"
                type="number"
                required
                min={settings.minWithdrawal}
                max={availableToWithdraw > 0 ? availableToWithdraw : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${settings.minWithdrawal}`}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="withdraw-upi" className="block text-xs font-semibold text-slate-700">
                Your UPI ID
              </label>
              <input
                id="withdraw-upi"
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. yourname@okhdfcbank"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || availableToWithdraw < settings.minWithdrawal}
              className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Submitting Request...' : 'Submit Withdrawal Request'}</span>
            </button>
          </form>
        </div>

        {/* Tabbed Ledger History */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            {(
              [
                { id: 'all', label: 'All Transactions' },
                { id: 'referrals', label: 'Referral Rewards' },
                { id: 'payments', label: 'Payments' },
                { id: 'withdrawals', label: 'Withdrawals' },
              ] as { id: HistoryTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'all' && (
            <div className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">No ledger transactions recorded yet.</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{tx.title}</div>
                      <div className="text-xs text-slate-500">
                        {tx.balanceType === 'bonus' ? 'Bonus' : 'Wallet'} <span aria-hidden="true">·</span>{' '}
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
                ))
              )}
            </div>
          )}

          {tab === 'referrals' && (
            <div className="divide-y divide-slate-100">
              {referralTransactions.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">No verified referral rewards credited yet.</div>
              ) : (
                referralTransactions.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{tx.title}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(tx.createdAt)}</div>
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                      +{formatINR(tx.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'payments' && (
            <div className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">No membership payment submissions yet.</div>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {p.planName} ({p.method.toUpperCase()})
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        UTR: {p.transactionId} <span aria-hidden="true">·</span> {formatDateTime(p.createdAt)}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                        {formatINR(p.amount)}
                      </div>
                      <StatusLabel status={p.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'withdrawals' && (
            <div className="divide-y divide-slate-100">
              {withdrawals.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">No withdrawal requests submitted yet.</div>
              ) : (
                withdrawals.map((w) => (
                  <div key={w.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900 font-mono">{w.upiId}</div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(w.createdAt)}
                        {w.payoutRef ? ` · Ref: ${w.payoutRef}` : ''}
                      </div>
                      {w.adminNote && <div className="text-[11px] text-slate-500 mt-0.5">{w.adminNote}</div>}
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                        {formatINR(w.amount)}
                      </div>
                      <StatusLabel status={w.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
