import type { MarketplaceSort } from '@/api/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/lib/i18n';
import { PackageSearch } from 'lucide-react';

export function FilterPanel(props: {
  scope: 'all' | 'installed';
  searchText: string;
  searchPlaceholder: string;
  sort: MarketplaceSort;
  onSearchTextChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex gap-3 items-center">
        <div className="flex-1 min-w-0 relative">
          <PackageSearch className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={props.searchText}
            onChange={(event) => props.onSearchTextChange(event.target.value)}
            placeholder={props.searchPlaceholder}
            className="w-full h-9 border border-gray-200/80 rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {props.scope === 'all' && (
          <Select value={props.sort} onValueChange={(value) => props.onSortChange(value as MarketplaceSort)}>
            <SelectTrigger className="h-9 w-[150px] shrink-0 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">{t('marketplaceSortRelevance')}</SelectItem>
              <SelectItem value="updated">{t('marketplaceSortUpdated')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

export function MarketplaceListSkeleton(props: {
  count: number;
}) {
  return (
    <>
      {Array.from({ length: props.count }, (_, index) => (
        <article
          key={`marketplace-skeleton-${index}`}
          className="rounded-2xl border border-gray-200/40 bg-white px-5 py-4 shadow-sm"
        >
          <div className="flex items-start gap-3.5 justify-between">
            <div className="flex min-w-0 flex-1 gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <Skeleton className="h-4 w-32 max-w-[70%]" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-20 shrink-0 rounded-xl" />
          </div>
        </article>
      ))}
    </>
  );
}

export function PaginationBar(props: {
  page: number;
  totalPages: number;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button
        className="h-8 px-3 rounded-xl border border-gray-200/80 text-sm text-gray-600 disabled:opacity-40"
        onClick={props.onPrev}
        disabled={props.page <= 1 || props.busy}
      >
        {t('prev')}
      </button>
      <div className="text-sm text-gray-600 min-w-20 text-center">
        {props.totalPages === 0 ? '0 / 0' : `${props.page} / ${props.totalPages}`}
      </div>
      <button
        className="h-8 px-3 rounded-xl border border-gray-200/80 text-sm text-gray-600 disabled:opacity-40"
        onClick={props.onNext}
        disabled={props.totalPages === 0 || props.page >= props.totalPages || props.busy}
      >
        {t('next')}
      </button>
    </div>
  );
}
