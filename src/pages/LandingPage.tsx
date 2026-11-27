import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Lock, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { HERO_BANNER_IMAGE } from '../data/defaults';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../lib/formatters';

export const LandingPage: React.FC = () => {
  const { firebaseUser, plans, courses, settings } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Split */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:col-span-6 flex flex-col justify-center space-y-6"
            >
              <div className="text-xs font-medium text-emerald-700">
                Digital Skills Academy · Verified Referral Rewards
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                Practical skill courses and transparent referral rewards
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                Build real digital marketing, freelancing, and creator finance skills with three independent video
                courses. Activate an affordable membership plan, share your verified partner link, and track every rupee
                in an audited ledger.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(firebaseUser ? '/dashboard' : '/register')}
                  className="min-h-[48px] px-6 py-3 bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span>{firebaseUser ? 'Open Dashboard' : 'Create Free Account'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                
              </div>

              <p className="text-xs text-slate-500">
                No guaranteed income claims. Referral rewards are unlocked only after referred members complete a
                verified plan payment.
              </p>
            </motion.div>

            <div className="lg:col-span-6">
              <div className="h-64 sm:h-80 lg:h-full min-h-[280px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={HERO_BANNER_IMAGE}
                  alt="Indian digital creator learning online skills on a laptop"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Summary Strip below Hero */}
          <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{courses.length}</div>
              <div className="text-xs text-slate-500 mt-1">Independent video courses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">₹100 – ₹400</div>
              <div className="text-xs text-slate-500 mt-1">One-time membership tiers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {formatINR(settings.minWithdrawal)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Minimum UPI withdrawal</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">100%</div>
              <div className="text-xs text-slate-500 mt-1">Manual admin UTR verification</div>
            </div>
          </div>
        </div>
      </section>

  

      {/* Independent Courses */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Independent Skill Courses</h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              Three focused video curricula designed for practical execution, independent of referral activity.
            </p>
          </div>
          <Link
            to="/courses"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
          >
            Browse course syllabus →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses
            .filter((c) => c.isActive)
            .map((course) => (
              <div
                key={course.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img
                      src={course.imageUrl}
                      alt={course.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 space-y-2.5">
                    <div className="text-xs text-slate-500">
                      {course.category} <span aria-hidden="true">·</span> {course.lessons.length} Lessons{' '}
                      <span aria-hidden="true">·</span> {course.instructor}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{course.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{course.description}</p>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => navigate(`/courses/${course.id}`)}
                    className="w-full min-h-[44px] px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    <span>View Course Details</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Transparent Security & Referral Verification */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <ShieldCheck className="w-6 h-6 text-emerald-700" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">Verified UPI Payments</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pay via PhonePe, Google Pay, or Paytm QR and submit your UTR and screenshot. No payment is marked
              successful until verified by an administrator.
            </p>
          </div>
          <div className="space-y-2">
            <Users className="w-6 h-6 text-emerald-700" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">Anti-Fraud Referral Rules</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Self-referrals and duplicate rewards are blocked at the database level. Rewards credit only when a
              referred user completes a verified membership activation.
            </p>
          </div>
          <div className="space-y-2">
            <Lock className="w-6 h-6 text-emerald-700" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">Protected Wallet Ledger</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Wallet balances are strictly read-only to user clients. All credits, referral rewards, and UPI withdrawal
              payouts are recorded in an immutable ledger.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
