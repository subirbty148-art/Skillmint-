import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound, Mail, UserPlus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getCapturedReferralCode, lookupReferralCode } from '../firestoreService';
export const LoginPage: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, firebaseUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (firebaseUser) navigate('/dashboard', { replace: true });
  }, [firebaseUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Sign in to SkillMint</h1>
          <p className="text-sm text-slate-600">Access your courses, referral dashboard, and wallet ledger.</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-slate-500">or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4 text-slate-600" aria-hidden="true" />
          <span>Continue with Google</span>
        </button>

        <div className="space-y-2 text-center text-xs text-slate-600">
          <p>
            New to SkillMint?{' '}
            <Link to="/register" className="font-semibold text-emerald-700 hover:text-emerald-800">
              Create an account
            </Link>
          </p>
          <p>
            Platform administrator?{' '}
            <Link to="/admin/login" className="font-semibold text-slate-900 hover:text-emerald-700 underline">
              Admin Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { registerWithEmail, loginWithGoogle, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(
    searchParams.get('ref')?.toUpperCase() || getCapturedReferralCode()
  );
  const [referrerInfo, setReferrerInfo] = useState<{ name: string; valid: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (firebaseUser) navigate('/dashboard', { replace: true });
  }, [firebaseUser, navigate]);

  useEffect(() => {
    const clean = referralCode.trim().toUpperCase();
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
          setReferrerInfo({ name: res.ownerName, valid: true });
        } else {
          setReferrerInfo({ name: '', valid: false });
        }
      } catch {
        if (active) setReferrerInfo(null);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [referralCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail({
        name,
        email,
        password,
        referralCode: referralCode.trim().toUpperCase(),
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(referralCode.trim().toUpperCase());
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Google sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Create your SkillMint account</h1>
          <p className="text-sm text-slate-600">
            Receive your unique Member ID and personal referral code upon registration.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700">
              Full Name
            </label>
            <input
              id="reg-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Sharma"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700">
              Password (min. 6 characters)
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-ref" className="block text-xs font-semibold text-slate-700">
              Referral Code (optional)
            </label>
            <input
              id="reg-ref"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="e.g. SM4K9P2A"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {referrerInfo && referrerInfo.valid && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Referred by {referrerInfo.name}</span>
              </div>
            )}
            {referrerInfo && !referrerInfo.valid && referralCode.trim().length >= 4 && (
              <div className="text-xs text-amber-700 pt-1">
                Referral code not found. You can still register without a code.
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-slate-500">or sign up with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4 text-slate-600" aria-hidden="true" />
          <span>Continue with Google</span>
        </button>

        <p className="text-center text-xs text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-600">Enter your registered email to receive a password reset link.</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {sent ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-900">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Password reset email sent</span>
            </div>
            <p>Check your inbox (and spam folder) for the link to set a new password.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700">
                Registered Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-600">
          Remembered your password?{' '}
          <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
