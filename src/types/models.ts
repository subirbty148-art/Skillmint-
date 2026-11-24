export type PaymentMethod = 'phonepe' | 'googlepay' | 'paytm';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';
export type ReferralStatus = 'registered' | 'qualified' | 'rewarded' | 'rejected';

export interface UserProfile {
  uid: string;
  uniqueUserId: string;
  displayName: string;
  email: string;
  phone?: string;
  upiId?: string;
  referralCode: string;
  referredByCode?: string;
  referredByUid?: string;
  walletBalance: number;
  bonusBalance: number;
  totalEarnings: number;
  totalReferrals: number;
  activePlanId?: string;
  activePlanName?: string;
  courseAccess: string[];
  isBlocked: boolean;
  role: 'user' | 'admin';
  createdAt: any;
  updatedAt: any;
}

export interface MembershipPlan {
  id: string;
  name: string;
  tagline?: string;
  price: number;
  bonus: number;
  referralReward: number;
  courseIds: string[];
  conditions: string[];
  isActive: boolean;
  sortOrder: number;
  updatedAt?: any;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  videoUrl: string;
  summary: string;
}

export type CourseOrderStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
export type CommissionStatus = 'none' | 'pending' | 'paid' | 'reversed';

export interface Course {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  instructor: string;
  price?: number;
  qrCodeUrl?: string;
  upiId?: string;
  planIdRequired?: string;
  lessons: CourseLesson[];videoUrl?: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface CourseOrder {
  id: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string;
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  method: PaymentMethod;
  transactionId: string;
  hasScreenshot?: boolean;
  screenshotStorageType?: 'firebase_storage' | 'inline_compressed';
  screenshotUrl?: string; // Legacy compatibility only; new orders isolate proof in courseOrderProofs/{orderId}
  referralCode?: string;
  referrerUid?: string;
  referrerName?: string;
  commissionRate: number;
  commissionAmount: number;
  platformShare: number;
  commissionStatus: CommissionStatus;
  commissionCredited: boolean;
  status: CourseOrderStatus;
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface CourseOrderProof {
  orderId: string;
  buyerUid: string;
  screenshotUrl: string;
  storageType: 'firebase_storage' | 'inline_compressed';
  createdAt: any;
}

export interface PaymentSubmission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  bonusAmount: number;
  method: PaymentMethod;
  transactionId: string;
  screenshotUrl: string;
  status: PaymentStatus;
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  upiId: string;
  status: WithdrawalStatus;
  adminNote?: string;
  payoutRef?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface ReferralRecord {
  id: string;
  referrerUid: string;
  referrerCode: string;
  referredUid: string;
  referredName: string;
  referredEmail: string;
  status: ReferralStatus;
  rewardAmount: number;
  qualifyingPlanId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'plan_bonus' | 'referral_reward' | 'withdrawal' | 'admin_credit' | 'admin_debit' | 'plan_activation';
  amount: number;
  balanceType: 'wallet' | 'bonus';
  direction: 'credit' | 'debit';
  title: string;
  referenceId?: string;
  status: 'completed' | 'pending' | 'rejected';
  createdAt: any;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  createdAt: any;
}

export interface PlatformSettings {
  siteName: string;
  supportEmail: string;
  supportPhone?: string;
  minWithdrawal: number;
  referralBonusDefault: number;
  referralConditionSummary: string;
  phonepeUpiId?: string;
  phonepeQrUrl?: string;
  gpayUpiId?: string;
  gpayQrUrl?: string;
  paytmUpiId?: string;
  paytmQrUrl?: string;
  announcementText?: string;
  updatedAt?: any;
}
