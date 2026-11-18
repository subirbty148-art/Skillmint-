import type { Course, MembershipPlan, PlatformSettings } from '../types/models';

export const HERO_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3';

export const DEFAULT_COURSES: Course[] = [];


export const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Basic Membership Access',
    price: 100,
    bonus: 50,
    referralReward: 50,
    courseIds: [],
    conditions: [
      'One-time membership fee of Rs. 100',
      'Membership bonus: Rs. 50',
      'Referral reward: Rs. 50 after verified qualifying payment',
      'No guaranteed income'
    ],
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'Standard Membership Access',
    price: 200,
    bonus: 100,
    referralReward: 100,
    courseIds: [],
    conditions: [
      'One-time membership fee of Rs. 200',
      'Membership bonus: Rs. 100',
      'Referral reward: Rs. 100 after verified qualifying payment',
      'No guaranteed income'
    ],
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Premium Membership Access',
    price: 400,
    bonus: 200,
    referralReward: 200,
    courseIds: [],
    conditions: [
      'One-time membership fee of Rs. 400',
      'Membership bonus: Rs. 200',
      'Referral reward: Rs. 200 after verified qualifying payment',
      'No guaranteed income'
    ],
    isActive: true,
    sortOrder: 3,
  },
];


export const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: 'SkillMint',
  supportEmail: '',
  minWithdrawal: 100,
  referralBonusDefault: 0,
  referralConditionSummary: 'Rewards are subject to verified plan payments.',
};
