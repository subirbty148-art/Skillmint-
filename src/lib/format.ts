export function formatINR(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num);
}

export function formatTimestamp(ts: any): string {
  if (!ts) return 'Just now';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Recently';
  }
}

export function getStatusLabel(status: string): {
  label: string;
  toneClass: string;
} {
  switch (status) {
    case 'approved':
    case 'qualified_rewarded':
      return {
        label: status === 'approved' ? 'Approved' : 'Reward Credited',
        toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        toneClass: 'text-rose-700 bg-rose-50 border-rose-200',
      };
    case 'pending_verification':
      return {
        label: 'Awaiting Plan Verification',
        toneClass: 'text-amber-700 bg-amber-50 border-amber-200',
      };
    default:
      return {
        label: 'Pending Verification',
        toneClass: 'text-amber-700 bg-amber-50 border-amber-200',
      };
  }
}
