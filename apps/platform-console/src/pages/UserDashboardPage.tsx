import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRemoteShareGrant,
  createRechargeIntent,
  fetchBillingLedger,
  fetchBillingOverview,
  fetchRechargeIntents,
  fetchRemoteInstances,
  fetchRemoteShareGrants,
  openRemoteInstance,
  revokeRemoteShareGrant
} from '@/api/client';
import type { RemoteInstance, RemoteShareGrant } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { formatUsd, toFixedUsd } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

type Props = {
  token: string;
};

type RemoteInstancesCardProps = {
  token: string;
};

type RemoteInstancesTableProps = {
  instances: RemoteInstance[];
  isLoading: boolean;
  resolvedInstanceId: string | null;
  isCreatingShare: boolean;
  isOpeningInstance: boolean;
  onCreateShare: (instanceId: string) => void;
  onSelectInstance: (instanceId: string) => void;
  onOpenInstance: (instanceId: string) => void;
};

type RemoteShareGrantPanelProps = {
  instanceId: string | null;
  grants: RemoteShareGrant[];
  isLoading: boolean;
  error: unknown;
  isCreatingShare: boolean;
  isRevokingShare: boolean;
  onCreateShare: (instanceId: string) => void;
  onCopyShareUrl: (shareUrl: string) => void;
  onRevokeShare: (grantId: string, instanceId: string) => void;
};

function RemoteInstancesTable({
  instances,
  isLoading,
  resolvedInstanceId,
  isCreatingShare,
  isOpeningInstance,
  onCreateShare,
  onSelectInstance,
  onOpenInstance
}: RemoteInstancesTableProps): JSX.Element {
  return (
    <TableWrap>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">实例</th>
            <th className="px-3 py-2">平台</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2">最近在线</th>
            <th className="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((instance) => (
            <tr key={instance.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-900">{instance.displayName}</div>
                <div className="text-xs text-slate-500">{instance.appVersion}</div>
              </td>
              <td className="px-3 py-2">{instance.platform}</td>
              <td className="px-3 py-2">
                <span className={instance.status === 'online' ? 'text-emerald-600' : 'text-slate-500'}>
                  {instance.status}
                </span>
              </td>
              <td className="px-3 py-2">{new Date(instance.lastSeenAt).toLocaleString()}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => onCreateShare(instance.id)}
                    disabled={isCreatingShare}
                  >
                    创建分享链接
                  </Button>
                  <Button
                    variant={resolvedInstanceId === instance.id ? 'ghost' : 'secondary'}
                    onClick={() => onSelectInstance(instance.id)}
                  >
                    查看分享
                  </Button>
                  <Button
                    onClick={() => onOpenInstance(instance.id)}
                    disabled={instance.status !== 'online' || isOpeningInstance}
                  >
                    在网页中打开
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {!isLoading && instances.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">
                还没有可用实例。先回到桌面端登录 NextClaw 并开启远程访问。
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </TableWrap>
  );
}

function RemoteShareGrantPanel({
  instanceId,
  grants,
  isLoading,
  error,
  isCreatingShare,
  isRevokingShare,
  onCreateShare,
  onCopyShareUrl,
  onRevokeShare
}: RemoteShareGrantPanelProps): JSX.Element | null {
  if (!instanceId) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">分享链接</p>
          <p className="text-sm text-slate-500">撤销后，已经打开的分享会话也会立即失效。</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => onCreateShare(instanceId)}
          disabled={isCreatingShare}
        >
          再创建一个
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">加载分享链接中...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error instanceof Error ? error.message : '加载分享失败'}</p> : null}
      {!isLoading && grants.length === 0 ? <p className="text-sm text-slate-500">当前实例还没有分享链接。</p> : null}

      <div className="space-y-3">
        {grants.map((grant) => (
          <div key={grant.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {grant.status === 'active' ? '可用分享' : grant.status === 'revoked' ? '已撤销分享' : '已过期分享'}
                </p>
                <p className="text-xs text-slate-500">
                  创建于 {new Date(grant.createdAt).toLocaleString()}，失效于 {new Date(grant.expiresAt).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">当前活跃分享会话：{grant.activeSessionCount}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => onCopyShareUrl(grant.shareUrl)}>
                  复制链接
                </Button>
                <Button variant="ghost" onClick={() => window.open(grant.shareUrl, '_blank', 'noopener,noreferrer')}>
                  打开链接
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onRevokeShare(grant.id, grant.instanceId)}
                  disabled={grant.status !== 'active' || isRevokingShare}
                >
                  撤销
                </Button>
              </div>
            </div>
            <Input className="mt-3" value={grant.shareUrl} readOnly />
          </div>
        ))}
      </div>
    </div>
  );
}

