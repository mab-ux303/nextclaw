async function loadCodexConstructor() {
  const mod = await import("@openai/codex-sdk");
  if (!mod || typeof mod.Codex !== "function") {
    throw new Error("[codex-ncp-runtime] failed to load Codex constructor from @openai/codex-sdk");
  }
  return mod.Codex;
}

module.exports = {
  loadCodexConstructor,
};
