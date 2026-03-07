import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ServiceCommands } from "./service.js";

const cleanupDirs: string[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

type MaterializedGitSkill = {
  tempRoot: string;
  skillDir: string;
  commandOutput: string;
};

type ServiceCommandsHarness = {
  materializeMarketplaceGitSkillSource: (params: {
    source: string;
    skillName: string;
  }) => Promise<MaterializedGitSkill>;
  installGitMarketplaceSkill: (params: {
    slug: string;
    skill?: string;
    installPath?: string;
    force?: boolean;
  }) => Promise<{ message: string; output?: string }>;
  uninstallMarketplaceSkill: (slug: string) => Promise<{ message: string; output?: string }>;
};

function createTempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  cleanupDirs.push(root);
  return root;
}

function setupWorkspaceConfig(): { homeDir: string; workspaceDir: string } {
  const homeDir = createTempRoot("nextclaw-service-home-");
  const workspaceDir = createTempRoot("nextclaw-service-workspace-");
  process.env.NEXTCLAW_HOME = homeDir;
  saveConfig(
    ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: workspaceDir
        }
      }
    }),
    join(homeDir, "config.json")
  );
  return { homeDir, workspaceDir };
}

afterEach(() => {
  process.env.NEXTCLAW_HOME = originalNextclawHome;
  vi.restoreAllMocks();
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("ServiceCommands marketplace git skill install", () => {
  it("skips reinstall when workspace skill already exists", async () => {
    const { workspaceDir } = setupWorkspaceConfig();
    const installedSkillDir = join(workspaceDir, "skills", "pdf");
    mkdirSync(installedSkillDir, { recursive: true });
    writeFileSync(join(installedSkillDir, "SKILL.md"), "# pdf\n");

    const service = new ServiceCommands({
      requestRestart: async () => {}
    }) as unknown as ServiceCommandsHarness;
    const materializeSpy = vi.spyOn(service, "materializeMarketplaceGitSkillSource");

    const result = await service.installGitMarketplaceSkill({
      slug: "anthropics/skills/skills/pdf",
      skill: "pdf",
      installPath: "skills/pdf"
    });

    expect(result.message).toBe("pdf is already installed");
    expect(materializeSpy).not.toHaveBeenCalled();
    expect(existsSync(join(workspaceDir, "skills", "pdf", "SKILL.md"))).toBe(true);
  });

  it("copies a materialized git skill into workspace skills and cleans temp files", async () => {
    const { workspaceDir } = setupWorkspaceConfig();
    const materializedRoot = createTempRoot("nextclaw-materialized-skill-");
    const materializedSkillDir = join(materializedRoot, "skills", "pdf");
    mkdirSync(materializedSkillDir, { recursive: true });
    writeFileSync(join(materializedSkillDir, "SKILL.md"), "# pdf from git\n");

    const service = new ServiceCommands({
      requestRestart: async () => {}
    }) as unknown as ServiceCommandsHarness;

    vi.spyOn(service, "materializeMarketplaceGitSkillSource").mockResolvedValue({
      tempRoot: materializedRoot,
      skillDir: materializedSkillDir,
      commandOutput: "git clone ok"
    });

    const result = await service.installGitMarketplaceSkill({
      slug: "anthropics/skills/skills/pdf",
      skill: "pdf",
      installPath: "skills/pdf",
      force: true
    });

    expect(result.message).toBe("Installed skill: pdf");
    expect(result.output).toContain("Materialized skill");
    expect(readFileSync(join(workspaceDir, "skills", "pdf", "SKILL.md"), "utf-8")).toContain("pdf from git");
    expect(existsSync(materializedRoot)).toBe(false);
  });

  it("uninstalls only from workspace skills", async () => {
    const { workspaceDir } = setupWorkspaceConfig();
    const installedSkillDir = join(workspaceDir, "skills", "pdf");
    mkdirSync(installedSkillDir, { recursive: true });
    writeFileSync(join(installedSkillDir, "SKILL.md"), "# pdf\n");

    const service = new ServiceCommands({
      requestRestart: async () => {}
    }) as unknown as ServiceCommandsHarness;

    const result = await service.uninstallMarketplaceSkill("pdf");

    expect(result.message).toBe("Uninstalled skill: pdf");
    expect(result.output).toContain(installedSkillDir);
    expect(existsSync(installedSkillDir)).toBe(false);
  });
});
