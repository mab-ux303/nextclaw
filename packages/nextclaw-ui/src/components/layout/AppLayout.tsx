import { Sidebar } from './Sidebar';
import { DocBrowserProvider, DocBrowser, useDocBrowser, useDocLinkInterceptor } from '@/components/doc-browser';

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, mode } = useDocBrowser();
  useDocLinkInterceptor();

  return (
    <div className="h-screen flex bg-background font-sans text-foreground">
      <Sidebar />
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-auto custom-scrollbar p-8">
            <div className="max-w-6xl mx-auto animate-fade-in h-full">
              {children}
            </div>
          </main>
        </div>
        {/* Doc Browser: docked mode renders inline, floating mode renders as overlay */}
        {isOpen && mode === 'docked' && <DocBrowser />}
      </div>
      {isOpen && mode === 'floating' && <DocBrowser />}
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <DocBrowserProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </DocBrowserProvider>
  );
}
