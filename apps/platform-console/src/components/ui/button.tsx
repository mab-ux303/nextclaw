import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClassMap: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-300'
};

export function Button({ className, variant = 'primary', ...props }: Props): JSX.Element {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        variantClassMap[variant],
        className
      )}
    />
  );
}
