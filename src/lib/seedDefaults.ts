import { Course, MembershipPlan, PlatformSettings } from '../types/domain';

export const DEFAULT_PLANS: Omit<MembershipPlan, 'updatedAt'>[] = [
  {
    id: 'plan_starter',
    name: 'Starter Skill Pass',
    tierOrder: 1,
    price: 100,
    referralBonus: 50,
    signupBonus: 50,
    description:
      'Foundational digital marketing track with verified partner referral eligibility and ₹50 welcome bonus upon manual payment approval.',
    eligibilityConditions: [
      'One-time ₹100 plan fee verified manually via UPI UTR check',
      '₹50 welcome bonus credited to Bonus Balance after payment approval',
      'Referrer earns ₹50 Wallet reward only after your referred friend activates a plan',
      'No guaranteed or fixed income is promised; rewards depend on verified referrals',
    ],
    includedCourseIds: ['course_digital_growth'],
    isActive: true,
  },
  {
    id: 'plan_growth',
    name: 'Growth Creator Pass',
    tierOrder: 2,
    price: 200,
    referralBonus: 100,
    signupBonus: 100,
    description:
      'Expanded two-course skill bundle covering Digital Marketing and High-Income Freelancing, plus ₹100 welcome bonus on activation.',
    eligibilityConditions: [
      'One-time ₹200 plan fee verified manually via UPI UTR check',
      '₹100 welcome bonus credited to Bonus Balance after payment approval',
      'Earn ₹100 verified referral reward per approved Growth or higher referral',
      'Unlocks Course 1 (Digital Growth) and Course 2 (Freelancing Mastery)',
    ],
    includedCourseIds: ['course_digital_growth', 'course_freelance_craft'],
    isActive: true,
  },
  {
    id: 'plan_pro',
    name: 'Pro Partner Pass',
    tierOrder: 3,
    price: 400,
    referralBonus: 200,
    signupBonus: 200,
    description:
      'Complete three-course academy access including Creator Monetization & Personal Finance, with ₹200 welcome bonus on activation.',
    eligibilityConditions: [
      'One-time ₹400 plan fee verified manually via UPI UTR check',
      '₹200 welcome bonus credited to Bonus Balance after payment approval',
      'Earn up to ₹200 verified referral reward per approved Pro referral',
      'Full access to all 3 independent SkillMint courses and future lesson updates',
    ],
    includedCourseIds: [
      'course_digital_growth',
      'course_freelance_craft',
      'course_creator_finance',
    ],
    isActive: true,
  },
];

