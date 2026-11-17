import heroStudioImg from '../assets/images/hero_skill_studio_1794771472791.jpg';
import courseDigitalImg from '../assets/images/course_digital_growth_1794771473697.jpg';
import courseFreelanceImg from '../assets/images/course_freelance_craft_1794771473745.jpg';
import courseFinanceImg from '../assets/images/course_creator_finance_1794771474202.jpg';
import { Course, MembershipPlan, PlatformSettings } from '../types/models';

export const HERO_BANNER_IMAGE = heroStudioImg;

export const DEFAULT_COURSES: Course[] = [
  {
    id: 'course_digital_growth',
    title: 'Digital Marketing & Audience Growth',
    description:
      'Learn organic content distribution, short-form funnel architecture, SEO fundamentals, and ethical digital product positioning from scratch.',
    imageUrl: courseDigitalImg,
    category: 'Digital Marketing',
    instructor: 'Aarav Kulkarni',
    planIdRequired: 'plan_starter',
    isActive: true,
    lessons: [
      {
        id: 'dg_01',
        title: '01. Understanding Digital Attention & Value Funnels',
        duration: '08:40',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        summary: 'Map how modern Indian creators turn educational content into sustainable service and digital product funnels.',
      },
      {
        id: 'dg_02',
        title: '02. Content Pillars & High-Retention Short Video Hooks',
        duration: '12:15',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        summary: 'Framework for scripting clear educational reels, carousels, and community posts without clickbait.',
      },
      {
        id: 'dg_03',
        title: '03. Analytics, Conversion Tracking & Iterative Testing',
        duration: '10:30',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        summary: 'Measure click-through rates, landing page conversion, and retention cohorts accurately.',
      },
    ],
  },
  {
    id: 'course_freelance_craft',
    title: 'High-Income Freelancing & Client Mastery',
    description:
      'Master service packaging, portfolio positioning, outbound client discovery, proposal pricing, and retainer delivery for remote Indian freelancers.',
    imageUrl: courseFreelanceImg,
    category: 'Freelancing',
    instructor: 'Meera Deshmukh',
    planIdRequired: 'plan_pro',
    isActive: true,
    lessons: [
      {
        id: 'fc_01',
        title: '01. Packaging Skills into Outcome-Driven Offers',
        duration: '09:50',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
        summary: 'Move beyond hourly rates by structuring clear scope, deliverables, and milestone pricing.',
      },
      {
        id: 'fc_02',
        title: '02. Building Proof-Backed Case Studies & Outreach',
        duration: '14:20',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        summary: 'Write personalized outreach audits that stand out in founder and agency inboxes.',
      },
      {
        id: 'fc_03',
        title: '03. Client Onboarding, Contracts & Monthly Retainers',
        duration: '11:05',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
        summary: 'Set payment schedules, revision boundaries, and structured weekly reporting.',
      },
    ],
  },
  {
    id: 'course_creator_finance',
    title: 'Creator Monetization & Personal Finance',
    description:
      'Build disciplined personal cashflow, understand GST/tax compliance for digital income, diversify skill streams, and manage savings systematically.',
    imageUrl: courseFinanceImg,
    category: 'Finance & Creator Ops',
    instructor: 'Rohan Iyer',
    planIdRequired: 'plan_elite',
    isActive: true,
    lessons: [
      {
        id: 'cf_01',
        title: '01. Separating Personal & Creator Cashflow Accounts',
        duration: '10:15',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
        summary: 'Organize UPI business receipts, emergency reserves, and monthly operating budgets.',
      },
      {
        id: 'cf_02',
        title: '02. Ethical Affiliate & Skill-Referral Monetization',
        duration: '13:45',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        summary: 'Understand compliant disclosure, real value creation, and why verified sales matter.',
      },
      {
        id: 'cf_03',
        title: '03. Tax Basics & Long-Term Compounding Habits',
        duration: '15:10',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        summary: 'Track invoices, understand Section 44ADA basics, and automate disciplined investing.',
      },
    ],
  },
];

export const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter Plan',
    tagline: 'Entry skill track with Course 1 access',
    price: 100,
    bonus: 50,
    referralReward: 50,
    courseIds: ['course_digital_growth'],
    conditions: [
      'One-time ₹100 plan payment via PhonePe, Google Pay, or Paytm QR.',
      '₹50 bonus is credited to your Bonus Balance only after manual Admin payment verification.',
      'Unlocks Digital Marketing & Audience Growth course immediately upon approval.',
      'Referral rewards apply only when a referred user activates a paid plan and passes verification. No guaranteed income.',
    ],
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'plan_pro',
    name: 'Pro Growth Plan',
    tagline: 'Dual skill track with Courses 1 & 2',
    price: 200,
    bonus: 100,
    referralReward: 100,
    courseIds: ['course_digital_growth', 'course_freelance_craft'],
    conditions: [
      'One-time ₹200 plan payment verified manually by an administrator via UPI transaction ID.',
      '₹100 bonus credited to Bonus Balance upon approval.',
      'Unlocks both Digital Marketing and High-Income Freelancing independent courses.',
      'Bonus balance is for platform rewards/eligibility; only verified Wallet Balance is withdrawable. No guaranteed earnings.',
    ],
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'plan_elite',
    name: 'Elite Mastery Plan',
    tagline: 'Complete 3-course bundle & max referral reward tier',
    price: 400,
    bonus: 200,
    referralReward: 200,
    courseIds: ['course_digital_growth', 'course_freelance_craft', 'course_creator_finance'],
    conditions: [
      'One-time ₹400 plan payment verified manually via PhonePe, Google Pay, or Paytm proof.',
      '₹200 bonus credited to Bonus Balance upon payment approval.',
      'Unlocks all 3 independent SkillMint courses and full lesson libraries.',
      'Referral rewards require a genuine referred registration + admin-verified plan purchase. Self-referrals and duplicate UTRs are rejected.',
    ],
    isActive: true,
    sortOrder: 3,
  },
];

export const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: 'SkillMint',
  supportEmail: 'support@skillmint.in',
  supportPhone: '+91 98000 00000',
  minWithdrawal: 100,
  referralBonusDefault: 50,
  referralConditionSummary:
    'Referral rewards are credited to your withdrawable Wallet Balance only after your referred user completes registration using your link/code, submits a valid UPI payment, and an administrator manually approves the transaction. Self-referrals and duplicate accounts are strictly blocked.',
  phonepeUpiId: '',
  phonepeQrUrl: '',
  gpayUpiId: '',
  gpayQrUrl: '',
  paytmUpiId: '',
  paytmQrUrl: '',
  announcementText:
    'All UPI payments are manually verified by our review team before membership activation and referral credits.',
};
