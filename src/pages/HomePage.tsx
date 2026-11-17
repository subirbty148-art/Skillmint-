import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatINR } from '../lib/format';

export const HomePage: React.FC = () => {
  const { firebaseUser, plans, courses, settings } = useAuth();
  const navigate = useNavigate();

  const publishedCourses = courses.filter((c) => c.isPublished).slice(0, 3);
  const activePlans = plans.filter((p) => p.isActive).slice(0, 3);

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero Split Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span>Digital Skills Academy</span>
                <span aria-hidden="true">·</span>
                <span>Verified Referral Rewards</span>
                <span aria-hidden="true">·</span>
                <span>UPI Payouts</span>
              </div>

              <h1
                className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] max-w-2xl"
                style={{ textWrap: 'balance' }}
              >
                Learn high-demand digital skills and earn transparent referral rewards.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
                Enroll in practical self-paced courses, activate a transparent membership pass starting at ₹100, and earn verified partner rewards when your referrals activate qualifying plans.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(firebaseUser ? '/dashboard' : '/register')}
                  className="min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {firebaseUser ? 'Open Member Dashboard' : 'Create Free Account'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/plans"
                  className="min-h-[48px] px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl transition-colors flex items-center whitespace-nowrap"
                >
                  Compare Membership Plans
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-64 sm:h-80 lg:h-full min-h-[280px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src="/src/assets/images/hero_skill_studio_1794771472791.jpg"
                  alt="Creator working on digital marketing and freelance coursework"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-column Mechanism Strip */}
          <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>3 Independent Courses</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Structured video modules across digital marketing, freelancing, and creator finance.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Manual UPI Verification</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every PhonePe, Google Pay, and Paytm UTR is verified before plan activation.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verified Referral Ledger</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Rewards credit only after a referred member completes verified plan activation.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Direct UPI Withdrawals</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Request payouts to your verified UPI ID starting from {formatINR(settings.minWithdrawalAmount)}.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Membership Plans Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Transparent Membership Passes
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              Choose a tier aligned with your learning goals. Welcome bonuses and referral eligibility are clearly stated with no hidden fees.
            </p>
          </div>
          <Link
            to="/plans"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap flex items-center gap-1"
          >
            View all eligibility rules
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activePlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-slate-900">{plan.name}</h3>
                  <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {formatINR(plan.price)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Welcome Bonus: <strong className="font-mono text-emerald-700">{formatINR(plan.signupBonus)}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Referral Reward: <strong className="font-mono text-slate-900">{formatINR(plan.referralBonus)}</strong></span>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{plan.description}</p>

                <ul className="space-y-2 pt-2 border-t border-slate-100">
                  {plan.eligibilityConditions.slice(0, 3).map((cond, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{cond}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => navigate('/plans')}
                className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Select {plan.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Independent Courses Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Three Independent Skill Tracks
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              Self-paced video lessons focused on real digital execution, client acquisition, and financial discipline.
            </p>
          </div>
          <Link
            to="/courses"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap flex items-center gap-1"
          >
            Browse curriculum
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {publishedCourses.map((course) => (
            <Link
              key={course.id}
              to="/courses"
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <img
                  src={course.imageUrl}
                  alt={course.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              </div>
              <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{course.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{course.durationLabel || `${course.lessons.length} Lessons`}</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>
                </div>
                <p className="text-xs font-medium text-slate-500 pt-3 border-t border-slate-100">
                  Instructor: {course.instructor}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Honest Compliance Disclosure */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">
              Earnings & Verification Transparency Notice
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              SkillMint is an educational course and verified referral rewards platform. We never promise guaranteed income, passive returns, or instant payouts. All referral rewards depend on qualifying plan purchases manually verified by our team, and withdrawals are subject to minimum balance thresholds and UPI validation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to="/legal/terms"
              className="min-h-[44px] px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center"
            >
              Read Terms & Eligibility
            </Link>
            <Link
              to="/legal/payment"
              className="min-h-[44px] px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center"
            >
              Payment Verification Rules
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
