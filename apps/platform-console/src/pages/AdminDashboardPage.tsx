import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmRechargeIntent,
  fetchAdminOverview,
  fetchAdminRechargeIntents,
  fetchAdminUsers,
  rejectRechargeIntent,
  updateAdminUser,
  updateGlobalFreeLimit
} from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { formatUsd } from '@/lib/utils';

type Props = {
  token: string;
};

export function AdminDashboardPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [globalLimitInput, setGlobalLimitInput] = useState('20');

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token)
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => await fetchAdminUsers(token)
  });

  const intentsQuery = useQuery({
    queryKey: ['admin-intents'],
    queryFn: async () => await fetchAdminRechargeIntents(token)
  });

  const setGlobalLimitMutation = useMutation({
    mutationFn: async () => {
      await updateGlobalFreeLimit(token, Number(globalLimitInput));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    }
  });

  const addBalanceMutation = useMutation({
    mutationFn: async (payload: { userId: string; delta: number }) => {
      await updateAdminUser(token, payload.userId, { paidBalanceDeltaUsd: payload.delta });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
      ]);
    }
  });

  const confirmIntentMutation = useMutation({
    mutationFn: async (intentId: string) => {
      await confirmRechargeIntent(token, intentId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-intents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
      ]);
    }
  });

  const rejectIntentMutation = useMutation({
    mutationFn: async (intentId: string) => {
      await rejectRechargeIntent(token, intentId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intents'] });
    }
  });

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <CardTitle>平台总览</CardTitle>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">全局免费池上限</p>
            <p className="mt-1 text-lg font-semibold">{formatUsd(overviewQuery.data?.globalFreeLimitUsd ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">全局免费池已消耗</p>
            <p className="mt-1 text-lg font-semibold">{formatUsd(overviewQuery.data?.globalFreeUsedUsd ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">用户数</p>
            <p className="mt-1 text-lg font-semibold">{overviewQuery.data?.userCount ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">待审核充值</p>
            <p className="mt-1 text-lg font-semibold">{overviewQuery.data?.pendingRechargeIntents ?? 0}</p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[220px_160px]">
          <Input value={globalLimitInput} onChange={(event) => setGlobalLimitInput(event.target.value)} placeholder="设置新全局免费池上限" />
          <Button onClick={() => setGlobalLimitMutation.mutate()} disabled={setGlobalLimitMutation.isPending}>更新上限</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>用户管理（快速手动充值）</CardTitle>
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">邮箱</th>
                <th className="px-3 py-2">角色</th>
                <th className="px-3 py-2">免费剩余</th>
                <th className="px-3 py-2">付费余额</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data?.items ?? []).map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2">{user.role}</td>
                  <td className="px-3 py-2">{formatUsd(user.freeRemainingUsd)}</td>
                  <td className="px-3 py-2">{formatUsd(user.paidBalanceUsd)}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-2"
                      onClick={() => addBalanceMutation.mutate({ userId: user.id, delta: 10 })}
                    >
                      +$10
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card className="space-y-3">
        <CardTitle>充值审核</CardTitle>
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">申请时间</th>
                <th className="px-3 py-2">用户</th>
                <th className="px-3 py-2">金额</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {(intentsQuery.data?.items ?? []).map((intent) => (
                <tr key={intent.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{new Date(intent.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{intent.userId}</td>
                  <td className="px-3 py-2">{formatUsd(intent.amountUsd)}</td>
                  <td className="px-3 py-2">{intent.status}</td>
                  <td className="px-3 py-2">
                    {intent.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button className="h-8 px-2" onClick={() => confirmIntentMutation.mutate(intent.id)}>通过</Button>
                        <Button variant="danger" className="h-8 px-2" onClick={() => rejectIntentMutation.mutate(intent.id)}>拒绝</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">已处理</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
