import { useConfig, useConfigMeta, useConfigSchema } from '@/hooks/useConfig';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { ProviderForm } from './ProviderForm';
import { useUiStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';
import { Tabs } from '@/components/ui/tabs-custom';
import { LogoBadge } from '@/components/common/LogoBadge';
import { getProviderLogo } from '@/lib/logos';
import { hintForPath } from '@/lib/config-hints';
import { ConfigCard, ConfigCardHeader, ConfigCardBody, ConfigCardFooter } from '@/components/ui/config-card';
import { StatusDot } from '@/components/ui/status-dot';
import { ActionLink } from '@/components/ui/action-link';

export function ProvidersList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const { openProviderModal } = useUiStore();
  const [activeTab, setActiveTab] = useState('installed');
  const uiHints = schema?.uiHints;

  if (!config || !meta) {
    return <div className="p-8">Loading...</div>;
  }

  const tabs = [
    { id: 'installed', label: 'Configured', count: config.providers ? Object.keys(config.providers).filter(k => config.providers[k].apiKeySet).length : 0 },
    { id: 'all', label: 'All Providers' }
  ];

  const filteredProviders = activeTab === 'installed'
    ? meta.providers.filter((p) => config.providers[p.name]?.apiKeySet)
    : meta.providers;

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">AI Providers</h2>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProviders.map((provider) => {
          const providerConfig = config.providers[provider.name];
          const hasConfig = providerConfig?.apiKeySet;
          const providerHint = hintForPath(`providers.${provider.name}`, uiHints);
          const description = providerHint?.help || 'Configure AI services for your agents';

          return (
            <ConfigCard key={provider.name} onClick={() => openProviderModal(provider.name)}>
              <ConfigCardHeader>
                <LogoBadge
                  name={provider.name}
                  src={getProviderLogo(provider.name)}
                  className={cn(
                    'h-11 w-11 rounded-xl border transition-all',
                    hasConfig
                      ? 'bg-white border-primary/30'
                      : 'bg-white border-gray-200/60 group-hover:border-gray-300'
                  )}
                  imgClassName="h-6 w-6"
                  fallback={(
                    <span className={cn(
                      'text-base font-semibold uppercase',
                      hasConfig ? 'text-gray-800' : 'text-gray-400'
                    )}>
                      {provider.name[0]}
                    </span>
                  )}
                />
                <StatusDot
                  status={hasConfig ? 'ready' : 'setup'}
                  label={hasConfig ? 'Ready' : 'Setup'}
                />
              </ConfigCardHeader>

              <ConfigCardBody
                title={provider.displayName || provider.name}
                description={description}
              />

              <ConfigCardFooter>
                <ActionLink label={hasConfig ? 'Configure' : 'Add Provider'} />
              </ConfigCardFooter>
            </ConfigCard>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProviders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-gray-100/80 mb-4">
            <KeyRound className="h-6 w-6 text-gray-300" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 mb-1.5">
            No providers configured
          </h3>
          <p className="text-[13px] text-gray-400 max-w-sm">
            Add an AI provider to start using the platform.
          </p>
        </div>
      )}

      <ProviderForm />
    </div>
  );
}
