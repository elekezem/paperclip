export const DARWIN_BUNDLED_CODEX_COMMAND = "/Applications/Codex.app/Contents/Resources/codex";

type ResolveCodexCommandOptions = {
  platform?: NodeJS.Platform;
  bundledCodexExists?: boolean;
};

export function resolveCodexCommand(
  configuredCommand: unknown,
  options: ResolveCodexCommandOptions = {},
): string {
  const command =
    typeof configuredCommand === "string" && configuredCommand.trim().length > 0
      ? configuredCommand.trim()
      : "codex";

  if (command !== "codex") return command;

  const platform = options.platform ?? process.platform;
  const bundledCodexExists = options.bundledCodexExists ?? false;
  if (platform !== "darwin" || !bundledCodexExists) return command;

  return DARWIN_BUNDLED_CODEX_COMMAND;
}
