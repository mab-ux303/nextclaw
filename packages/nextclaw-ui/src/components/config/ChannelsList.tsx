import { useConfig, useConfigMeta, useConfigSchema } from '@/hooks/useConfig';
import { MessageCircle, Mail, MessageSquare, Slack, ExternalLink, Bell, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { ChannelForm } from './ChannelForm';
import { useUiStore } from '@/stores/ui.store';
import { Tabs } from '@/components/ui/tabs-custom';
import { LogoBadge } from '@/components/common/LogoBadge';
import { getChannelLogo } from '@/lib/logos';
import { hintForPath } from '@/lib/config-hints';
import { ConfigCard, ConfigCardHeader, ConfigCardBody, ConfigCardFooter } from '@/components/ui/config-card';
import { StatusDot } from '@/components/ui/status-dot';
import { ActionLink } from '@/components/ui/action-link';
import { cn } from '@/lib/utils';

const channelIcons: Record<string, typeof MessageCircle> = {
  telegram: MessageCircle,
  slack: Slack,
  email: Mail,
  webhook: Bell,
  default: MessageSquare
};

const channelDescriptions: Record<string, string> = {
  telegram: 'Connect with Telegram bots for instant messaging',
  slack: 'Integrate with Slack workspaces for team collaboration',
  email: 'Send and receive messages via email protocols',
  webhook: 'Receive HTTP webhooks for custom integrations',
  discord: 'Connect Discord bots to your community servers',
  feishu: 'Enterprise messaging and collaboration platform'
};

export function ChannelsList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const { openChannelModal } = useUiStore();
  const [activeTab, setActiveTab] = useState('active');
  const uiHints = schema?.uiHints;

  if (!config || !meta) {
    return <div className="p-8 text-gray-400">Loading channels...</div>;
  }

  const tabs = [
    { id: 'active', label: 'Enabled', count: meta.channels.filter(c => config.channels[c.name]?.enabled).length },
    { id: 'all', label: 'All Channels', count: meta.channels.length }
  ];

  const filteredChannels = meta.channels.filter(channel => {
    const enabled = config.channels[channel.name]?.enabled || false;
    return activeTab === 'all' || enabled;
  });

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Message Channels</h2>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredChannels.map((channel) => {
          const channelConfig = config.channels[channel.name];
          const enabled = channelConfig?.enabled || false;
          const Icon = channelIcons[channel.name] || channelIcons.default;
          const channelHint = hintForPath(`channels.${channel.name}`, uiHints);
          const description =
            channelHint?.help ||
            channelDescriptions[channel.name] ||
            'Configure this communication channel';

          return (
            <ConfigCard key={channel.name} onClick={() => openChannelModal(channel.name)}>
              <ConfigCardHeader>
                <LogoBadge
                  name={channel.name}
                  src={getChannelLogo(channel.name)}
                  className={cn(
                    'h-11 w-11 rounded-xl border transition-all',
                    enabled
                      ? 'bg-white border-primary/30'
                      : 'bg-white border-gray-200/60 group-hover:border-gray-300'
                  )}
                  imgClassName="h-5 w-5"
                  fallback={<Icon className="h-5 w-5" />}
                />
                <StatusDot
                  status={enabled ? 'active' : 'inactive'}
                  label={enabled ? 'Active' : 'Inactive'}
                />
              </ConfigCardHeader>

              <ConfigCardBody
                title={channel.displayName || channel.name}
                description={description}
              />

              <ConfigCardFooter>
                <ActionLink label={enabled ? 'Configure' : 'Enable'} />
                {channel.tutorialUrl && (
                  <a
                    href={channel.tutorialUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center h-6 w-6 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100/60 transition-colors"
                    title="View Guide"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </ConfigCardFooter>
            </ConfigCard>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredChannels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-gray-100/80 mb-4">
            <MessageSquare className="h-6 w-6 text-gray-300" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 mb-1.5">
            No channels enabled
          </h3>
          <p className="text-[13px] text-gray-400 max-w-sm">
            Enable a messaging channel to start receiving messages.
          </p>
        </div>
      )}

      <ChannelForm />
    </div>
  );
}
