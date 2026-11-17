import type { Course, MembershipPlan, PlatformSettings } from '../types/models';

export const HERO_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3';

export const DEFAULT_COURSES: Course[] = [];

export const DEFAULT_PLANS: MembershipPlan[] = [];

export const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: 'SkillMint',
  supportEmail: '',
  minWithdrawal: 100,
  referralBonusDefault: 0,
  referralConditionSummary: 'Rewards are subject to verified plan payments.',
};
