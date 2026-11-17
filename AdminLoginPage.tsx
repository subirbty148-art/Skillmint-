import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, LogOut, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BOOTSTRAP_ADMIN_EMAIL } from '../lib/firebase';

export const AdminLoginPage: React.FC = () => {
  const {
    firebaseUser,
    isAdmin,
    authReady,
    loginAdminWithEmail,
    sendAdminVerificationEmail,
    resendVerificationEmail,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSentMsg, setVerificationSentMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authReady && firebaseUser && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [authReady, firebaseUser, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerificationSentMsg('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      await loginAdminWithEmail(email, password);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'admin/email-unverified') {
        setNeedsVerification(true);
        setError(err?.message || 'Administrator email is not verified. Please verify your email address before signing in.');
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid administrator email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed sign-in attempts. Please wait a moment and try again.');
      } else {
        setError(err?.message || 'Unable to verify administrator credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setError('');
    setVerificationSentMsg('');

    if (!email.trim() || !password) {
      setError('Enter your administrator email and password above before clicking "Send Verification Email".');
      return;
    }

    setSendingVerification(true);
    try {
      const result = await sendAdminVerificationEmail(email, password);
      if (result === 'already-verified') {
        await loginAdminWithEmail(email, password);
        navigate('/admin', { replace: true });
        return;
      }
      setVerificationSentMsg(
        `Verification email sent to ${email.trim()}. Open the link in your inbox (check spam if needed), then click "Sign In to Admin Dashboard".`
      );
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/too-many-requests') {
        setError(`Too many verification requests (${code}). Please wait a few minutes before requesting another email.`);
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError(
          `Firebase Auth rejected email/password sign-in (${code}). Check your password or use "Forgot password?" if Email/Password needs to be set or reset.`
        );
      } else if (code) {
        setError(`${err?.message || 'Could not send verification email.'} (${code})`);
      } else {
        setError(err?.message || 'Could not send verification email.');
      }
    } finally {
      setSendingVerification(false);
    }
  };

  const handleResendForSignedInUnverifiedAdmin = async () => {
    setError('');
    setVerificationSentMsg('');
    setSendingVerification(true);
    try {
      await resendVerificationEmail();
      setVerificationSentMsg(
        `Verification email sent to ${firebaseUser?.email}. Open the link in your inbox, then sign out and sign back in as administrator.`
      );
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/too-many-requests') {
        setError(`Too many verification requests (${code}). Please wait a few minutes before requesting another email.`);
      } else if (code) {
        setError(`${err?.message || 'Could not send verification email.'} (${code})`);
      } else {
        setError(err?.message || 'Could not send verification email.');
      }
    } finally {
      setSendingVerification(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10">
        <div className="text-xs text-slate-500">Checking administrator session...</div>
      </div>
    );
  }

  // If a signed-in user is present without verified admin access
  if (firebaseUser && !isAdmin) {
    const isUnverifiedAdminSession =
      firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && !firebaseUser.emailVerified;

    if (isUnverifiedAdminSession) {
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md bg-white border border-amber-200 rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-slate-900">Admin Email Verification Required</h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are signed in as <span className="font-semibold text-slate-900">{firebaseUser.email}</span>, but
                  this email address is not verified yet. Send a verification email below, open the link in your inbox,
                  and then sign in again.
                </p>
              </div>
            </div>

            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {verificationSentMsg && (
              <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
                <span>{verificationSentMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void handleResendForSignedInUnverifiedAdmin()}
                disabled={sendingVerification}
                className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>{sendingVerification ? 'Sending Verification Email...' : 'Send Verification Email'}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setVerificationSentMsg('');
                  await logout();
                }}
                className="w-full min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Sign Out to Admin Login Form</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-red-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900">Member Account Active</h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are currently signed in as <span className="font-semibold text-slate-900">{firebaseUser.email}</span>
                , which does not have administrator access.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={async () => {
                setError('');
                await logout();
              }}
              className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign Out to Use Admin Account</span>
            </button>
            <Link
              to="/dashboard"
              className="w-full min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
            >
              Return to Member Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>SkillMint Admin Portal</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Administrator Sign In</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Sign in with your authorized administrator email and password. Access is verified on the server before the
            admin console loads.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {verificationSentMsg && (
          <div
            role="status"
            className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
            <span>{verificationSentMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-login-email" className="block text-xs font-semibold text-slate-700">
              Administrator Email
            </label>
            <input
              id="admin-login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
                setNeedsVerification(false);
                setVerificationSentMsg('');
              }}
              placeholder="admin@example.com"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="admin-login-password" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="admin-login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter administrator password"
                className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || sendingVerification}
            className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>{loading ? 'Verifying Credentials...' : 'Sign In to Admin Dashboard'}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <p className="text-xs text-slate-600 leading-relaxed">
            First-time or unverified admin? Enter your administrator email and password above, then click below to send
            a verification link to your existing account.
          </p>
          <button
            type="button"
            onClick={() => void handleSendVerification()}
            disabled={sendingVerification || loading}
            className={`w-full min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl border transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
              needsVerification
                ? 'bg-amber-50 border-amber-400 text-amber-900 hover:bg-amber-100'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            <span>{sendingVerification ? 'Sending Verification Email...' : 'Send Verification Email'}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <Link to="/login" className="font-medium text-emerald-700 hover:text-emerald-800">
            ← Member Sign In
          </Link>
          <span className="text-slate-400">Restricted Access</span>
        </div>
      </div>
    </div>
  );
};
