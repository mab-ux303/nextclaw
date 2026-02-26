import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getLanguage, type I18nLanguage } from '@/lib/i18n';

const DOCS_PRIMARY_DOMAIN = 'docs.nextclaw.io';
const DOCS_PAGES_DEV = 'nextclaw-docs.pages.dev';
const DOCS_HOSTS = new Set([
    DOCS_PRIMARY_DOMAIN,
    `www.${DOCS_PRIMARY_DOMAIN}`,
    DOCS_PAGES_DEV,
    `www.${DOCS_PAGES_DEV}`,
]);

export const DOCS_DEFAULT_BASE_URL = `https://${DOCS_PRIMARY_DOMAIN}`;
const DOCS_DEFAULT_GUIDE_PATH = '/guide/getting-started';

export type DocBrowserMode = 'floating' | 'docked';

/** Normalize URL for comparison: strip .html and trailing slash */
function normalizeDocUrl(u: string): string {
    try { return new URL(u).pathname.replace(/\.html$/, '').replace(/\/$/, ''); } catch { return u; }
}

function toDocsLocale(language: I18nLanguage): 'en' | 'zh' {
    return language === 'zh' ? 'zh' : 'en';
}

function ensureLocalizedDocsPath(pathname: string, locale: 'en' | 'zh'): string {
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

    if (normalized === '/' || normalized === '') {
        return `/${locale}/`;
    }

    if (/^\/(en|zh)(\/|$)/.test(normalized)) {
        return normalized;
    }

    return `/${locale}${normalized}`;
}

function resolveLocalizedDocsUrl(url: string): string {
    const locale = toDocsLocale(getLanguage());

    try {
        const parsed = new URL(url, DOCS_DEFAULT_BASE_URL);
        if (!DOCS_HOSTS.has(parsed.hostname)) {
            return parsed.toString();
        }

        parsed.pathname = ensureLocalizedDocsPath(parsed.pathname, locale);
        return parsed.toString();
    } catch {
        return new URL(`/${locale}${DOCS_DEFAULT_GUIDE_PATH}`, DOCS_DEFAULT_BASE_URL).toString();
    }
}

function getDefaultDocsUrl(): string {
    return resolveLocalizedDocsUrl(DOCS_DEFAULT_GUIDE_PATH);
}

interface DocBrowserState {
    isOpen: boolean;
    mode: DocBrowserMode;
    currentUrl: string;
    history: string[];
    historyIndex: number;
    /** Increments on parent-initiated navigation (navigate/goBack/goForward) */
    navVersion: number;
}

interface DocBrowserActions {
    open: (url?: string) => void;
    close: () => void;
    toggleMode: () => void;
    setMode: (mode: DocBrowserMode) => void;
    /** Parent-initiated navigation — will cause iframe to reload to this URL */
    navigate: (url: string) => void;
    /** Iframe-initiated sync — records URL to history without reloading iframe */
    syncUrl: (url: string) => void;
    goBack: () => void;
    goForward: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
}

type DocBrowserContextValue = DocBrowserState & DocBrowserActions;

const DocBrowserContext = createContext<DocBrowserContextValue | null>(null);

export function useDocBrowser(): DocBrowserContextValue {
    const ctx = useContext(DocBrowserContext);
    if (!ctx) throw new Error('useDocBrowser must be used within DocBrowserProvider');
    return ctx;
}

/** Check if a URL belongs to the docs domain */
export function isDocsUrl(url: string): boolean {
    try {
        const parsed = new URL(url, window.location.origin);
        return DOCS_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
}

export function DocBrowserProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DocBrowserState>({
        isOpen: false,
        mode: 'docked',
        currentUrl: getDefaultDocsUrl(),
        history: [getDefaultDocsUrl()],
        historyIndex: 0,
        navVersion: 0,
    });

    const open = useCallback((url?: string) => {
        const targetUrl = resolveLocalizedDocsUrl(url || state.currentUrl || getDefaultDocsUrl());
        setState(prev => ({
            ...prev,
            isOpen: true,
            currentUrl: targetUrl,
            history: [...prev.history.slice(0, prev.historyIndex + 1), targetUrl],
            historyIndex: prev.historyIndex + 1,
            navVersion: prev.navVersion + 1,
        }));
    }, [state.currentUrl]);

    const close = useCallback(() => {
        setState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const toggleMode = useCallback(() => {
        setState(prev => ({ ...prev, mode: prev.mode === 'floating' ? 'docked' : 'floating' }));
    }, []);

    const setMode = useCallback((mode: DocBrowserMode) => {
        setState(prev => ({ ...prev, mode }));
    }, []);

    /** Parent-initiated: push to history AND bump navVersion so iframe reloads */
    const navigate = useCallback((url: string) => {
        const targetUrl = resolveLocalizedDocsUrl(url);
        setState(prev => {
            if (normalizeDocUrl(targetUrl) === normalizeDocUrl(prev.currentUrl)) return prev;
            return {
                ...prev,
                currentUrl: targetUrl,
                history: [...prev.history.slice(0, prev.historyIndex + 1), targetUrl],
                historyIndex: prev.historyIndex + 1,
                navVersion: prev.navVersion + 1,
            };
        });
    }, []);

    /** Iframe-initiated: push to history but do NOT bump navVersion (no iframe reload) */
    const syncUrl = useCallback((url: string) => {
        setState(prev => {
            if (normalizeDocUrl(url) === normalizeDocUrl(prev.currentUrl)) return prev;
            return {
                ...prev,
                currentUrl: url,
                history: [...prev.history.slice(0, prev.historyIndex + 1), url],
                historyIndex: prev.historyIndex + 1,
            };
        });
    }, []);

    const goBack = useCallback(() => {
        setState(prev => {
            if (prev.historyIndex <= 0) return prev;
            const newIndex = prev.historyIndex - 1;
            return { ...prev, historyIndex: newIndex, currentUrl: prev.history[newIndex] };
        });
    }, []);

    const goForward = useCallback(() => {
        setState(prev => {
            if (prev.historyIndex >= prev.history.length - 1) return prev;
            const newIndex = prev.historyIndex + 1;
            return { ...prev, historyIndex: newIndex, currentUrl: prev.history[newIndex] };
        });
    }, []);

    const canGoBack = state.historyIndex > 0;
    const canGoForward = state.historyIndex < state.history.length - 1;

    const value = useMemo<DocBrowserContextValue>(() => ({
        ...state,
        open,
        close,
        toggleMode,
        setMode,
        navigate,
        syncUrl,
        goBack,
        goForward,
        canGoBack,
        canGoForward,
    }), [state, open, close, toggleMode, setMode, navigate, syncUrl, goBack, goForward, canGoBack, canGoForward]);

    return (
        <DocBrowserContext.Provider value={value}>
            {children}
        </DocBrowserContext.Provider>
    );
}
