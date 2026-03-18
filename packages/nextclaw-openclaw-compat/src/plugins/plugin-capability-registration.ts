import type {
  OpenClawPluginNcpAgentRuntimeRegistration,
  PluginDiagnostic,
  PluginRecord,
  PluginRegistry,
} from "./types.js";
import type { PluginRegisterRuntime } from "./registry.js";

export function ensureUniqueNames(params: {
  names: string[];
  pluginId: string;
  diagnostics: PluginDiagnostic[];
  source: string;
  owners: Map<string, string>;
  reserved: Set<string>;
  kind: "tool" | "channel" | "provider" | "engine" | "ncp-runtime";
}): string[] {
  const accepted: string[] = [];
  for (const rawName of params.names) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }
    if (params.reserved.has(name)) {
      params.diagnostics.push({
        level: "error",
        pluginId: params.pluginId,
        source: params.source,
        message: `${params.kind} already registered by core: ${name}`,
      });
      continue;
    }
    const owner = params.owners.get(name);
    if (owner && owner !== params.pluginId) {
      params.diagnostics.push({
        level: "error",
        pluginId: params.pluginId,
        source: params.source,
        message: `${params.kind} already registered: ${name} (${owner})`,
      });
      continue;
    }
    params.owners.set(name, params.pluginId);
    accepted.push(name);
  }
  return accepted;
}

export function registerPluginEngine(params: {
  runtime: PluginRegisterRuntime;
  record: PluginRecord;
  pluginId: string;
  source: string;
  kind: string;
  factory: PluginRegistry["engines"][number]["factory"];
}): void {
  const accepted = ensureUniqueNames({
    names: [params.kind],
    pluginId: params.pluginId,
    diagnostics: params.runtime.registry.diagnostics,
    source: params.source,
    owners: params.runtime.engineKindOwners,
    reserved: params.runtime.reservedEngineKinds,
    kind: "engine",
  });
  if (accepted.length === 0) {
    return;
  }
  params.runtime.registry.engines.push({
    pluginId: params.pluginId,
    kind: accepted[0],
    factory: params.factory,
    source: params.source,
  });
  params.record.engineKinds.push(accepted[0]);
}

export function registerPluginNcpAgentRuntime(params: {
  runtime: PluginRegisterRuntime;
  record: PluginRecord;
  pluginId: string;
  source: string;
  registration: OpenClawPluginNcpAgentRuntimeRegistration;
}): void {
  const rawKind = params.registration.kind?.trim().toLowerCase();
  if (!rawKind) {
    params.runtime.registry.diagnostics.push({
      level: "error",
      pluginId: params.pluginId,
      source: params.source,
      message: "registerNcpAgentRuntime requires registration.kind",
    });
    return;
  }

  const accepted = ensureUniqueNames({
    names: [rawKind],
    pluginId: params.pluginId,
    diagnostics: params.runtime.registry.diagnostics,
    source: params.source,
    owners: params.runtime.ncpAgentRuntimeKindOwners,
    reserved: params.runtime.reservedNcpAgentRuntimeKinds,
    kind: "ncp-runtime",
  });
  if (accepted.length === 0) {
    return;
  }

  params.runtime.registry.ncpAgentRuntimes.push({
    pluginId: params.pluginId,
    kind: accepted[0],
    label: params.registration.label?.trim() || accepted[0],
    createRuntime: params.registration.createRuntime,
    source: params.source,
  });
  params.record.ncpAgentRuntimeKinds.push(accepted[0]);
}
