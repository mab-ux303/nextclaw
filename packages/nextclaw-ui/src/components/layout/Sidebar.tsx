import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { Cpu, GitBranch, History, MessageSquare, Sparkles, BookOpen, Store, AlarmClock } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useDocBrowser } from '@/components/doc-browser';

const navItems = [
  {
    target: '/model',
    label: 'Models',
    icon: Cpu,
  },
  {
    target: '/providers',
    label: 'Providers',
    icon: Sparkles,
  },
  {
    target: '/channels',
    label: 'Channels',
    icon: MessageSquare,
  },
  {
    target: '/runtime',
    label: 'Routing & Runtime',
    icon: GitBranch,
  },
  {
    target: '/sessions',
    label: t('sessions'),
    icon: History,
  },
  {
    target: '/cron',
    label: t('cron'),
    icon: AlarmClock,
  },
  {
    target: '/marketplace',
    label: 'Marketplace',
    icon: Store,
  }
];

export function Sidebar() {
  const docBrowser = useDocBrowser();

  return (
    <aside className="w-[240px] bg-[#f0f2f7] flex flex-col h-full py-6 px-4">
      {/* Logo Area */}
      <div className="px-2 mb-8">
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center">
            <img src="/logo.svg" alt="NextClaw" className="h-full w-full object-contain" />
          </div>
          <span className="text-[15px] font-semibold text-gray-800 tracking-[-0.01em]">NextClaw</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.target}>
                <NavLink
                  to={item.target}
                  className={({ isActive }) => cn(
                    'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-base',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-gray-600 hover:bg-[#e4e7ef] hover:text-gray-800'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn(
                        'h-[17px] w-[17px] transition-colors',
                        isActive ? 'text-primary' : 'text-gray-400'
                      )} />
                      <span className="flex-1 text-left">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Help Button */}
      <div className="pt-3 border-t border-[#dde0ea] mt-3">
        <button
          onClick={() => docBrowser.open()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-base text-gray-600 hover:bg-[#e4e7ef] hover:text-gray-800"
        >
          <BookOpen className="h-[17px] w-[17px] text-gray-400" />
          <span className="flex-1 text-left">{t('docBrowserHelp')}</span>
        </button>
      </div>
    </aside>
  );
}