export const DEFAULT_COURSES: Omit<Course, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'course_digital_growth',
    title: 'Digital Marketing & Audience Growth',
    subtitle: 'Organic social channels, content systems, and conversion funnels',
    description:
      'Learn practical content production, short-form video scripting, SEO fundamentals, and ethical affiliate/referral funnel design tailored for Indian digital creators.',
    category: 'Digital Marketing',
    imageUrl: '/src/assets/images/course_digital_growth_1794771473697.jpg',
    instructor: 'Arjun Deshmukh',
    durationLabel: '4 Lessons · 2h 15m',
    requiredPlanIds: ['plan_starter', 'plan_growth', 'plan_pro'],
    isPublished: true,
    lessons: [
      {
        id: 'dg_1',
        order: 1,
        title: '01. Positioning Your Niche & Audience Trust',
        duration: '28m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        summary:
          'How to choose an evergreen educational niche, define audience pain points, and avoid clickbait claims.',
      },
      {
        id: 'dg_2',
        order: 2,
        title: '02. Short-Form Video Scripting Framework',
        duration: '34m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        summary:
          'Structuring 45-second educational reels with strong hooks, clear demonstrations, and honest calls to action.',
      },
      {
        id: 'dg_3',
        order: 3,
        title: '03. Analytics, Retention & Landing Conversion',
        duration: '38m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        summary:
          'Reading retention curves, measuring click-through rates, and optimizing mobile landing pages.',
      },
      {
        id: 'dg_4',
        order: 4,
        title: '04. Ethical Referral & Community Growth',
        duration: '35m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
        summary:
          'Building transparent communities where learners join for real skill outcomes rather than hype.',
      },
    ],
  },
  {
    id: 'course_freelance_craft',
    title: 'High-Income Freelancing & Client Mastery',
    subtitle: 'Portfolio craft, cold outreach, and retainer pricing strategies',
    description:
      'Master service packaging, proposal writing, discovery calls, and scope management to win domestic and international freelance retainers from scratch.',
    category: 'Freelancing',
    imageUrl: '/src/assets/images/course_freelance_craft_1794771473745.jpg',
    instructor: 'Meera Krishnan',
    durationLabel: '4 Lessons · 2h 40m',
    requiredPlanIds: ['plan_growth', 'plan_pro'],
    isPublished: true,
    lessons: [
      {
        id: 'fc_1',
        order: 1,
        title: '01. Packaging High-Value Service Offers',
        duration: '36m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        summary:
          'Turning generic skills like editing, design, or web dev into outcome-driven client packages.',
      },
      {
        id: 'fc_2',
        order: 2,
        title: '02. Building Proof Without Prior Clients',
        duration: '40m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        summary:
          'Creating realistic case-study tear-downs and spec work that win client confidence immediately.',
      },
      {
        id: 'fc_3',
        order: 3,
        title: '03. Cold Outreach & Discovery Calls',
        duration: '42m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        summary:
          'Non-spammy email and LinkedIn outreach templates paired with structured 20-minute discovery scripts.',
      },
      {
        id: 'fc_4',
        order: 4,
        title: '04. Value Pricing, Contracts & UPI/Bank Invoicing',
        duration: '42m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        summary:
          'Moving from hourly billing to milestone retainers with crisp payment terms and GST awareness.',
      },
    ],
  },
  {
    id: 'course_creator_finance',
    title: 'Creator Monetization & Personal Finance',
    subtitle: 'Multi-stream digital products, tax discipline, and wealth habits',
    description:
      'Build sustainable digital income streams through templates, cohort workshops, and consulting while structuring savings, taxes, and cashflow cleanly.',
    category: 'Finance & Monetization',
    imageUrl: '/src/assets/images/course_creator_finance_1794771474202.jpg',
    instructor: 'Rohan Kulkarni',
    durationLabel: '3 Lessons · 1h 55m',
    requiredPlanIds: ['plan_pro'],
    isPublished: true,
    lessons: [
      {
        id: 'cf_1',
        order: 1,
        title: '01. Designing Digital Products & Micro-Workshops',
        duration: '38m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
        summary:
          'Validating and launching practical digital guides, Notion systems, and weekend skill cohorts.',
      },
      {
        id: 'cf_2',
        order: 2,
        title: '02. Separating Business Cashflow & Emergency Reserves',
        duration: '37m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        summary:
          'Structuring creator payouts, UPI ledgers, and 6-month stability buffers without lifestyle inflation.',
      },
      {
        id: 'cf_3',
        order: 3,
        title: '03. Compliance, Invoicing & Long-Term Compounding',
        duration: '40m',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        summary:
          'Understanding Indian freelance income recordkeeping, Section 44ADA basics, and steady asset allocation.',
      },
    ],
  },
];

export const DEFAULT_SETTINGS: Omit<PlatformSettings, 'updatedAt'> = {
  siteName: 'SkillMint',
  supportEmail: 'support@skillmint.in',
  supportPhone: '+91 98000 00000',
  minWithdrawalAmount: 200,
  referralEnabled: true,
  referralsRequirePlanApproval: true,
  announcementText:
    'All plan activations and UPI withdrawals are manually verified by our compliance team within 2–12 business hours.',
  merchantName: 'SkillMint Academy',
  phonepeUpiId: '',
  phonepeQrUrl: '',
  gpayUpiId: '',
  gpayQrUrl: '',
  paytmUpiId: '',
  paytmQrUrl: '',
};
