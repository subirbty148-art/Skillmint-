import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { DEFAULT_COURSES, DEFAULT_PLANS, DEFAULT_SETTINGS } from '../data/defaults';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import { createOrLoadUserProfile } from '../lib/firestoreService';
import {
  Course,
  CourseOrder,
  MembershipPlan,
  NotificationItem,
  PaymentSubmission,
  PlatformSettings,
  ReferralRecord,
  UserProfile,
  WalletTransaction,
  WithdrawalRequest,
} from '../types/models';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  authReady: boolean;
  plans: MembershipPlan[];
  courses: Course[];
  settings: PlatformSettings;
  payments: PaymentSubmission[];
  buyerCourseOrders: CourseOrder[];
  referredCourseOrders: CourseOrder[];
  withdrawals: WithdrawalRequest[];
  referrals: ReferralRecord[];
  transactions: WalletTransaction[];
  notifications: NotificationItem[];
  registerWithEmail: (params: {
    name: string;
    email: string;
    password: string;
    referralCode?: string;
  }) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginAdminWithEmail: (email: string, password: string) => Promise<void>;
  sendAdminVerificationEmail: (email: string, password: string) => Promise<'sent' | 'already-verified'>;
  loginWithGoogle: (referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function sortByCreatedAtDesc<T extends { createdAt?: any }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tB - tA;
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const adminLoginGuardRef = useRef(false);

  const [plans, setPlans] = useState<MembershipPlan[]>(DEFAULT_PLANS);
  const [courses, setCourses] = useState<Course[]>(DEFAULT_COURSES);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);

  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [buyerCourseOrders, setBuyerCourseOrders] = useState<CourseOrder[]>([]);
  const [referredCourseOrders, setReferredCourseOrders] = useState<CourseOrder[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [userNotifs, setUserNotifs] = useState<NotificationItem[]>([]);
  const [globalNotifs, setGlobalNotifs] = useState<NotificationItem[]>([]);

  const isAdmin =
    Boolean(firebaseUser?.email) &&
    firebaseUser?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() &&
    Boolean(firebaseUser?.emailVerified);

  // Public catalog listeners (plans, courses, platform settings)
  useEffect(() => {
    const unsubPlans = onSnapshot(
      collection(db, 'plans'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as MembershipPlan).sort((a, b) => a.sortOrder - b.sortOrder);
          setPlans(list);
        }
      },
      (err) => console.warn('Plans snapshot note:', err.message)
    );

    const unsubCourses = onSnapshot(
      collection(db, 'courses'),
      (snap) => {
        if (!snap.empty) {
          setCourses(snap.docs.map((d) => d.data() as Course));
        }
      },
      (err) => console.warn('Courses snapshot note:', err.message)
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as PlatformSettings);
        }
      },
      (err) => console.warn('Settings snapshot note:', err.message)
    );

    return () => {
      unsubPlans();
      unsubCourses();
      unsubSettings();
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (adminLoginGuardRef.current) {
        return;
      }
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setPayments([]);
        setBuyerCourseOrders([]);
        setReferredCourseOrders([]);
        setWithdrawals([]);
        setReferrals([]);
        setTransactions([]);
        setUserNotifs([]);
        setGlobalNotifs([]);
        setAuthReady(true);
        return;
      }

      try {
        await createOrLoadUserProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'Member',
        });
      } catch (err) {
        console.error('Failed to ensure user profile:', err);
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // Authenticated user & admin listeners
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const uid = firebaseUser.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), where('userId', '==', uid)),
      (snap) => {
        setPayments(sortByCreatedAtDesc(snap.docs.map((d) => d.data() as PaymentSubmission)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    const unsubWithdrawals = onSnapshot(
      query(collection(db, 'withdrawals'), where('userId', '==', uid)),
      (snap) => {
        setWithdrawals(sortByCreatedAtDesc(snap.docs.map((d) => d.data() as WithdrawalRequest)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'withdrawals')
    );

    const unsubReferrals = onSnapshot(
      query(collection(db, 'referrals'), where('referrerUid', '==', uid)),
      (snap) => {
        setReferrals(sortByCreatedAtDesc(snap.docs.map((d) => d.data() as ReferralRecord)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'referrals')
    );

    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', uid)),
      (snap) => {
        setTransactions(sortByCreatedAtDesc(snap.docs.map((d) => d.data() as WalletTransaction)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    const unsubUserNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
      (snap) => {
        setUserNotifs(snap.docs.map((d) => d.data() as NotificationItem));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    const unsubGlobalNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', 'all')),
      (snap) => {
        setGlobalNotifs(snap.docs.map((d) => d.data() as NotificationItem));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    const unsubBuyerOrders = onSnapshot(
      query(collection(db, 'courseOrders'), where('buyerUid', '==', uid)),
      (snap) => {
        setBuyerCourseOrders(sortByCreatedAtDesc(snap.docs.map((d) => d.data() as CourseOrder)));
      },
      (err) => console.warn('Buyer course orders listener note:', err.code || err.message)
    );

    const unsubReferredOrders = onSnapshot(
      query(collection(db, 'courseOrders'), where('referrerUid', '==', uid)),
      (snap) => {
        setReferredCourseOrders(
          sortByCreatedAtDesc(
            snap.docs.map((d) => {
              const { screenshotUrl: _omittedScreenshot, ...safeOrder } = d.data() as CourseOrder;
              return safeOrder as CourseOrder;
            })
          )
        );
      },
      (err) => console.warn('Referred course orders listener note:', err.code || err.message)
    );

    return () => {
      unsubProfile();
      unsubPayments();
      unsubWithdrawals();
      unsubReferrals();
      unsubTx();
      unsubUserNotifs();
      unsubGlobalNotifs();
      unsubBuyerOrders();
      unsubReferredOrders();
    };
  }, [authReady, firebaseUser]);

  // Automatic catalog seeding disabled during initial connection to preserve existing database state.

  const registerWithEmail = async (params: {
    name: string;
    email: string;
    password: string;
    referralCode?: string;
  }) => {
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    await updateProfile(cred.user, { displayName: params.name.trim() });
    await createOrLoadUserProfile({
      uid: cred.user.uid,
      email: params.email.trim(),
      displayName: params.name.trim(),
      referralCodeInput: params.referralCode,
    });
    try {
      await sendEmailVerification(cred.user);
    } catch (e) {
      console.warn('Email verification send warning:', e);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await createOrLoadUserProfile({
      uid: cred.user.uid,
      email: cred.user.email || email.trim(),
      displayName: cred.user.displayName || email.split('@')[0],
    });
  };

  const loginAdminWithEmail = async (email: string, password: string) => {
    adminLoginGuardRef.current = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userEmail = cred.user.email?.toLowerCase() || '';

      if (userEmail !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        throw new Error('Access denied. This account is not an authorized administrator.');
      }

      await cred.user.reload();
      if (!cred.user.emailVerified) {
        await signOut(auth);
        const err = new Error(
          'Administrator email is not verified. Please verify your email address before signing in.'
        ) as Error & { code?: string };
        err.code = 'admin/email-unverified';
        throw err;
      }

      const idToken = await cred.user.getIdToken(true);
      const res = await fetch('/api/admin/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.authorized) {
        await signOut(auth);
        throw new Error(data.error || 'Server denied administrator access.');
      }

      await createOrLoadUserProfile({
        uid: cred.user.uid,
        email: cred.user.email || email.trim(),
        displayName: cred.user.displayName || 'SkillMint Admin',
      });
      setFirebaseUser(cred.user);
      setAuthReady(true);
    } finally {
      adminLoginGuardRef.current = false;
    }
  };

  const sendAdminVerificationEmail = async (
    email: string,
    password: string
  ): Promise<'sent' | 'already-verified'> => {
    const trimmedEmail = email.trim();
    if (trimmedEmail.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      throw new Error('Access denied. This account is not an authorized administrator.');
    }

    adminLoginGuardRef.current = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      await cred.user.reload();
      if (cred.user.emailVerified) {
        return 'already-verified';
      }
      await sendEmailVerification(cred.user);
      return 'sent';
    } finally {
      try {
        if (auth.currentUser) {
          await signOut(auth);
        }
      } finally {
        adminLoginGuardRef.current = false;
      }
    }
  };

  const loginWithGoogle = async (referralCode?: string) => {
    const cred = await signInWithPopup(auth, googleProvider);
    await createOrLoadUserProfile({
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: cred.user.displayName || 'SkillMint Member',
      referralCodeInput: referralCode,
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    setFirebaseUser({ ...auth.currentUser } as User);
    return auth.currentUser.emailVerified;
  };

  const notifications = sortByCreatedAtDesc([...userNotifs, ...globalNotifs]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        isAdmin,
        authReady,
        plans,
        courses,
        settings,
        payments,
        buyerCourseOrders,
        referredCourseOrders,
        withdrawals,
        referrals,
        transactions,
        notifications,
        registerWithEmail,
        loginWithEmail,
        loginAdminWithEmail,
        sendAdminVerificationEmail,
        loginWithGoogle,
        logout,
        resetPassword,
        resendVerificationEmail,
        refreshAuthUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
