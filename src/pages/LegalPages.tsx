import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../lib/formatters';

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

const LegalWrapper: React.FC<LegalLayoutProps> = ({ title, updated, children }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
    <div className="space-y-1 pb-4 border-b border-slate-200">
      <div className="text-xs text-slate-500">Last updated: {updated}</div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5 text-sm text-slate-700 leading-relaxed">
      {children}
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      <Link to="/legal/privacy" className="hover:text-slate-900 underline">
        Privacy Policy
      </Link>
      <Link to="/legal/terms" className="hover:text-slate-900 underline">
        Terms & Conditions
      </Link>
      <Link to="/legal/refund" className="hover:text-slate-900 underline">
        Refund Policy
      </Link>
      <Link to="/legal/payment" className="hover:text-slate-900 underline">
        Payment Policy
      </Link>
      <Link to="/legal/withdrawal" className="hover:text-slate-900 underline">
        Withdrawal Policy
      </Link>
      <Link to="/contact" className="hover:text-slate-900 underline">
        Contact Us
      </Link>
    </div>
  </div>
);

export const PrivacyPolicyPage: React.FC = () => {
  const { settings } = useAuth();
  return (
    <LegalWrapper title="Privacy Policy" updated="November 2026">
      <p>
        {settings.siteName} collects only the account information needed to authenticate your identity, manage course
        access, track verified referral attributions, and process UPI withdrawal requests.
      </p>
      <h2 className="text-base font-bold text-slate-900">1. Data Collected</h2>
      <p>
        We store your display name, email address, unique member ID, optional phone number, payout UPI ID, payment
        transaction IDs (UTRs), and payment verification screenshots in Google Firebase Authentication, Cloud Firestore,
        and Firebase Storage.
      </p>
      <h2 className="text-base font-bold text-slate-900">2. Access Isolation</h2>
      <p>
        Personal profile fields (email, phone, UPI ID, wallet balances, and payment screenshots) are restricted by
        Firestore and Storage Security Rules so only you and authorized platform administrators can view them.
      </p>
      <h2 className="text-base font-bold text-slate-900">3. Contact</h2>
      <p>For data correction or deletion inquiries, contact {settings.supportEmail}.</p>
    </LegalWrapper>
  );
};

export const TermsPage: React.FC = () => {
  const { settings } = useAuth();
  return (
    <LegalWrapper title="Terms and Conditions" updated="November 2026">
      <p>
        By creating an account on {settings.siteName}, you agree to abide by these platform terms covering online
        courses, membership plans, and referral rewards.
      </p>
      <h2 className="text-base font-bold text-slate-900">1. No Guaranteed Income</h2>
      <p>
        {settings.siteName} is an educational skills and referral partner platform. Membership plans provide access to
        independent video courses. We make zero promises or guarantees of fixed income, passive returns, or effortless
        earnings.
      </p>
      <h2 className="text-base font-bold text-slate-900">2. Referral Eligibility & Anti-Fraud</h2>
      <p>
        Self-referrals, duplicate accounts, fabricated UTR numbers, and manipulated payment screenshots are strictly
        prohibited and result in immediate account suspension and forfeiture of unverified rewards.
      </p>
      <h2 className="text-base font-bold text-slate-900">3. Wallet Integrity</h2>
      <p>
        All wallet balances and transaction records are maintained server-side and updated exclusively upon verified
        qualifying events.
      </p>
    </LegalWrapper>
  );
};

export const RefundPolicyPage: React.FC = () => {
  const { settings } = useAuth();
  return (
    <LegalWrapper title="Refund Policy" updated="November 2026">
      <h2 className="text-base font-bold text-slate-900">1. Digital Membership & Course Access</h2>
      <p>
        Membership fees (₹100, ₹200, ₹400 or as configured) unlock immediate digital video course access and membership
        bonuses once verified. Because digital courses are accessible immediately upon approval, approved memberships
        are generally non-refundable.
      </p>
      <h2 className="text-base font-bold text-slate-900">2. Duplicate or Rejected Payments</h2>
      <p>
        If a payment proof is rejected due to a mistaken duplicate transfer where funds were settled to our merchant
        account, contact {settings.supportEmail} with your bank UTR and registered email within 7 days for manual audit.
      </p>
    </LegalWrapper>
  );
};

export const PaymentPolicyPage: React.FC = () => {
  const { plans } = useAuth();
  return (
    <LegalWrapper title="Payment Policy" updated="November 2026">
      <h2 className="text-base font-bold text-slate-900">1. Accepted Payment Methods</h2>
      <p>
        All membership plans are payable via PhonePe, Google Pay, or Paytm UPI QR displayed inside the Plans checkout
        window.
      </p>
      <h2 className="text-base font-bold text-slate-900">2. Manual Verification Rules</h2>
      <p>
        Every payment submission requires a unique 6–64 character UPI Transaction ID / UTR and a clear screenshot of the
        completed transfer. Submissions always begin with status <strong>Pending</strong>. No plan, bonus, or referral
        reward is credited automatically before an administrator verifies the funds.
      </p>
      <h2 className="text-base font-bold text-slate-900">3. Current Plan Tiers & Bonuses</h2>
      <ul className="list-disc pl-5 space-y-1">
        {plans.map((p) => (
          <li key={p.id}>
            {p.name}: Fee {formatINR(p.price)} · Membership Bonus {formatINR(p.bonus)} · Qualified Referral Reward{' '}
            {formatINR(p.referralReward)}
          </li>
        ))}
      </ul>
    </LegalWrapper>
  );
};

export const WithdrawalPolicyPage: React.FC = () => {
  const { settings } = useAuth();
  return (
    <LegalWrapper title="Withdrawal Policy" updated="November 2026">
      <h2 className="text-base font-bold text-slate-900">1. Wallet Balance vs. Bonus Balance</h2>
      <p>
        Only your verified <strong>Wallet Balance</strong> (earned from qualified, admin-verified referral rewards or
        approved wallet credits) is eligible for UPI withdrawal. Membership <strong>Bonus Balance</strong> is a platform
        credit and cannot be withdrawn directly as cash unless converted by platform rules.
      </p>
      <h2 className="text-base font-bold text-slate-900">2. Minimum Withdrawal & Processing</h2>
      <p>
        The current minimum withdrawal threshold is <strong>{formatINR(settings.minWithdrawal)}</strong>. Requests are
        reviewed manually by administrators and transferred to your submitted UPI ID. Duplicate or pending requests
        cannot exceed your available balance.
      </p>
    </LegalWrapper>
  );
};

export const ContactPage: React.FC = () => {
  const { settings } = useAuth();
  return (
    <LegalWrapper title="Contact Us" updated="November 2026">
      <p>
        Need help verifying a UPI payment, checking a withdrawal reference, or reporting a technical issue? Reach our
        support desk directly using the details below.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Mail className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            <span>Support Email</span>
          </div>
          <div className="text-sm font-semibold text-slate-900">{settings.supportEmail}</div>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Phone className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            <span>Support Helpline</span>
          </div>
          <div className="text-sm font-semibold text-slate-900">{settings.supportPhone || 'Not configured'}</div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        When contacting support about a payment or withdrawal, always include your Unique Member ID and UPI UTR number.
      </p>
    </LegalWrapper>
  );
};
