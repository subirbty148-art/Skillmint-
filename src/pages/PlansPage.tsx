import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  QrCode,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusLabel } from '../components/StatusLabel';
import { submitPaymentProof } from '../lib/firestoreService';
import { formatDateTime, formatINR } from '../lib/formatters';
import { MembershipPlan, PaymentMethod } from '../types/models';

export const PlansPage: React.FC = () => {
  const { firebaseUser, profile, plans, courses, settings, payments } = useAuth();
  const navigate = useNavigate();

  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('phonepe');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const openPaymentModal = (plan: MembershipPlan) => {
    if (!firebaseUser || !profile) {
      navigate('/login');
      return;
    }
    setSelectedPlan(plan);
    setTransactionId('');
    setScreenshotFile(null);
    setScreenshotPreview('');
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const getMethodQrUrl = (m: PaymentMethod): string => {
    if (m === 'phonepe') return settings.phonepeQrUrl || '';
    if (m === 'googlepay') return settings.gpayQrUrl || '';
    return settings.paytmQrUrl || '';
  };

  const getMethodUpiId = (m: PaymentMethod): string => {
    if (m === 'phonepe') return settings.phonepeUpiId || '';
    if (m === 'googlepay') return settings.gpayUpiId || '';
    return settings.paytmUpiId || '';
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedPlan) return;
    setError('');

    if (profile.isBlocked) {
      setError('Your account is suspended. Payments cannot be submitted.');
      return;
    }
    if (!screenshotFile) {
      setError('Please upload your UPI payment screenshot for verification.');
      return;
    }

    setSubmitting(true);
    try {
      const paymentId = await submitPaymentProof({
        user: profile,
        plan: selectedPlan,
        method,
        transactionId,
        screenshotFile,
      });
      setSelectedPlan(null);
      setSuccessMessage(
        `Payment proof ${paymentId} submitted with status Pending. Your plan and bonus will activate once an administrator verifies your Transaction ID.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to submit payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeQrUrl = getMethodQrUrl(method);
  const activeUpiId = getMethodUpiId(method);
  const upiIntentUri =
    activeUpiId && selectedPlan
      ? `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(settings.siteName || 'SkillMint')}&am=${selectedPlan.price}&cu=INR&tn=${encodeURIComponent(selectedPlan.name)}`
      : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Membership Plans</h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Every plan clearly discloses its one-time fee, membership bonus, course access, and referral verification
          conditions. No income is guaranteed.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
            <div>
              <span className="font-semibold">Verification Pending: </span>
              <span>{successMessage}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-emerald-800 hover:text-emerald-950 p-1"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans
          .filter((p) => p.isActive)
          .map((plan) => {
            const isCurrentPlan = profile?.activePlanId === plan.id;
            const unlockedCourseTitles = courses
              .filter((c) => plan.courseIds.includes(c.id))
              .map((c) => c.title);

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-6 flex flex-col justify-between space-y-6 border ${
                  isCurrentPlan ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{plan.tagline}</p>
                    </div>
                    {isCurrentPlan && (
                      <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Active Plan</span>
                    )}
                  </div>

                  <div className="pb-4 border-b border-slate-100 space-y-1">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                        {formatINR(plan.price)}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                        +{formatINR(plan.bonus)} Membership Bonus
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Qualified Referral Reward:{' '}
                      <span className="font-mono font-semibold text-slate-900">{formatINR(plan.referralReward)}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-800">Courses Included</div>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {unlockedCourseTitles.map((title) => (
                        <li key={title} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                          <span>{title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-800">Eligibility & Terms</div>
                    <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
                      {plan.conditions.map((cond, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{cond}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openPaymentModal(plan)}
                  className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" aria-hidden="true" />
                  <span>{isCurrentPlan ? 'Renew / Re-Submit Payment' : `Pay ${formatINR(plan.price)} via UPI QR`}</span>
                </button>
              </div>
            );
          })}
      </div>

      {/* User Payment History */}
      {firebaseUser && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Your Payment Submissions</h2>
            <p className="text-xs text-slate-500">
              All submissions begin as Pending and are manually verified against bank/UPI statements.
            </p>
          </div>

          {payments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              You have not submitted any membership payment proofs yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-3 pr-4 font-semibold">Plan</th>
                    <th className="py-3 pr-4 font-semibold">Method</th>
                    <th className="py-3 pr-4 font-semibold">Transaction ID</th>
                    <th className="py-3 pr-4 font-semibold text-right">Amount</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 font-semibold">Date & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{p.planName}</td>
                      <td className="py-3 pr-4 uppercase text-slate-600">{p.method}</td>
                      <td className="py-3 pr-4 font-mono text-slate-700">{p.transactionId}</td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusLabel status={p.status} />
                      </td>
                      <td className="py-3 text-slate-600">
                        <div>{formatDateTime(p.createdAt)}</div>
                        {p.adminNote && <div className="text-[11px] text-slate-500 mt-0.5">{p.adminNote}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual UPI QR Payment Modal */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="payment-modal-title" className="text-lg font-bold text-slate-900">
                  Pay {formatINR(selectedPlan.price)} for {selectedPlan.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Scan QR in PhonePe, Google Pay, or Paytm, then upload your UTR and screenshot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close payment window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { key: 'phonepe', label: 'PhonePe' },
                  { key: 'googlepay', label: 'Google Pay' },
                  { key: 'paytm', label: 'Paytm' },
                ] as { key: PaymentMethod; label: string }[]
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMethod(item.key)}
                  className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    method === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* QR Display */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
              {activeQrUrl ? (
                <img
                  src={activeQrUrl}
                  alt={`${method} payment QR code`}
                  className="w-48 h-48 object-contain bg-white p-2 rounded-xl border border-slate-200"
                />
              ) : upiIntentUri ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <QRCodeSVG value={upiIntentUri} size={176} />
                </div>
              ) : (
                <div className="w-48 h-48 bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <QrCode className="w-8 h-8 text-slate-400" aria-hidden="true" />
                  <p className="text-xs text-slate-500">
                    Admin has not uploaded the {method.toUpperCase()} QR image or UPI ID yet. Configure it in Admin
                    Settings.
                  </p>
                </div>
              )}

              {activeUpiId && (
                <div className="text-xs text-slate-700">
                  UPI ID: <span className="font-mono font-semibold select-all">{activeUpiId}</span>
                </div>
              )}
              <div className="text-xs font-semibold text-slate-900 font-mono">
                Payable Amount: {formatINR(selectedPlan.price)}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="tx-id-input" className="block text-xs font-semibold text-slate-700">
                  UPI Transaction ID / UTR Number
                </label>
                <input
                  id="tx-id-input"
                  type="text"
                  required
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. 432019283746"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="screenshot-upload" className="block text-xs font-semibold text-slate-700">
                  Upload Payment Screenshot
                </label>
                <label
                  htmlFor="screenshot-upload"
                  className="min-h-[52px] px-4 py-3 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>{screenshotFile ? screenshotFile.name : 'Choose screenshot from device'}</span>
                </label>
                <input
                  id="screenshot-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                {screenshotPreview && (
                  <img
                    src={screenshotPreview}
                    alt="Uploaded payment proof preview"
                    className="mt-2 h-28 w-auto rounded-lg border border-slate-200 object-contain"
                  />
                )}
              </div>

              <div className="text-[11px] text-slate-500">
                Submitting creates a Pending verification ticket. Your account is never credited automatically without
                Admin approval.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] px-4 py-3 bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Submitting Proof...' : 'Submit Payment for Verification'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
