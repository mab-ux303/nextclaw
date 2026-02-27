/* eslint-disable max-lines-per-function */
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
  MarketplaceSort,
  MarketplaceItemType
} from '@/api/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs-custom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  useInstallMarketplaceItem,
  useManageMarketplaceItem,
  useMarketplaceInstalled,
  useMarketplaceItems
} from '@/hooks/useMarketplace';
import { t } from '@/lib/i18n';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { cn } from '@/lib/utils';
import { PackageSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const PAGE_SIZE = 12;

type ScopeType = 'all' | 'installed';

type InstallState = {
  isPending: boolean;
  installingSpec?: string;
};

type ManageState = {
  isPending: boolean;
  targetId?: string;
  action?: MarketplaceManageAction;
};

type InstalledRenderEntry = {
  key: string;
  record: MarketplaceInstalledRecord;
  item?: MarketplaceItemSummary;
};

type MarketplaceRouteType = 'plugins' | 'skills';

function normalizeMarketplaceKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toLookupKey(type: MarketplaceItemSummary['type'], value: string | undefined): string {
  const normalized = normalizeMarketplaceKey(value);
  return normalized.length > 0 ? `${type}:${normalized}` : '';
}

function buildCatalogLookup(items: MarketplaceItemSummary[]): Map<string, MarketplaceItemSummary> {
  const lookup = new Map<string, MarketplaceItemSummary>();

  for (const item of items) {
    const candidates = [item.install.spec, item.slug, item.id];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(item.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, item);
    }
  }

  return lookup;
}

function buildInstalledRecordLookup(records: MarketplaceInstalledRecord[]): Map<string, MarketplaceInstalledRecord> {
  const lookup = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const candidates = [record.spec, record.id, record.label];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(record.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, record);
    }
  }

  return lookup;
}

function findInstalledRecordForItem(
  item: MarketplaceItemSummary,
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>
): MarketplaceInstalledRecord | undefined {
  const candidates = [item.install.spec, item.slug, item.id];
  for (const candidate of candidates) {
    const lookupKey = toLookupKey(item.type, candidate);
    if (!lookupKey) {
      continue;
    }
    const record = installedRecordLookup.get(lookupKey);
    if (record) {
      return record;
    }
  }
  return undefined;
}

function findCatalogItemForRecord(
  record: MarketplaceInstalledRecord,
  catalogLookup: Map<string, MarketplaceItemSummary>
): MarketplaceItemSummary | undefined {
  const bySpec = catalogLookup.get(toLookupKey(record.type, record.spec));
  if (bySpec) {
    return bySpec;
  }

  const byId = catalogLookup.get(toLookupKey(record.type, record.id));
  if (byId) {
    return byId;
  }

  return catalogLookup.get(toLookupKey(record.type, record.label));
}

function matchInstalledSearch(
  record: MarketplaceInstalledRecord,
  item: MarketplaceItemSummary | undefined,
  query: string
): boolean {
  const normalizedQuery = normalizeMarketplaceKey(query);
  if (!normalizedQuery) {
    return true;
  }

  const values = [
    record.id,
    record.spec,
    record.label,
    item?.name,
    item?.slug,
    item?.summary,
    ...(item?.tags ?? [])
  ];

  return values
    .map((value) => normalizeMarketplaceKey(value))
    .filter(Boolean)
    .some((value) => value.includes(normalizedQuery));
}

