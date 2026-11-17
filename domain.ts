export type UserRole = 'user' | 'admin';
export type PaymentMethod = 'phonepe' | 'gpay' | 'paytm';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type ReferralStatus = 'pending_verification' | 'qualified_rewarded' | 'rejected';
export type TransactionType =
  | 'plan_bonus'
  | 'referral_reward'
  | 'withdrawal_debit'
  | 'admin_adjustment'
  | 'bonus_conversion';

export interface UserProfile {
  uid: string;
  uniqueId: string;
  fullName: string;
  email: string;
  phone?: string;
  upiId?: string;
  referralCode: string;
  referredByCode?: string | null;
  referredByUid?: string | null;
  role: UserRole;
  isBlocked: boolean;
  walletBalance: number;
  bonusBalance: number;
  totalEarnings: number;
  totalReferrals: number;
  activePlanId?: string | null;
  activePlanName?: string | null;
  courseAccess: string[];
  createdAt: any;
  updatedAt: any;
}

export interface MembershipPlan {
  id: string;
  name: string;
  tierOrder: number;
  price: number;
  referralBonus: number;
  signupBonus: number;
  description: string;
  eligibilityConditions: string[];
  includedCourseIds: string[];
  isActive: boolean;
  updatedAt: any;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  videoUrl: string;
  summary: string;
  order: number;
}

export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  category: string;
  imageUrl: string;
  instructor: string;
  durationLabel?: string;
  requiredPlanIds: string[];
  lessons: CourseLesson[];
  isPublished: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface PaymentSubmission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  screenshotUrl: string;
  status: VerificationStatus;
  adminNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  upiId: string;
  status: VerificationStatus;
  adminNote?: string | null;
  payoutReference?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerCode: string;
  referredUserId: string;
  referredUserName: string;
  qualifyingPlanId?: string | null;
  rewardAmount: number;
  status: ReferralStatus;
  createdAt: any;
  rewardedAt?: any;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  walletTarget: 'walletBalance' | 'bonusBalance';
  direction: 'credit' | 'debit';
  amount: number;
  description: string;
  referenceId: string;
  createdBy: string;
  createdAt: any;
}

export interface PlatformNotification {
  id: string;
  targetUserId: string;
  title: string;
  message: string;
  type: 'info' | 'payment' | 'withdrawal' | 'referral' | 'announcement';
  createdAt: any;
}

export interface PlatformSettings {
  siteName: string;
  supportEmail: string;
  supportPhone?: string;
  minWithdrawalAmount: number;
  referralEnabled: boolean;
  referralsRequirePlanApproval: boolean;
  announcementText?: string;
  merchantName?: string;
  phonepeUpiId?: string;
  phonepeQrUrl?: string;
  gpayUpiId?: string;
  gpayQrUrl?: string;
  paytmUpiId?: string;
  paytmQrUrl?: string;
  updatedAt: any;
}

export interface AdminRecord {
  uid: string;
  email: string;
  addedBy: string;
  createdAt: any;
}
