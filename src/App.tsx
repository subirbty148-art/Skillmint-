import React, { useEffect } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LogOut, ShieldAlert } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { captureReferralCodeFromSearch } from './lib/firestoreService';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages';
import { CoursesPage } from './pages/CoursesPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import {
  ContactPage,
  PaymentPolicyPage,
  PrivacyPolicyPage,
  RefundPolicyPage,
  TermsPage,
  WithdrawalPolicyPage,
} from './pages/LegalPages';

import { ProfilePage } from './pages/ProfilePage';
import { ReferralsPage } from './pages/ReferralsPage';
import { WalletPage } from './pages/WalletPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, authReady } = useAuth();
  if (!authReady) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-xs text-slate-500">
        Loading account session...
      </div>
    );
  }
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, isAdmin, authReady, logout } = useAuth();
  if (!authReady) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-xs text-slate-500">
        Verifying administrator session...
      </div>
    );
  }
  if (!firebaseUser) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white border border-red-200 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg">
            <ShieldAlert className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>Access Denied</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Signed in as <span className="font-semibold text-slate-900">{firebaseUser.email}</span>. Only the verified
            authorized administrator account can access the admin dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Link
              to="/dashboard"
              className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center justify-center"
            >
              Return to Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign Out & Use Admin Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

const ReferralCaptureTracker: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    if (location.search) {
      captureReferralCodeFromSearch(location.search);
    }
  }, [location.search]);
  return null;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ReferralCaptureTracker />
          <Layout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:courseId" element={<CoursesPage />} />
              <Route path="/referrals" element={<ReferralsPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute>
                    <AdminPage />
                  </ProtectedAdminRoute>
                }
              />
              <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/legal/terms" element={<TermsPage />} />
              <Route path="/legal/refund" element={<RefundPolicyPage />} />
              <Route path="/legal/payment" element={<PaymentPolicyPage />} />
              <Route path="/legal/withdrawal" element={<WithdrawalPolicyPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