function getAvatarColor(text: string) {
  const colors = [
    'bg-amber-600', 'bg-orange-500', 'bg-yellow-600', 'bg-emerald-600',
    'bg-teal-600', 'bg-cyan-600', 'bg-stone-600', 'bg-rose-500', 'bg-violet-500'
  ];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function ItemIcon({ name, fallback }: { name?: string; fallback: string }) {
  const displayName = name || fallback;
  const letters = displayName.substring(0, 2).toUpperCase();
  const colorClass = getAvatarColor(displayName);
  return (
    <div className={cn("flex items-center justify-center w-10 h-10 rounded-xl text-white font-semibold text-sm shrink-0", colorClass)}>
      {letters}
    </div>
  );
}

function FilterPanel(props: {
  scope: ScopeType;
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
          <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as MarketplaceSort)}>
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

function MarketplaceListCard(props: {
  item?: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
  installState: InstallState;
  manageState: ManageState;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => void;
}) {
  const record = props.record;
  const pluginRecord = record?.type === 'plugin' ? record : undefined;
  const type = props.item?.type ?? record?.type;
  const title = props.item?.name ?? record?.label ?? record?.id ?? record?.spec ?? t('marketplaceUnknownItem');
  const summary = props.item?.summary ?? (record ? t('marketplaceInstalledLocalSummary') : '');
  const spec = props.item?.install.spec ?? record?.spec ?? '';

  const targetId = record?.id || record?.spec;
  const busyForRecord = Boolean(targetId) && props.manageState.isPending && props.manageState.targetId === targetId;

  const canToggle = Boolean(pluginRecord);
  const canUninstallPlugin = record?.type === 'plugin' && record.origin !== 'bundled';
  const canUninstallSkill = record?.type === 'skill' && record.source === 'workspace';
  const canUninstall = Boolean(canUninstallPlugin || canUninstallSkill);

  const isDisabled = record ? (record.enabled === false || record.runtimeStatus === 'disabled') : false;
  const isInstalling = props.installState.isPending && props.item && props.installState.installingSpec === props.item.install.spec;

  const displayType = type === 'plugin' ? t('marketplaceTypePlugin') : type === 'skill' ? t('marketplaceTypeSkill') : t('marketplaceTypeExtension');

  return (
    <article className="group bg-white border border-gray-200/40 hover:border-gray-200/80 rounded-2xl px-5 py-4 hover:shadow-md shadow-sm transition-all flex items-start gap-3.5 justify-between cursor-default">
      <div className="flex gap-3 min-w-0 flex-1 h-full items-start">
        <ItemIcon name={title} fallback={spec || t('marketplaceTypeExtension')} />
        <div className="min-w-0 flex-1 flex flex-col justify-center h-full">
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-[14px] font-semibold text-gray-900 truncate leading-tight cursor-default">{title}</div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px] text-xs">
                {title}
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
              <span className="text-[11px] text-gray-500 font-medium">{displayType}</span>
              {spec && (
                <>
                  <span className="text-[10px] text-gray-300">•</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] text-gray-400 truncate max-w-full font-mono cursor-default">{spec}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px] text-xs font-mono break-all">
                      {spec}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[12px] text-gray-500/90 line-clamp-1 transition-colors leading-relaxed text-left cursor-default">{summary}</p>
              </TooltipTrigger>
              {summary && (
                <TooltipContent className="max-w-[400px] text-xs leading-relaxed">
                  {summary}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="shrink-0 flex items-center h-full">
        {props.item && !record && (
          <button
            onClick={() => props.onInstall(props.item as MarketplaceItemSummary)}
            disabled={props.installState.isPending}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-medium bg-primary text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {isInstalling ? t('marketplaceInstalling') : t('marketplaceInstall')}
          </button>
        )}

        {pluginRecord && canToggle && (
          <button
            disabled={props.manageState.isPending}
            onClick={() => props.onManage(isDisabled ? 'enable' : 'disable', pluginRecord)}
            className="inline-flex items-center h-8 px-4 rounded-xl text-xs font-medium border border-gray-200/80 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {busyForRecord && props.manageState.action !== 'uninstall'
              ? (props.manageState.action === 'enable' ? t('marketplaceEnabling') : t('marketplaceDisabling'))
              : (isDisabled ? t('marketplaceEnable') : t('marketplaceDisable'))}
          </button>
        )}

        {record && canUninstall && (
          <button
            disabled={props.manageState.isPending}
            onClick={() => props.onManage('uninstall', record)}
            className="inline-flex items-center h-8 px-4 rounded-xl text-xs font-medium border border-rose-100 text-rose-500 bg-white hover:bg-rose-50 hover:border-rose-200 disabled:opacity-50 transition-colors"
          >
            {busyForRecord && props.manageState.action === 'uninstall' ? t('marketplaceRemoving') : t('marketplaceUninstall')}
          </button>
        )}
      </div>
    </article>
  );
}

function PaginationBar(props: {
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

export function MarketplacePage() {
  const navigate = useNavigate();
  const params = useParams<{ type?: string }>();

  const routeType: MarketplaceRouteType | null = useMemo(() => {
    if (params.type === 'plugins' || params.type === 'skills') {
      return params.type;
    }
    return null;
  }, [params.type]);

  useEffect(() => {
    if (!routeType) {
      navigate('/marketplace/plugins', { replace: true });
    }
  }, [routeType, navigate]);

  const typeFilter: MarketplaceItemType = routeType === 'skills' ? 'skill' : 'plugin';
  const isPluginModule = typeFilter === 'plugin';
  const copyKeys = isPluginModule
    ? {
      pageTitle: 'marketplacePluginsPageTitle',
      pageDescription: 'marketplacePluginsPageDescription',
      tabMarketplace: 'marketplaceTabMarketplacePlugins',
      tabInstalled: 'marketplaceTabInstalledPlugins',
      searchPlaceholder: 'marketplaceSearchPlaceholderPlugins',
      sectionCatalog: 'marketplaceSectionPlugins',
      sectionInstalled: 'marketplaceSectionInstalledPlugins',
      errorLoadData: 'marketplaceErrorLoadingPluginsData',
      errorLoadInstalled: 'marketplaceErrorLoadingInstalledPlugins',
      emptyData: 'marketplaceNoPlugins',
      emptyInstalled: 'marketplaceNoInstalledPlugins',
      installedCountSuffix: 'marketplaceInstalledPluginsCountSuffix'
    }
    : {
      pageTitle: 'marketplaceSkillsPageTitle',
      pageDescription: 'marketplaceSkillsPageDescription',
      tabMarketplace: 'marketplaceTabMarketplaceSkills',
      tabInstalled: 'marketplaceTabInstalledSkills',
      searchPlaceholder: 'marketplaceSearchPlaceholderSkills',
      sectionCatalog: 'marketplaceSectionSkills',
      sectionInstalled: 'marketplaceSectionInstalledSkills',
      errorLoadData: 'marketplaceErrorLoadingSkillsData',
      errorLoadInstalled: 'marketplaceErrorLoadingInstalledSkills',
      emptyData: 'marketplaceNoSkills',
      emptyInstalled: 'marketplaceNoInstalledSkills',
      installedCountSuffix: 'marketplaceInstalledSkillsCountSuffix'
    };

  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeType>('all');
  const [sort, setSort] = useState<MarketplaceSort>('relevance');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(searchText.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  const installedQuery = useMarketplaceInstalled(typeFilter);

  const itemsQuery = useMarketplaceItems({
    q: query || undefined,
    type: typeFilter,
    sort,
    page,
    pageSize: PAGE_SIZE
  });

  const installMutation = useInstallMarketplaceItem();
  const manageMutation = useManageMarketplaceItem();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const installedRecords = useMemo(
    () => installedQuery.data?.records ?? [],
    [installedQuery.data?.records]
  );

  const allItems = useMemo(
    () => itemsQuery.data?.items ?? [],
    [itemsQuery.data?.items]
  );

  const catalogLookup = useMemo(
    () => buildCatalogLookup(allItems),
    [allItems]
  );

  const installedRecordLookup = useMemo(
    () => buildInstalledRecordLookup(installedRecords),
    [installedRecords]
  );

  const installedEntries = useMemo<InstalledRenderEntry[]>(() => {
    const entries = installedRecords
      .filter((record) => record.type === typeFilter)
      .map((record) => ({
        key: `${record.type}:${record.spec}:${record.id ?? ''}`,
        record,
        item: findCatalogItemForRecord(record, catalogLookup)
      }))
      .filter((entry) => matchInstalledSearch(entry.record, entry.item, query));

    entries.sort((left, right) => {
      const leftTs = left.record.installedAt ? Date.parse(left.record.installedAt) : Number.NaN;
      const rightTs = right.record.installedAt ? Date.parse(right.record.installedAt) : Number.NaN;
      const leftValid = !Number.isNaN(leftTs);
      const rightValid = !Number.isNaN(rightTs);

      if (leftValid && rightValid && leftTs !== rightTs) {
        return rightTs - leftTs;
      }

      return left.record.spec.localeCompare(right.record.spec);
    });

    return entries;
  }, [installedRecords, typeFilter, catalogLookup, query]);

  const total = scope === 'installed' ? installedEntries.length : (itemsQuery.data?.total ?? 0);
  const totalPages = scope === 'installed' ? 1 : (itemsQuery.data?.totalPages ?? 0);

  const listSummary = useMemo(() => {
    if (scope === 'installed') {
      if (installedQuery.isLoading) {
        return t('loading');
      }
      return `${installedEntries.length} ${t(copyKeys.installedCountSuffix)}`;
    }

    if (!itemsQuery.data) {
      return t('loading');
    }

    return `${allItems.length} / ${total}`;
  }, [scope, installedQuery.isLoading, installedEntries.length, itemsQuery.data, allItems.length, total, copyKeys.installedCountSuffix]);

  const installState: InstallState = {
    isPending: installMutation.isPending,
    installingSpec: installMutation.variables?.spec
  };

  const manageState: ManageState = {
    isPending: manageMutation.isPending,
    targetId: manageMutation.variables?.id || manageMutation.variables?.spec,
    action: manageMutation.variables?.action
  };

  const scopeTabs = [
    { id: 'all', label: t(copyKeys.tabMarketplace) },
    { id: 'installed', label: t(copyKeys.tabInstalled), count: installedQuery.data?.total ?? 0 }
  ];
  const handleInstall = (item: MarketplaceItemSummary) => {
    if (installMutation.isPending) {
      return;
    }
    installMutation.mutate({
      type: item.type,
      spec: item.install.spec,
      kind: item.install.kind,
      ...(item.type === 'skill'
        ? {
            skill: item.slug,
            installPath: `skills/${item.slug}`
          }
        : {})
    });
  };

  const handleManage = async (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => {
    if (manageMutation.isPending) {
      return;
    }

    const targetId = record.id || record.spec;
    if (!targetId) {
      return;
    }

    if (action === 'uninstall') {
      const confirmed = await confirm({
        title: `${t('marketplaceUninstallTitle')} ${targetId}?`,
        description: t('marketplaceUninstallDescription'),
        confirmLabel: t('marketplaceUninstall'),
        variant: 'destructive'
      });
      if (!confirmed) {
        return;
      }
    }

    manageMutation.mutate({
      type: record.type,
      action,
      id: targetId,
      spec: record.spec
    });
  };

  return (
    <PageLayout>
      <PageHeader title={t(copyKeys.pageTitle)} description={t(copyKeys.pageDescription)} />

      <Tabs
        tabs={scopeTabs}
        activeTab={scope}
        onChange={(value) => {
          setScope(value as ScopeType);
          setPage(1);
        }}
        className="mb-4"
      />

      <FilterPanel
        scope={scope}
        searchText={searchText}
        searchPlaceholder={t(copyKeys.searchPlaceholder)}
        sort={sort}
        onSearchTextChange={setSearchText}
        onSortChange={(value) => {
          setPage(1);
          setSort(value);
        }}
      />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-gray-900">
            {scope === 'installed' ? t(copyKeys.sectionInstalled) : t(copyKeys.sectionCatalog)}
          </h3>
          <span className="text-[12px] text-gray-500">{listSummary}</span>
        </div>

        {scope === 'all' && itemsQuery.isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {t(copyKeys.errorLoadData)}: {itemsQuery.error.message}
          </div>
        )}
        {scope === 'installed' && installedQuery.isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {t(copyKeys.errorLoadInstalled)}: {installedQuery.error.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {scope === 'all' && allItems.map((item) => (
            <MarketplaceListCard
              key={item.id}
              item={item}
              record={findInstalledRecordForItem(item, installedRecordLookup)}
              installState={installState}
              manageState={manageState}
              onInstall={handleInstall}
              onManage={handleManage}
            />
          ))}

          {scope === 'installed' && installedEntries.map((entry) => (
            <MarketplaceListCard
              key={entry.key}
              item={entry.item}
              record={entry.record}
              installState={installState}
              manageState={manageState}
              onInstall={handleInstall}
              onManage={handleManage}
            />
          ))}
        </div>

        {scope === 'all' && !itemsQuery.isLoading && !itemsQuery.isError && allItems.length === 0 && (
          <div className="text-[13px] text-gray-500 py-8 text-center">{t(copyKeys.emptyData)}</div>
        )}
        {scope === 'installed' && !installedQuery.isLoading && !installedQuery.isError && installedEntries.length === 0 && (
          <div className="text-[13px] text-gray-500 py-8 text-center">{t(copyKeys.emptyInstalled)}</div>
        )}
      </section>

      {scope === 'all' && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          busy={itemsQuery.isFetching}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => (totalPages > 0 ? Math.min(totalPages, current + 1) : current + 1))}
        />
      )}
      <ConfirmDialog />
    </PageLayout>
  );
}
