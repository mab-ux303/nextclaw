async function loadClaudeCodeSdkModule() {
  const mod = await import("@anthropic-ai/claude-code");
  if (!mod || typeof mod.query !== "function") {
    throw new Error("[claude-ncp-runtime] failed to load query() from @anthropic-ai/claude-code");
  }
  return mod;
}

module.exports = {
  loadClaudeCodeSdkModule,
};
