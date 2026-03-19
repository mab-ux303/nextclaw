import createJitiImport from "jiti";

type JitiFactory = (
  filename: string,
  options?: Record<string, unknown>
) => (id: string) => unknown;

const createJiti = createJitiImport as unknown as JitiFactory;

export function createPluginJiti(aliases: Record<string, string>): ReturnType<JitiFactory> {
  return createJiti(import.meta.url, {
    interopDefault: true,
    extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"],
    alias: aliases,
    // Plugin install/upgrade is expected to hot-apply at runtime. Disable
    // Jiti's persistent/native require cache so a reload always sees the
    // latest plugin code on disk instead of reusing a stale in-memory module.
    requireCache: false,
    cache: false,
  });
}
