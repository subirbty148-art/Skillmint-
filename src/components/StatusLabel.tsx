import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface StatusLabelProps {
  status: string;
}

export const StatusLabel: React.FC<StatusLabelProps> = ({ status }) => {
  const normalized = status.toLowerCase();

  if (normalized === 'approved' || normalized === 'completed' || normalized === 'rewarded' || normalized === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="capitalize">{normalized}</span>
      </span>
    );
  }

  if (
    normalized === 'rejected' ||
    normalized === 'blocked' ||
    normalized === 'refunded' ||
    normalized === 'cancelled' ||
    normalized === 'reversed'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="capitalize">{normalized}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="capitalize">{normalized}</span>
    </span>
  );
};
