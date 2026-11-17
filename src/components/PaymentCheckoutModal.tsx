import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Loader2, ShieldAlert, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatINR } from '../lib/format';
import { uploadImageAsset } from '../lib/storageUpload';
import { submitManualPayment } from '../services/firestoreService';
import { MembershipPlan, PaymentMethod } from '../types/domain';

interface Props {
  plan: MembershipPlan;
  onClose: () => void;
  onSubmitted: () => void;
}

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'gpay', label: 'Google Pay' },
  { id: 'paytm', label: 'Paytm' },
];

export const PaymentCheckoutModal: React.FC<Props> = ({ plan, onClose, onSubmitted }) => {
  const { profile, settings } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>('phonepe');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getMethodDetails = (m: PaymentMethod) => {
    if (m === 'phonepe') {
      return { upiId: settings.phonepeUpiId || '', qrUrl: settings.phonepeQrUrl || '' };
    }
    if (m === 'gpay') {
      return { upiId: settings.gpayUpiId || '', qrUrl: settings.gpayQrUrl || '' };
    }
    return { upiId: settings.paytmUpiId || '', qrUrl: settings.paytmQrUrl || '' };
  };

  const { upiId, qrUrl } = getMethodDetails(method);
  const merchantName = settings.merchantName || settings.siteName || 'SkillMint';
  const upiDeepLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${plan.price}&cu=INR&tn=${encodeURIComponent(plan.name)}`
    : '';

  const handleCopyUpi = async () => {
    if (!upiId) return;
    await navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid screenshot image (PNG or JPG).');
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');

    if (profile.isBlocked) {
      setError('Your account is currently restricted from submitting payments.');
      return;
    }

    const cleanUtr = transactionId.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
    if (cleanUtr.length < 6) {
      setError('Enter a valid 6+ character UPI Transaction ID / UTR number.');
      return;
    }
    if (!screenshotFile) {
      setError('Please upload your payment confirmation screenshot.');
      return;
    }

    setSubmitting(true);
    try {
      const storagePath = `payment_proofs/${profile.uid}/${Date.now()}_${cleanUtr}.jpg`;
      const uploaded = await uploadImageAsset(screenshotFile, storagePath);

      await submitManualPayment({
        user: profile,
        plan,
        paymentMethod: method,
        transactionId: cleanUtr,
        screenshotUrl: uploaded.url,
      });

      onSubmitted();
    } catch (err: any) {
      setError(err.message || 'Could not submit payment proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto border border-slate-200 shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Activate {plan.name}
            </h2>
            <p className="text-xs text-slate-500">
              Amount Due: <span className="font-mono font-semibold text-slate-900">{formatINR(plan.price)}</span> · Manual Verification
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Segmented Payment Method Tabs */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Choose UPI Payment Method
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    method === m.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* QR Code & UPI ID Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={`${method} payment QR`}
                referrerPolicy="no-referrer"
                className="w-48 h-48 object-contain bg-white p-2 rounded-xl border border-slate-200"
              />
            ) : upiDeepLink ? (
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <QRCodeSVG value={upiDeepLink} size={176} level="M" />
              </div>
            ) : (
              <div className="w-48 h-40 rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-4 text-xs text-slate-500 space-y-1">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
                <p className="font-medium text-slate-700">QR Not Configured Yet</p>
                <p>Admin must upload {method.toUpperCase()} QR or UPI ID in Admin Settings.</p>
              </div>
            )}

            {upiId && (
              <div className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-xs font-mono text-slate-800 truncate">{upiId}</span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy UPI'}
                </button>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Pay exactly <strong className="font-mono text-slate-900">{formatINR(plan.price)}</strong> via{' '}
              {METHODS.find((m) => m.id === method)?.label}, then enter the 12-digit UTR / Reference ID and upload the receipt screenshot below.
            </p>
          </div>

          {/* Transaction ID Input */}
          <div>
            <label htmlFor="utr-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              UPI Transaction ID / UTR Number
            </label>
            <input
              id="utr-input"
              type="text"
              required
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. 431982741092"
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Payment Screenshot Proof
            </label>
            <label className="flex flex-col items-center justify-center w-full min-h-[112px] border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer p-4 transition-colors">
              {screenshotPreview ? (
                <div className="flex items-center gap-3 w-full">
                  <img
                    src={screenshotPreview}
                    alt="Payment screenshot preview"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">
                      {screenshotFile?.name}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">Tap to replace screenshot</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center space-y-1">
                  <Upload className="w-5 h-5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">
                    Upload Payment Receipt (PNG / JPG)
                  </span>
                  <span className="text-[11px] text-slate-500">Max 5 MB</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="pt-1 space-y-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting Verification Request...' : 'Submit Payment for Admin Review'}
            </button>
            <p className="text-[11px] text-center text-slate-500">
              Payments remain Pending until manually verified against our bank/UPI statement.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