function RemoteInstancesCard({ token }: RemoteInstancesCardProps): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const remoteInstancesQuery = useQuery({
    queryKey: ['remote-instances'],
    queryFn: async () => await fetchRemoteInstances(token)
  });

  const resolvedInstanceId = selectedInstanceId ?? remoteInstancesQuery.data?.items?.[0]?.id ?? null;

  const remoteShareGrantsQuery = useQuery({
    queryKey: ['remote-share-grants', resolvedInstanceId],
    enabled: Boolean(resolvedInstanceId),
    queryFn: async () => await fetchRemoteShareGrants(token, resolvedInstanceId ?? '')
  });

  const openRemoteInstanceMutation = useMutation({
    mutationFn: async (instanceId: string) => await openRemoteInstance(token, instanceId),
    onSuccess: (session) => {
      window.open(session.openUrl, '_blank', 'noopener,noreferrer');
    }
  });

  const createRemoteShareMutation = useMutation({
    mutationFn: async (instanceId: string) => await createRemoteShareGrant(token, instanceId),
    onSuccess: async (grant) => {
      setSelectedInstanceId(grant.instanceId);
      await queryClient.invalidateQueries({ queryKey: ['remote-share-grants', grant.instanceId] });
      try {
        await navigator.clipboard.writeText(grant.shareUrl);
        setShareFeedback('新分享链接已复制到剪贴板。');
      } catch {
        setShareFeedback('新分享链接已创建，请手动复制。');
      }
    }
  });

  const revokeRemoteShareMutation = useMutation({
    mutationFn: async (params: { grantId: string; instanceId: string }) => await revokeRemoteShareGrant(token, params.grantId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['remote-share-grants', variables.instanceId] });
      setShareFeedback('分享链接已撤销，已打开的分享会话会立即失效。');
    }
  });

  async function copyShareUrl(shareUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback('分享链接已复制到剪贴板。');
    } catch {
      setShareFeedback('复制失败，请手动复制链接。');
    }
  }

  return (
    <Card className="space-y-4 rounded-[28px] border-slate-200/80 p-5">
      <CardTitle>我的实例</CardTitle>
      <p className="text-sm text-slate-500">
        在桌面端登录 NextClaw Account 并开启远程访问后，实例会出现在这里。你可以直接在网页里打开它，也可以生成可撤销的分享链接给其他人访问。
      </p>
      <RemoteInstancesTable
        instances={remoteInstancesQuery.data?.items ?? []}
        isLoading={remoteInstancesQuery.isLoading}
        resolvedInstanceId={resolvedInstanceId}
        isCreatingShare={createRemoteShareMutation.isPending}
        isOpeningInstance={openRemoteInstanceMutation.isPending}
        onCreateShare={(instanceId) => {
          setSelectedInstanceId(instanceId);
          void createRemoteShareMutation.mutateAsync(instanceId);
        }}
        onSelectInstance={setSelectedInstanceId}
        onOpenInstance={(instanceId) => openRemoteInstanceMutation.mutate(instanceId)}
      />
      {remoteInstancesQuery.error ? (
        <p className="text-sm text-rose-600">
          {remoteInstancesQuery.error instanceof Error ? remoteInstancesQuery.error.message : '实例加载失败'}
        </p>
      ) : null}
      {openRemoteInstanceMutation.error ? (
        <p className="text-sm text-rose-600">
          {openRemoteInstanceMutation.error instanceof Error ? openRemoteInstanceMutation.error.message : '打开实例失败'}
        </p>
      ) : null}
      {createRemoteShareMutation.error ? (
        <p className="text-sm text-rose-600">
          {createRemoteShareMutation.error instanceof Error ? createRemoteShareMutation.error.message : '创建分享失败'}
        </p>
      ) : null}
      {revokeRemoteShareMutation.error ? (
        <p className="text-sm text-rose-600">
          {revokeRemoteShareMutation.error instanceof Error ? revokeRemoteShareMutation.error.message : '撤销分享失败'}
        </p>
      ) : null}
      {shareFeedback ? <p className="text-sm text-slate-600">{shareFeedback}</p> : null}

      <RemoteShareGrantPanel
        instanceId={resolvedInstanceId}
        grants={remoteShareGrantsQuery.data?.items ?? []}
        isLoading={remoteShareGrantsQuery.isLoading}
        error={remoteShareGrantsQuery.error}
        isCreatingShare={createRemoteShareMutation.isPending}
        isRevokingShare={revokeRemoteShareMutation.isPending}
        onCreateShare={(instanceId) => void createRemoteShareMutation.mutateAsync(instanceId)}
        onCopyShareUrl={(shareUrl) => void copyShareUrl(shareUrl)}
        onRevokeShare={(grantId, instanceId) => revokeRemoteShareMutation.mutate({ grantId, instanceId })}
      />
    </Card>
  );
}

