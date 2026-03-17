# v0.13.156 desktop-release-windows-robocopy-exit-code

## 迭代完成说明（改了什么）

- 修复 `.github/workflows/desktop-release.yml` 中 Windows 归档步骤的误失败问题。
- `robocopy` 在成功复制时也可能返回 `1`（表示 copied files），此前 workflow 虽然放行了 `<= 7` 的结果，但没有在继续执行前重置 `LASTEXITCODE`，导致 step 最终以 `exit code 1` 结束。
- 现在在 `robocopy` 成功分支后显式将 `$global:LASTEXITCODE = 0`，避免 PowerShell 将 Windows 归档步骤误判为失败。

## 测试/验证/验收方式

- 已完成一次 GitHub 验证定位：
  - `desktop-release.yml`
  - run: `23199885011`
  - 结论：`Smoke Desktop (Windows)` 已通过，新的唯一失败点为 `Archive desktop artifacts (Windows)` 的退出码误判。
- 本次修复后的验收方式：
  - 推送后使用新的 desktop tag 重新触发 `desktop-release.yml`
  - 观察点：
    - `desktop-win32-x64` 的 `Archive desktop artifacts (Windows)` 通过
    - `publish-release-assets` 不再被跳过

## 发布/部署方式

- 提交 workflow 修复到 `master`
- 推送后创建新的 desktop release tag
- 触发 GitHub Actions `desktop-release.yml`
- 验证 Windows/macOS/Linux 全部完成，并确认 release 资产上传

## 用户/产品视角的验收步骤

1. 运行新的 desktop release workflow。
2. 确认 Windows 任务已通过 `Smoke Desktop (Windows)` 与 `Archive desktop artifacts (Windows)`。
3. 确认 workflow 最终进入 `publish-release-assets`，并将 Windows zip、macOS dmg/zip、Linux AppImage 上传到对应 release。
4. 下载 Windows release zip，确认可正常解压并包含 `NextClaw Desktop.exe`。
