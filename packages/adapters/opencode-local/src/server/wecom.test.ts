import { describe, expect, it } from "vitest";
import {
  buildPaperclipWeComSkillKey,
  listPaperclipWeComSkillKeys,
  resolveWeComCliDirectories,
} from "./wecom.js";

describe("opencode wecom helpers", () => {
  it("lists the bundled Paperclip WeCom skill keys", () => {
    expect(listPaperclipWeComSkillKeys()).toEqual([
      "paperclipai/paperclip/wecomcli-contact",
      "paperclipai/paperclip/wecomcli-todo",
      "paperclipai/paperclip/wecomcli-meeting",
      "paperclipai/paperclip/wecomcli-msg",
      "paperclipai/paperclip/wecomcli-schedule",
      "paperclipai/paperclip/wecomcli-doc",
    ]);
    expect(buildPaperclipWeComSkillKey("wecomcli-msg")).toBe("paperclipai/paperclip/wecomcli-msg");
  });

  it("builds company-scoped WeCom CLI directories from the Paperclip env", () => {
    const alpha = resolveWeComCliDirectories("company-alpha", {
      HOME: "/Users/tester",
      PAPERCLIP_HOME: "/tmp/paperclip-home",
      PAPERCLIP_INSTANCE_ID: "staging",
    });
    const beta = resolveWeComCliDirectories("company-beta", {
      HOME: "/Users/tester",
      PAPERCLIP_HOME: "/tmp/paperclip-home",
      PAPERCLIP_INSTANCE_ID: "staging",
    });

    expect(alpha.instanceRoot).toBe("/tmp/paperclip-home/instances/staging");
    expect(alpha.configDir).toBe("/tmp/paperclip-home/instances/staging/wecom/company-alpha/config");
    expect(alpha.tmpDir).toBe("/tmp/paperclip-home/instances/staging/wecom/company-alpha/tmp");
    expect(beta.configDir).toBe("/tmp/paperclip-home/instances/staging/wecom/company-beta/config");
    expect(alpha.configDir).not.toBe(beta.configDir);
  });
});