export function UserDashboardPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [rechargeAmount, setRechargeAmount] = useState('20');
  const [rechargeNote, setRechargeNote] = useState('');
  const setUser = useAuthStore((state) => state.setUser);

  const overviewQuery = useQuery({
    queryKey: ['billing-overview'],
    queryFn: async () => await fetchBillingOverview(token)
  });

  const ledgerQuery = useQuery({
    queryKey: ['billing-ledger'],
    queryFn: async () => await fetchBillingLedger(token)
  });

  const intentsQuery = useQuery({
    queryKey: ['billing-recharge-intents'],
    queryFn: async () => await fetchRechargeIntents(token)
  });

  const rechargeMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(rechargeAmount);
      await createRechargeIntent(token, amount, rechargeNote.trim());
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['billing-recharge-intents'] }),
        queryClient.invalidateQueries({ queryKey: ['billing-overview'] })
      ]);
      setRechargeNote('');
    }
  });

  const overview = overviewQuery.data;

  const summaryCards = useMemo(() => {
    if (!overview) {
      return [];
    }
    return [
      { label: '个人免费额度剩余', value: formatUsd(overview.user.freeRemainingUsd) },
      { label: '个人付费余额', value: formatUsd(overview.user.paidBalanceUsd) },
      { label: '全局免费池剩余', value: formatUsd(overview.globalFreeRemainingUsd) }
    ];
  }, [overview]);

  if (overviewQuery.isLoading) {
    return <p className="text-sm text-slate-500">加载用户账单中...</p>;
  }

  if (overviewQuery.error) {
    return <p className="text-sm text-rose-600">{overviewQuery.error instanceof Error ? overviewQuery.error.message : '加载失败'}</p>;
  }

  if (!overview) {
    return <p className="text-sm text-slate-500">无数据。</p>;
  }

  setUser(overview.user);

  return (
    <div className="space-y-6">
      <RemoteInstancesCard token={token} />

      <div className="grid gap-3 md:grid-cols-3">
        {summaryCards.map((item) => (
          <Card key={item.label} className="rounded-[28px] border-slate-200/80 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3 rounded-[28px] border-slate-200/80 p-5">
        <CardTitle>提交充值申请</CardTitle>
        <p className="text-sm text-slate-500">当前为“人工审核确认充值”的闭环，不做 credits 换算，直接 USD 入账。</p>
        <div className="grid gap-3 md:grid-cols-[160px_1fr_180px]">
          <Input value={rechargeAmount} onChange={(event) => setRechargeAmount(event.target.value)} placeholder="金额 (USD)" />
          <Input value={rechargeNote} onChange={(event) => setRechargeNote(event.target.value)} placeholder="备注（可选）" />
          <Button onClick={() => rechargeMutation.mutate()} disabled={rechargeMutation.isPending}>提交申请</Button>
        </div>
        {rechargeMutation.error ? (
          <p className="text-sm text-rose-600">{rechargeMutation.error instanceof Error ? rechargeMutation.error.message : '提交失败'}</p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 rounded-[28px] border-slate-200/80 p-5">
          <CardTitle>充值申请记录</CardTitle>
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">金额</th>
                  <th className="px-3 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {(intentsQuery.data?.items ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{formatUsd(item.amountUsd)}</td>
                    <td className="px-3 py-2">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card className="space-y-3 rounded-[28px] border-slate-200/80 p-5">
          <CardTitle>消费流水</CardTitle>
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">类型</th>
                  <th className="px-3 py-2">金额</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerQuery.data?.items ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{item.kind}</td>
                    <td className="px-3 py-2">
                      {item.amountUsd < 0 ? '-' : '+'}{toFixedUsd(Math.abs(item.amountUsd))} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}
