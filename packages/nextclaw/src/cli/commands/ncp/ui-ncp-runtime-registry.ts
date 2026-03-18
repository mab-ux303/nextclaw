import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";

export const DEFAULT_UI_NCP_RUNTIME_KIND = "native";

export type UiNcpSessionTypeOption = {
  value: string;
  label: string;
};

export type UiNcpRuntimeRegistration = {
  kind: string;
  label: string;
  createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
};

function normalizeRuntimeKind(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function readRequestedRuntimeKind(sessionMetadata: Record<string, unknown>): string | null {
  return (
    normalizeRuntimeKind(sessionMetadata.session_type) ??
    normalizeRuntimeKind(sessionMetadata.sessionType) ??
    null
  );
}

export class UiNcpRuntimeRegistry {
  private readonly registrations = new Map<string, UiNcpRuntimeRegistration>();

  constructor(private readonly defaultKind = DEFAULT_UI_NCP_RUNTIME_KIND) {}

  register(registration: UiNcpRuntimeRegistration): void {
    const normalizedKind = normalizeRuntimeKind(registration.kind);
    if (!normalizedKind) {
      throw new Error("ui ncp runtime kind must be a non-empty string");
    }

    this.registrations.set(normalizedKind, {
      ...registration,
      kind: normalizedKind,
    });
  }

  createRuntime(params: RuntimeFactoryParams): NcpAgentRuntime {
    const requestedKind = readRequestedRuntimeKind(params.sessionMetadata) ?? this.defaultKind;
    const registration = this.registrations.get(requestedKind);
    if (!registration) {
      throw new Error(`ncp runtime unavailable: ${requestedKind}`);
    }

    const nextSessionMetadata = {
      ...params.sessionMetadata,
      session_type: registration.kind,
    };
    params.setSessionMetadata(nextSessionMetadata);
    return registration.createRuntime({
      ...params,
      sessionMetadata: nextSessionMetadata,
    });
  }

  listSessionTypes(): {
    defaultType: string;
    options: UiNcpSessionTypeOption[];
  } {
    const options = [...this.registrations.values()]
      .map((registration) => ({
        value: registration.kind,
        label: registration.label,
      }))
      .sort((left, right) => {
        if (left.value === this.defaultKind) {
          return -1;
        }
        if (right.value === this.defaultKind) {
          return 1;
        }
        return left.value.localeCompare(right.value);
      });

    return {
      defaultType: this.defaultKind,
      options,
    };
  }
}
