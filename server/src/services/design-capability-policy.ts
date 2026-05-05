import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DesignCapabilityProfile } from "@paperclipai/shared";

type DesignCapabilityPolicy = {
  version: string;
  capability_packages: Record<string, {
    profile: DesignCapabilityProfile;
    skill_keys: string[];
  }>;
  future_defaults: Record<DesignCapabilityProfile, string[]>;
};

const FALLBACK_POLICY: DesignCapabilityPolicy = {
  version: "ZanweiDesignCapabilityPolicyV1",
  capability_packages: {
    design_builder: {
      profile: "builder",
      skill_keys: [
        "zanwei/design-dna/design-dna",
        "open-design/web-prototype",
        "open-design/critique",
      ],
    },
    design_verifier: {
      profile: "verifier",
      skill_keys: [
        "zanwei/harness-design/harness-design",
        "open-design/critique",
      ],
    },
    open_design_prototype: {
      profile: "builder",
      skill_keys: [
        "open-design/web-prototype",
        "open-design/dashboard",
        "open-design/mobile-app",
        "open-design/wireframe-sketch",
      ],
    },
    open_design_deck_report: {
      profile: "builder",
      skill_keys: [
        "open-design/html-ppt",
        "open-design/simple-deck",
      ],
    },
    open_design_refinement: {
      profile: "builder",
      skill_keys: ["open-design/tweaks"],
    },
    open_design_motion: {
      profile: "builder",
      skill_keys: ["open-design/hyperframes"],
    },
    open_design_review: {
      profile: "verifier",
      skill_keys: ["open-design/critique"],
    },
  },
  future_defaults: {
    builder: [
      "zanwei/design-dna/design-dna",
      "open-design/web-prototype",
      "open-design/critique",
    ],
    verifier: [
      "zanwei/harness-design/harness-design",
      "open-design/critique",
    ],
    none: [],
  },
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const policyPathCandidates = [
  path.resolve(process.cwd(), "workspace/.cto/policies/zanwei-design-capability-policy.json"),
  path.resolve(moduleDir, "../../../../../workspace/.cto/policies/zanwei-design-capability-policy.json"),
];

let cachedPolicy: DesignCapabilityPolicy | null = null;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function parsePolicy(value: unknown): DesignCapabilityPolicy | null {
  if (!isPlainRecord(value)) return null;
  const futureDefaultsRaw = value.future_defaults;
  const capabilityPackagesRaw = value.capability_packages;
  if (!isPlainRecord(futureDefaultsRaw) || !isPlainRecord(capabilityPackagesRaw)) return null;

  const capabilityPackages: DesignCapabilityPolicy["capability_packages"] = {};
  for (const [name, rawPackage] of Object.entries(capabilityPackagesRaw)) {
    if (!isPlainRecord(rawPackage)) return null;
    const profile = rawPackage.profile;
    if (profile !== "builder" && profile !== "verifier" && profile !== "none") return null;
    capabilityPackages[name] = {
      profile,
      skill_keys: asStringArray(rawPackage.skill_keys),
    };
  }

  return {
    version: typeof value.version === "string" ? value.version : FALLBACK_POLICY.version,
    capability_packages: capabilityPackages,
    future_defaults: {
      builder: asStringArray(futureDefaultsRaw.builder),
      verifier: asStringArray(futureDefaultsRaw.verifier),
      none: asStringArray(futureDefaultsRaw.none),
    },
  };
}

export function loadDesignCapabilityPolicy(): DesignCapabilityPolicy {
  if (cachedPolicy) return cachedPolicy;

  for (const candidate of policyPathCandidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = parsePolicy(JSON.parse(fs.readFileSync(candidate, "utf8")));
      if (parsed) {
        cachedPolicy = parsed;
        return cachedPolicy;
      }
    } catch {
      // Fall through to the next candidate, then finally to fallback defaults.
    }
  }

  cachedPolicy = FALLBACK_POLICY;
  return cachedPolicy;
}

export function readDesignCapabilityProfile(metadata: unknown): DesignCapabilityProfile | null {
  if (!isPlainRecord(metadata)) return null;
  const profile = metadata.designCapabilityProfile;
  if (profile === "builder" || profile === "verifier" || profile === "none") {
    return profile;
  }
  return null;
}

export function resolveDesignCapabilityDefaultSkillKeys(
  profile: DesignCapabilityProfile | null,
  adapterType: string,
): string[] {
  if (!profile || profile === "none" || adapterType === "openclaw_gateway") {
    return [];
  }
  const policy = loadDesignCapabilityPolicy();
  return Array.from(new Set(policy.future_defaults[profile] ?? []));
}
