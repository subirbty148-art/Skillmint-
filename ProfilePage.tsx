import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, LogOut, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateOwnProfile } from '../lib/firestoreService';

export const ProfilePage: React.FC = () => {
  const { firebaseUser, profile, isAdmin, logout, resendVerificationEmail, refreshAuthUser } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhone(profile.phone || '');
      setUpiId(profile.upiId || '');
    }
  }, [profile]);

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <Link
          to="/login"
          className="inline-flex min-h-[44px] px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl"
        >
          Sign in to view profile
        </Link>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await updateOwnProfile(profile.uid, { displayName, phone, upiId });
      setMessage('Profile updated successfully.');
    } catch (err: any) {
      setError(err?.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Profile</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Unique Member ID: {profile.uniqueUserId} <span aria-hidden="true">·</span> Auth UID: {profile.uid}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="min-h-[44px] px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>

      {isAdmin && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Authorized Administrator Account</span>
          </div>
          <Link
            to="/admin"
            className="min-h-[40px] px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 inline-flex items-center"
          >
            Open Admin Panel
          </Link>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100 text-xs">
          <div>
            <div className="text-slate-500">Email Address</div>
            <div className="font-semibold text-slate-900 mt-0.5">{profile.email}</div>
            <div className="mt-1">
              {firebaseUser.emailVerified ? (
                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Verified
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  Unverified ·{' '}
                  <button
                    type="button"
                    onClick={() => void resendVerificationEmail()}
                    className="underline hover:text-amber-900"
                  >
                    Resend
                  </button>{' '}
                  ·{' '}
                  <button
                    type="button"
                    onClick={() => void refreshAuthUser()}
                    className="underline hover:text-amber-900"
                  >
                    Refresh
                  </button>
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Referral Code & Active Plan</div>
            <div className="font-mono font-semibold text-slate-900 mt-0.5">{profile.referralCode}</div>
            <div className="text-slate-600 mt-1">{profile.activePlanName || 'No active plan'}</div>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700">
              Display Name
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700">
                Phone Number (optional)
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98XXXXXXXX"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prof-upi" className="block text-xs font-semibold text-slate-700">
                Default Payout UPI ID
              </label>
              <input
                id="prof-upi"
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="name@okaxis"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
