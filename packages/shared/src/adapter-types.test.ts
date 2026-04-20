import { describe, expect, it } from "vitest";
import { acceptInviteSchema, createAgentSchema, updateAgentSchema } from "./index.js";

describe("dynamic adapter type validation schemas", () => {
  it("accepts external adapter types in create/update agent schemas", () => {
    expect(
      createAgentSchema.parse({
        name: "External Agent",
        adapterType: "external_adapter",
      }).adapterType,
    ).toBe("external_adapter");

    expect(
      updateAgentSchema.parse({
        adapterType: "external_adapter",
      }).adapterType,
    ).toBe("external_adapter");
  });

  it("still rejects blank adapter types", () => {
    expect(() =>
      createAgentSchema.parse({
        name: "Blank Adapter",
        adapterType: "   ",
      }),
    ).toThrow();
  });

  it("accepts external adapter types in invite acceptance schema", () => {
    expect(
      acceptInviteSchema.parse({
        requestType: "agent",
        agentName: "External Joiner",
        adapterType: "external_adapter",
      }).adapterType,
    ).toBe("external_adapter");
  });

  it("accepts the design capability profile metadata contract", () => {
    expect(
      createAgentSchema.parse({
        name: "Design Builder",
        adapterType: "claude_local",
        metadata: {
          designCapabilityProfile: "builder",
        },
      }).metadata,
    ).toEqual({ designCapabilityProfile: "builder" });
  });

  it("rejects unknown design capability profile metadata values", () => {
    expect(() =>
      createAgentSchema.parse({
        name: "Broken Designer",
        adapterType: "claude_local",
        metadata: {
          designCapabilityProfile: "visual-polisher",
        },
      }),
    ).toThrow("metadata.designCapabilityProfile must be one of builder, verifier, or none");
  });
});
