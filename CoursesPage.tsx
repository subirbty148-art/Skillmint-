import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Lock,
  MessageCircle,
  PlayCircle,
  QrCode,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusLabel } from '../components/StatusLabel';
import {
  getCapturedReferralCode,
  lookupReferralCode,
  saveCapturedReferralCode,
  submitCourseOrderServer,
} from '../lib/firestoreService';
import { formatDateTime, formatINR } from '../lib/formatters';
import { Course, MembershipPlan, PaymentMethod } from '../types/models';

function resolveCoursePrice(course: Course, plans: MembershipPlan[]): number {
  const direct = Number(course.price || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const linkedPlan = plans.find((p) => p.id === course.planIdRequired);
  const planPrice = Number(linkedPlan?.price || 0);
  return Number.isFinite(planPrice) && planPrice > 0 ? planPrice : 0;
}

export const CoursesPage: React.FC = () => {
  const { courseId } = useParams<{ courseId?: string }>();
  const [searchParams] = useSearchParams();
  const { firebaseUser, courses, profile, plans, settings, buyerCourseOrders } = useAuth();
  const navigate = useNavigate();

  const activeCourse = courseId ? courses.find((c) => c.id === courseId) : null;
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null);

  // Course Checkout Modal state
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('phonepe');
  const [transactionId, setTransactionId] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referrerInfo, setReferrerInfo] = useState<{
    valid: boolean;
    selfReferral: boolean;
    ownerName: string;
  } | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Capture URL ?ref= if user opens a direct course referral link
  useEffect(() => {
    const urlRef = searchParams.get('ref');
    if (urlRef) {
      saveCapturedReferralCode(urlRef);
    }
  }, [searchParams]);

  // Live validate affiliate referral code inside checkout modal
  useEffect(() => {
    if (!checkoutCourse) return;
    const clean = referralCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      setReferrerInfo(null);
      return;
    }
    if (profile?.referralCode && clean === profile.referralCode.toUpperCase()) {
      setReferrerInfo({ valid: false, selfReferral: true, ownerName: '' });
      return;
    }
    if (clean.length < 4) {
      setReferrerInfo(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await lookupReferralCode(clean);
        if (!active) return;
        if (res && res.active) {
          if (profile && res.ownerUid === profile.uid) {
            setReferrerInfo({ valid: false, selfReferral: true, ownerName: '' });
          } else {
            setReferrerInfo({ valid: true, selfReferral: false, ownerName: res.ownerName });
          }
        } else {
          setReferrerInfo({ valid: false, selfReferral: false, ownerName: '' });
        }
      } catch {
        if (active) setReferrerInfo(null);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [checkoutCourse, referralCodeInput, profile]);

  const openCourseCheckout = (course: Course) => {
    if (!firebaseUser || !profile) {
      navigate('/login');
      return;
    }
    const lockedRef = (profile.referredByCode || '').trim().toUpperCase();
    const capturedRef = getCapturedReferralCode().trim().toUpperCase();
    const ownCode = (profile.referralCode || '').trim().toUpperCase();
    const initialRef = lockedRef || (capturedRef && capturedRef !== ownCode ? capturedRef : '');

    setCheckoutCourse(course);
    setReferralCodeInput(initialRef);
    setTransactionId('');
    setScreenshotFile(null);
    setScreenshotPreview('');
    setCheckoutError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleCopyAffiliateLink = async (cId: string) => {
    if (!profile) return;
    const url = `${window.location.origin}/courses/${cId}?ref=${profile.referralCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCourseId(cId);
      setTimeout(() => setCopiedCourseId(null), 2000);
    } catch {
      setCopiedCourseId(null);
    }
  };

  const handleSubmitCourseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !checkoutCourse) return;
    setCheckoutError('');

    if (profile.isBlocked) {
      setCheckoutError('Your account is suspended. Purchases are disabled.');
      return;
    }
    const cleanRef = referralCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanRef && profile.referralCode && cleanRef === profile.referralCode.toUpperCase()) {
      setCheckoutError('Self-referral is blocked. You cannot apply your own referral code.');
      return;
    }
    if (referrerInfo?.selfReferral) {
      setCheckoutError('Self-referral is blocked. You cannot refer your own purchase.');
      return;
    }
    if (!screenshotFile) {
      setCheckoutError('Please upload your UPI payment screenshot for verification.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitCourseOrderServer({
        courseId: checkoutCourse.id,
        method,
        transactionId,
        screenshotFile,
        referralCode: cleanRef,
      });
      setCheckoutCourse(null);
      setSuccessMessage(
        `Course order ${result.orderId} (${formatINR(result.coursePrice)}) submitted as Pending. Your course will unlock immediately after Admin payment verification.`
      );
    } catch (err: any) {
      setCheckoutError(err?.message || 'Unable to submit course payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMethodQrUrl = (m: PaymentMethod): string => {
    if (checkoutCourse?.qrCodeUrl) return checkoutCourse.qrCodeUrl;
    if (m === 'phonepe') return settings.phonepeQrUrl || '';
    if (m === 'googlepay') return settings.gpayQrUrl || '';
    return settings.paytmQrUrl || '';
  };

  const getMethodUpiId = (m: PaymentMethod): string => {
    if (checkoutCourse?.upiId) return checkoutCourse.upiId;
    if (m === 'phonepe') return settings.phonepeUpiId || '';
    if (m === 'googlepay') return settings.gpayUpiId || '';
    return settings.paytmUpiId || '';
  };

  const checkoutPrice = checkoutCourse ? resolveCoursePrice(checkoutCourse, plans) : 0;
  const activeQrUrl = getMethodQrUrl(method);
  const activeUpiId = getMethodUpiId(method);
  const upiIntentUri =
    activeUpiId && checkoutCourse && checkoutPrice > 0
      ? `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(settings.siteName || 'SkillMint')}&am=${checkoutPrice}&cu=INR&tn=${encodeURIComponent(checkoutCourse.title)}`
      : '';
  const isReferralLocked = Boolean(profile?.referredByCode);

  const renderCheckoutModal = () => {
    if (!checkoutCourse) return null;
    return (
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-checkout-title"
      >
        <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5 border border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="course-checkout-title" className="text-lg font-bold text-slate-900">
                Buy Course · {checkoutCourse.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan the course QR code, pay {checkoutPrice > 0 ? formatINR(checkoutPrice) : 'the course fee'}, and upload
                your UTR + payment screenshot.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutCourse(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              aria-label="Close course checkout"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!checkoutCourse.qrCodeUrl && (
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
          )}

          {/* QR Code Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
            {activeQrUrl ? (
              <img
                src={activeQrUrl}
                alt={`${checkoutCourse.title} payment QR code`}
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
                  Course QR is not configured yet. Ask the admin to upload a QR code for this course or platform settings.
                </p>
              </div>
            )}

            {activeUpiId && (
              <div className="text-xs text-slate-700">
                UPI ID: <span className="font-mono font-semibold select-all">{activeUpiId}</span>
              </div>
            )}
            <div className="text-sm font-bold text-slate-900 font-mono">
              Payable Amount: {checkoutPrice > 0 ? formatINR(checkoutPrice) : 'Price not set'}
            </div>
          </div>

          {checkoutError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{checkoutError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitCourseOrder} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="course-ref-code" className="block text-xs font-semibold text-slate-700">
                Affiliate / Referral Code (optional)
              </label>
              <input
                id="course-ref-code"
                type="text"
                readOnly={isReferralLocked}
                value={referralCodeInput}
                onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. SM4K9P2A"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {isReferralLocked ? (
                <div className="text-[11px] text-emerald-700">
                  Attributed to referrer code <span className="font-mono font-semibold">{profile?.referredByCode}</span>{' '}
                  (locked to your account).
                </div>
              ) : referrerInfo?.selfReferral ? (
                <div className="text-xs text-red-600 font-medium">
                  Self-referral is not allowed. Remove your own code to continue.
                </div>
              ) : referrerInfo?.valid ? (
                <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Valid affiliate partner: {referrerInfo.ownerName}</span>
                </div>
              ) : referralCodeInput.trim().length >= 4 && referrerInfo && !referrerInfo.valid ? (
                <div className="text-xs text-amber-700">
                  Referral code not found. Clear the field or enter a valid partner code.
                </div>
              ) : null}
            </div>

            {checkoutCourse.qrCodeUrl && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Payment App Used</label>
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
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="course-tx-id" className="block text-xs font-semibold text-slate-700">
                UPI Transaction ID / UTR Number
              </label>
              <input
                id="course-tx-id"
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. 432019283746"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="course-screenshot-upload" className="block text-xs font-semibold text-slate-700">
                Upload Payment Screenshot
              </label>
              <label
                htmlFor="course-screenshot-upload"
                className="min-h-[52px] px-4 py-3 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>{screenshotFile ? screenshotFile.name : 'Choose screenshot from device'}</span>
              </label>
              <input
                id="course-screenshot-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
              {screenshotPreview && (
                <img
                  src={screenshotPreview}
                  alt="Uploaded course payment proof preview"
                  className="mt-2 h-28 w-auto rounded-lg border border-slate-200 object-contain"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || checkoutPrice <= 0 || Boolean(referrerInfo?.selfReferral)}
              className="w-full min-h-[48px] px-4 py-3 bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Submitting Order...' : `Submit ₹${checkoutPrice} Payment Proof`}
            </button>
          </form>
        </div>
      </div>
    );
  };

  if (courseId && activeCourse) {
    const hasAccess = Boolean(profile && (profile.courseAccess || []).includes(activeCourse.id));
    const currentLesson = activeCourse.lessons[selectedLessonIndex] || activeCourse.lessons[0];
    const effectivePrice = resolveCoursePrice(activeCourse, plans);
    const courseCommission = Math.round(effectivePrice * 50) / 100;
    const affiliateCourseUrl = profile
      ? `${window.location.origin}/courses/${activeCourse.id}?ref=${profile.referralCode}`
      : '';
    const whatsappHref = affiliateCourseUrl
      ? `https://wa.me/?text=${encodeURIComponent(
          `Learn "${activeCourse.title}" on ${settings.siteName} for ${formatINR(effectivePrice)}! Join using my referral link: ${affiliateCourseUrl}`
        )}`
      : '';

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="min-h-[44px] inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to All Courses</span>
        </button>

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage('')} aria-label="Dismiss notice">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Player / Purchase View */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              
              {hasAccess && currentLesson?.videoUrl ? (
  <div className="aspect-video bg-slate-950">
    <video
      key={currentLesson.videoUrl}
      controls
      controlsList="nodownload"
      playsInline
      className="w-full h-full object-contain"
      poster={activeCourse.imageUrl}
    >
      <source src={currentLesson.videoUrl} type="video/mp4" />
      Your browser does not support HTML5 video playback.
    </video>
  </div>
) : (
  <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
    <Lock className="w-10 h-10 mb-4 text-emerald-400" />
    <h2 className="text-xl font-bold">Course Video Locked</h2>
    <p className="text-sm text-slate-300 mt-2">
      {hasAccess
        ? 'Video is not available yet.'
        : 'Purchase this course to unlock all lessons.'}
    </p>
    {!hasAccess && (
      <button
        type="button"
        onClick={() => openCourseCheckout(activeCourse)}
        className="mt-4 min-h-[44px] px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold"
      >
        <CreditCard className="w-4 h-4 inline mr-2" />
        Buy Course ({formatINR(effectivePrice)})
      </button>
    )}
    <Link to="/plans" className="mt-3 text-emerald-400 underline">
      Membership Plans
    </Link>
  </div>
)}
              <div className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">
                    {activeCourse.category} <span aria-hidden="true">·</span> Instructor: {activeCourse.instructor}
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-900">{formatINR(effectivePrice)}</div>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{activeCourse.title}</h1>
                <p className="text-sm text-slate-600 leading-relaxed">{activeCourse.description}</p>

                {profile && effectivePrice > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        Affiliate Commission: Earn 50% ({formatINR(courseCommission)}) per direct verified sale
                      </span>
                      <span className="font-mono text-slate-500">Your Code: {profile.referralCode}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyAffiliateLink(activeCourse.id)}
                        className="min-h-[44px] px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center gap-1.5"
                      >
                        {copiedCourseId === activeCourse.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedCourseId === activeCourse.id ? 'Course Link Copied' : 'Copy Course Referral Link'}</span>
                      </button>
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Share on WhatsApp</span>
                      </a>
                    </div>
                  </div>
                )}

                {hasAccess && currentLesson && (
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{currentLesson.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{currentLesson.summary}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCompletedLessons((prev) => ({
                          ...prev,
                          [currentLesson.id]: !prev[currentLesson.id],
                        }))
                      }
                      className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                        completedLessons[currentLesson.id]
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {completedLessons[currentLesson.id] ? 'Completed' : 'Mark Lesson Complete'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Syllabus List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Course Lessons</h2>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {activeCourse.lessons.length} lessons
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {activeCourse.lessons.map((lesson, idx) => {
                  const isActive = idx === selectedLessonIndex;
                  const isDone = Boolean(completedLessons[lesson.id]);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      disabled={!hasAccess}
                      onClick={() => setSelectedLessonIndex(idx)}
                      className={`w-full py-3 px-2.5 text-left rounded-xl flex items-start gap-3 transition-colors ${
                        isActive && hasAccess ? 'bg-slate-100' : 'hover:bg-slate-50'
                      } disabled:opacity-70`}
                    >
                      {hasAccess ? (
                        isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <PlayCircle className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                        )
                      ) : (
                        <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 leading-snug">{lesson.title}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{lesson.duration}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {renderCheckoutModal()}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Online Courses & Affiliate Catalog</h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Purchase individual skill courses via direct UPI QR or share your personal course referral link to earn a 50%
          verified affiliate commission on direct referrals.
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses
          .filter((c) => c.isActive)
          .map((course) => {
            const hasAccess = Boolean(profile && (profile.courseAccess || []).includes(course.id));
            const effectivePrice = resolveCoursePrice(course, plans);
            const commission50 = Math.round(effectivePrice * 50) / 100;
            const shareUrl = profile
              ? `${window.location.origin}/courses/${course.id}?ref=${profile.referralCode}`
              : '';
            const waLink = shareUrl
              ? `https://wa.me/?text=${encodeURIComponent(
                  `Check out "${course.title}" (${formatINR(effectivePrice)}) on ${settings.siteName}: ${shareUrl}`
                )}`
              : '';

            return (
              <div
                key={course.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
                    <img
                      src={course.imageUrl}
                      alt={course.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {course.category} <span aria-hidden="true">·</span> {course.lessons.length} Lessons
                      </span>
                      <span className={`font-semibold ${hasAccess ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {hasAccess ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-base font-bold text-slate-900">{course.title}</h2>
                      <span className="text-base font-bold font-mono text-slate-900 shrink-0">
                        {effectivePrice > 0 ? formatINR(effectivePrice) : 'Plan'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{course.description}</p>
                    <div className="text-xs text-slate-500">Instructor: {course.instructor}</div>
                    {effectivePrice > 0 && (
                      <div className="text-xs font-semibold text-emerald-700 font-mono">
                        50% Referral Commission: {formatINR(commission50)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 space-y-2">
                  {hasAccess ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/courses/${course.id}`)}
                      className="w-full min-h-[44px] px-4 py-2.5 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 flex items-center justify-center gap-2 transition-colors"
                    >
                      <BookOpen className="w-4 h-4" aria-hidden="true" />
                      <span>Watch Lessons</span>
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openCourseCheckout(course)}
                        className="min-h-[44px] px-3 py-2.5 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Buy {effectivePrice > 0 ? formatINR(effectivePrice) : 'Course'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/courses/${course.id}`)}
                        className="min-h-[44px] px-3 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Preview</span>
                      </button>
                    </div>
                  )}

                  {profile && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyAffiliateLink(course.id)}
                        className="min-h-[44px] px-3 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                      >
                        {copiedCourseId === course.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedCourseId === course.id ? 'Copied' : 'Copy Affiliate'}</span>
                      </button>
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Buyer's Course Purchase Submissions */}
      {firebaseUser && buyerCourseOrders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Your Course Purchase Orders</h2>
            <p className="text-xs text-slate-500">
              All course purchases start as Pending and unlock automatically once verified by Admin.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 pr-4 font-semibold">Course</th>
                  <th className="py-3 pr-4 font-semibold">UTR / Method</th>
                  <th className="py-3 pr-4 font-semibold">Referral Code</th>
                  <th className="py-3 pr-4 font-semibold text-right">Amount</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 font-semibold">Date & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {buyerCourseOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{order.courseTitle}</td>
                    <td className="py-3 pr-4 font-mono text-slate-700">
                      {order.transactionId} <span className="uppercase text-slate-500">({order.method})</span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-700">{order.referralCode || 'Direct'}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(order.coursePrice)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusLabel status={order.status} />
                    </td>
                    <td className="py-3 text-slate-600">
                      <div>{formatDateTime(order.createdAt)}</div>
                      {order.adminNote && <div className="text-[11px] text-slate-500 mt-0.5">{order.adminNote}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {renderCheckoutModal()}
    </div>
  );
};

