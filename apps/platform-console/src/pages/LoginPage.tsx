import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { login, register } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';

type Mode = 'login' | 'register';

export function LoginPage(): JSX.Element {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'login') {
        return await login(email, password);
      }
      return await register(email, password);
    },
    onSuccess: (result) => {
      setToken(result.token);
      setUser(result.user);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to continue');
    }
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
        <Card className="w-full space-y-5 p-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700">NextClaw Platform</p>
            <CardTitle>{mode === 'login' ? '登录平台' : '创建账号'}</CardTitle>
            <p className="text-sm text-slate-500">登录后才能使用平台 API，免费额度与充值都按账号记账。</p>
          </div>

          <div className="space-y-3">
            <Input type="email" placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input type="password" placeholder="密码（至少 8 位）" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <Button
            className="h-10 w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || email.trim().length === 0 || password.trim().length < 8}
          >
            {mutation.isPending ? '处理中...' : mode === 'login' ? '登录' : '注册并登录'}
          </Button>

          <Button
            className="h-9 w-full"
            variant="ghost"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
          </Button>
        </Card>
      </div>
    </main>
  );
}
