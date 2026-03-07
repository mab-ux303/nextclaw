import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6
  }).format(value);
}

export function toFixedUsd(value: number): string {
  return (Math.round(value * 1_000_000) / 1_000_000).toFixed(6);
}
