import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('overflow-auto rounded-lg border border-slate-200', className)} {...props} />;
}
