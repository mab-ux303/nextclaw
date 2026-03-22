export type HostBoundRemoteAccessSession = {
  id: string;
};

export function resolveHostBoundRemoteAccessSession<T extends HostBoundRemoteAccessSession>(params: {
  hostSessionId: string | null;
  cookieSession: T | null;
}): T | null {
  if (params.hostSessionId) {
    if (!params.cookieSession || params.cookieSession.id !== params.hostSessionId) {
      return null;
    }
    return params.cookieSession;
  }
  return params.cookieSession;
}
