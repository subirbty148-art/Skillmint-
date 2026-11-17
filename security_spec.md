# Security Specification — SkillMint

## 1. Core Data Invariants
1. **Admin Authority Isolation**: Only UIDs present in `/admins/{uid}` or the verified bootstrap administrator email (`subirbty148@gmail.com` with `email_verified == true`) hold `isAdmin()`. Users cannot create or modify `/admins/{uid}` or elevate `users/{uid}.role`.
2. **Wallet Immutability**: Users can NEVER create, increment, or decrement `walletBalance`, `bonusBalance`, `totalEarnings`, `totalReferrals`, `activePlanId`, `activePlanName`, `courseAccess`, `isBlocked`, or `role` on `/users/{userId}`. Only `isAdmin()` can modify financial or privilege fields.
3. **Immutable Transaction Ledger**: `/transactions/{transactionId}` records can ONLY be created by `isAdmin()`. Updates and deletes are completely disabled (`if false`) so financial history cannot be tampered with.
4. **Payment Verification Gate**: Users may only create `/payments/{paymentId}` with `status == 'pending'`, matching `userId == request.auth.uid`, valid `planId`, and an unused `/transactionIds/{txId}` lock. Users can NEVER set `status` to `'approved'` or `'rejected'`.
5. **Terminal State Locking**: Once a payment or withdrawal reaches `'approved'` or `'rejected'`, no subsequent update can change its terminal status.
6. **Self-Referral & Duplicate Reward Prevention**: `/referrals/{referredUid}` is keyed by `referredUid` (only 1 referral record can ever exist per referred user), and `referrerUid != referredUid` is enforced strictly in rules.
7. **PII Isolation**: `/users/{userId}` containing `email` and `phone` is readable only by the owner (`request.auth.uid == userId`) or `isAdmin()`. Referral code lookup uses PII-free `/referralCodes/{code}` (`get` only, no `list`).
8. **Withdrawal Guard**: Users can only create `/withdrawals/{withdrawalId}` with `status == 'pending'`, `amount >= settings.minWithdrawal`, and `amount <= user.walletBalance`.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Balance Injection**: Non-admin user updates `/users/{uid}` with `{ walletBalance: 50000 }`. -> DENIED (`affectedKeys().hasOnly(['displayName', 'phone', 'upiId', 'updatedAt'])`).
2. **Self-Role Escalation on Registration**: User creates `/users/{uid}` with `{ role: 'admin', walletBalance: 1000 }`. -> DENIED (`role == 'user' && walletBalance == 0`).
3. **Admin Collection Poisoning**: Non-admin creates `/admins/{uid}` to grant self admin access. -> DENIED (`allow write: if isAdmin()`).
4. **Email Spoofing Attack**: Attacker creates an account with `subirbty148@gmail.com` where `email_verified == false` and tries to read `/users` or approve a payment. -> DENIED (`email_verified == true` required).
5. **Shadow Ghost Field Injection**: User updates `/users/{uid}` with `{ displayName: 'Test', isVerified: true }`. -> DENIED (`affectedKeys().hasOnly(...)`).
6. **Direct Payment Auto-Approval**: User creates `/payments/{id}` with `{ status: 'approved', amount: 400 }`. -> DENIED (`status == 'pending'` required on create).
7. **Duplicate UPI Transaction ID**: Attacker submits a second payment with an already claimed `transactionId` in `/transactionIds/{txId}`. -> DENIED (`allow create` only when doc doesn't exist, no `update`).
8. **Self-Referral Reward Farming**: User creates `/referrals/{uid}` where `referrerUid == request.auth.uid && referredUid == request.auth.uid`. -> DENIED (`referrerUid != referredUid`).
9. **Fake Wallet Transaction Creation**: Non-admin writes directly to `/transactions/{id}` with `{ direction: 'credit', amount: 5000 }`. -> DENIED (`allow create: if isAdmin()`).
10. **PII Collection Scraping**: Authenticated non-admin executes `list` on `/users` or `get` on `/users/{otherUid}`. -> DENIED (`isOwner(userId) || isAdmin()`).
11. **Oversized Resource Exhaustion**: Attacker injects a 1MB string into `displayName` or `paymentId` path variable (`> 128` chars). -> DENIED (`isValidId()` and `.size()` checks).
12. **Withdrawal Exceeding Balance**: User submits `/withdrawals/{id}` with `amount: 99999` while `walletBalance == 0`. -> DENIED (`incoming().amount <= getUser(uid).walletBalance`).
