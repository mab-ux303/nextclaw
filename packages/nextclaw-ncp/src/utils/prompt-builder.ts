// Draft helper to keep skill-augmented prompting format in one place.
export function buildSkillAugmentedPrompt(params: {
  userMessage: string;
  requestedSkills: string[];
  requestedSkillsContent?: string;
}): string {
  const requestedSkillsContent = params.requestedSkillsContent?.trim() ?? "";
  if (!requestedSkillsContent) {
    return params.userMessage;
  }
  return [
    "## Requested Skills",
    `Selected skills: ${params.requestedSkills.join(", ")}`,
    requestedSkillsContent,
    "## User Message",
    params.userMessage,
  ].join("\n\n");
}
