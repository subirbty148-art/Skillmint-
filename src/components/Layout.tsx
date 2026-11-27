import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CreditCard,
  Home,
  LayoutDashboard,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, profile, isAdmin, settings } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/admin/login';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
      isActive
        ? 'text-white border-purple-300'
        : 'text-purple-200 border-transparent hover:text-white'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#1b0933] text-white">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 h-14 bg-[#2d1058]/95 backdrop-blur-md border-b border-purple-700/60">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand wordmark */}
          <Link
            to={firebaseUser ? '/dashboard' : '/'}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
          >
            {settings.siteName || 'SkillMint'}
          </Link>

          {/* Zone 2: 4-5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to={firebaseUser ? '/dashboard' : '/'} className={navLinkClass}>
              {firebaseUser ? 'Dashboard' : 'Home'}
            </NavLink>
            <NavLink to="/courses" className={navLinkClass}>
              Courses
            </NavLink>
            
            <NavLink to="/referrals" className={navLinkClass}>
              Referrals
            </NavLink>
            <NavLink to="/wallet" className={navLinkClass}>
              Wallet
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {firebaseUser ? (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-500 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
              >
                <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="max-w-[120px] truncate">{profile?.displayName || 'Account'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-500 transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Optional Blocked Banner */}
      {profile?.isBlocked && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-center text-xs font-medium text-red-800">
          Your account is currently suspended. Financial submissions and withdrawals are disabled. Contact support at{' '}
          {settings.supportEmail}.
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${!isAuthPage ? 'pb-20 md:pb-8' : ''}`}>{children}</main>

      {/* Footer */}
      <footer className="bg-[#2d1058] border-t border-purple-700/60 mt-12 pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="text-base font-bold text-white font-display">{settings.siteName || 'SkillMint'}</div>
              <p className="text-xs text-purple-200 leading-relaxed max-w-sm">
                Structured skill courses, transparent membership access, and verified referral rewards. Earnings depend
                on verified qualifying actions; no guaranteed income is promised.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">Platform</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-purple-200">
                <Link to="/courses" className="hover:text-white">
                  Online Courses
                </Link>
                
                <Link to="/referrals" className="hover:text-white">
                  Referral Program
                </Link>
                <Link to="/wallet" className="hover:text-white">
                  Wallet & Payouts
                </Link>
                <Link
                  to={isAdmin ? '/admin' : '/admin/login'}
                  className="hover:text-white font-medium text-purple-200 flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Admin Portal
                </Link>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">Legal & Policies</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-purple-200">
                <Link to="/legal/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
                <Link to="/legal/terms" className="hover:text-white">
                  Terms & Conditions
                </Link>
                <Link to="/legal/refund" className="hover:text-white">
                  Refund Policy
                </Link>
                <Link to="/legal/payment" className="hover:text-white">
                  Payment Policy
                </Link>
                <Link to="/legal/withdrawal" className="hover:text-white">
                  Withdrawal Policy
                </Link>
                <Link to="/contact" className="hover:text-white">
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-purple-700/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-purple-300">
            <span>© {new Date().getFullYear()} {settings.siteName || 'SkillMint'}. All rights reserved.</span>
            <span>Support: {settings.supportEmail}</span>
          </div>
        </div>
      </footer>

      {/* Fixed Mobile Bottom Navigation Bar (md:hidden) — compact 56px height to respect 15% mobile cap */}
      {!isAuthPage && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#2d1058]/95 backdrop-blur-md border-t border-purple-700/60 pb-safe"
        >
          <div className="grid grid-cols-5 h-14 items-center">
            <NavLink
              to={firebaseUser ? '/dashboard' : '/'}
              className={({ isActive }) =>
                `min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-white' : 'text-purple-300'
                }`
              }
            >
              {firebaseUser ? (
                <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Home className="w-5 h-5" aria-hidden="true" />
              )}
              <span>{firebaseUser ? 'Home' : 'Explore'}</span>
            </NavLink>

            <NavLink
              to="/courses"
              className={({ isActive }) =>
                `min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-white' : 'text-purple-300'
                }`
              }
            >
              <BookOpen className="w-5 h-5" aria-hidden="true" />
              <span>Courses</span>
            </NavLink>



            <NavLink
              to="/referrals"
              className={({ isActive }) =>
                `min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-white' : 'text-purple-300'
                }`
              }
            >
              <Users className="w-5 h-5" aria-hidden="true" />
              <span>Refer</span>
            </NavLink>

            <NavLink
              to={isAdmin && location.pathname.startsWith('/admin') ? '/admin' : '/wallet'}
              className={({ isActive }) =>
                `min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-white' : 'text-purple-300'
                }`
              }
            >
              <Wallet className="w-5 h-5" aria-hidden="true" />
              <span>Wallet</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
};
