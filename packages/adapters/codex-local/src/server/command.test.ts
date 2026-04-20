import { describe, expect, it } from "vitest";
import {
  DARWIN_BUNDLED_CODEX_COMMAND,
  resolveCodexCommand,
} from "./command.js";

describe("resolveCodexCommand", () => {
  it("uses the bundled macOS Codex binary for the default command", () => {
    expect(
      resolveCodexCommand(undefined, {
        platform: "darwin",
        bundledCodexExists: true,
      }),
    ).toBe(DARWIN_BUNDLED_CODEX_COMMAND);
  });

  it("keeps an explicit command override untouched", () => {
    expect(
      resolveCodexCommand("/custom/bin/codex", {
        platform: "darwin",
        bundledCodexExists: true,
      }),
    ).toBe("/custom/bin/codex");
  });

  it("falls back to plain codex when the bundled binary is unavailable", () => {
    expect(
      resolveCodexCommand(undefined, {
        platform: "darwin",
        bundledCodexExists: false,
      }),
    ).toBe("codex");
  });
});
