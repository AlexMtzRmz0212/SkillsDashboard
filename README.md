# Skills Dashboard

A Windows desktop app that lists every Claude skill on this machine in one place, and lets you read, edit, link and pack them.

## What it shows

| Source | Folder | Editable |
|---|---|---|
| claude.ai account | `~/.claude/skills/synced/<account>/` (the copies Claude syncs from your account) | No. Edit these on claude.ai |
| Claude Code | `~/.claude/skills/` | Yes |
| Agents | `~/.agents/skills/` | Yes |
| Plugins | `~/.claude/plugins/marketplaces/**/skills/` | No. Marketplace updates replace them |

A junction in `~/.claude/skills` that points into `~/.agents/skills` appears once, on the agents skill, marked "Linked to Claude". The list updates on its own when files in `~/.claude/skills` or `~/.agents/skills` change.

## Features

- Search names and descriptions (`Ctrl K`), filter by source, "not linked" or "has warnings"; use the arrow keys to move through the list.
- **Groups**: make your own groups (sidebar **Groups +**) and add a skill to any number of them from its detail pane. Click a group to filter by it, or click **Ungrouped** to see skills in no group. Double-click a group to rename it. Groups are saved in the app's data folder (`%APPDATA%\Skills Dashboard\groups.json`), never in skill folders.
- **Same name, different places**: list rows get a copies badge (for example `2`). The detail pane lists the other locations, says whether each copy is identical, has the same SKILL.md but different files, or has a different SKILL.md (newer or older), and lets you jump to it. The **Same name elsewhere** filter shows only these skills.
- **skills.sh install counts**: click **Fetch** / **Refresh** under *skills.sh installs* in the sidebar. Counts show on list rows, in the detail pane (click the badge to open the skill on skills.sh), and with **Sort → Installs**. A skill's source repo comes from `~/.agents/.skill-lock.json` and `~/.claude/skills/skills-lock.json`, so claude.ai account and plugin skills have no count. Counts are cached in `%APPDATA%\Skills Dashboard\installs.json` and only fetched when you ask. They come from `https://skills.sh/api/search`, the undocumented endpoint the `skills` CLI uses, so it may change.
- **Preview**: the frontmatter as a table, then the rendered SKILL.md.
- **Files**: the skill's folder tree with a preview of each file.
- **Edit**: edit any text file in the skill, save with `Ctrl S`. Writes stay inside the skill folder and only go to `~/.claude/skills` or `~/.agents/skills`.
- **Link to Claude**: for agents skills that aren't linked yet, runs `~/.claude/skills/link/scripts/link-skills.ps1 -Name <skill>`.
- **Pack for claude.ai**: runs `~/.claude/skills/send-to-chat/scripts/pack-skill.ps1 -Name <skill> -Reveal`, which writes `~/Downloads/skill-zips/<skill>.zip` for upload at claude.ai → Settings → Capabilities → Skills.
- Warnings for problems claude.ai rejects on upload: missing or badly formed `name`, `name` not matching the folder, `description` longer than 1024 characters, frontmatter that isn't valid YAML.

The Link and Pack buttons appear only when those two scripts exist.

## Develop

```bash
npm install
npm run dev
```

npm 11 blocks install scripts by default. `package.json` already allows the ones esbuild and electron-winstaller need. Electron downloads its own binary the first time it runs.

## Build the installer

```bash
npm run dist
```

This typechecks, bundles, and writes `dist/Skills Dashboard Setup <version>.exe`, an NSIS installer that installs per user and adds Start menu and desktop shortcuts. The installer is not code-signed, so Windows SmartScreen will warn the first time you run it.

## Layout

```
src/main/       Electron main process: scanner.ts (finds skills), actions.ts (read/save/link/pack/open), watcher.ts
src/preload/    the window.api bridge
src/shared/     types shared by main and renderer
src/renderer/   React UI
build/icon.png  app icon (electron-builder converts it to .ico)
```
