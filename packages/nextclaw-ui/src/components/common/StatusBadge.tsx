import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { t } from '@/lib/i18n';

type Status = 'connected' | 'disconnected' | 'connecting';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<
  Status,
  { label: string; dotClass: string; textClass: string; bgClass: string }
> = {
  connected: {
    label: t('connected'),
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
  },
  disconnected: {
    label: t('disconnected'),
    dotClass: 'bg-gray-300',
    textClass: 'text-gray-400',
    bgClass: 'bg-gray-100/80',
  },
  connecting: {
    label: t('connecting'),
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
      config.bgClass,
      className
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotClass)} />
      <span className={cn('text-[11px] font-medium flex items-center gap-1', config.textClass)}>
        {config.label}
        {status === 'connecting' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      </span>
    </div>
  );
}
