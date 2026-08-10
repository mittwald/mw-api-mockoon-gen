import { readFileSync, writeFileSync } from "node:fs";

type JsonObject = Record<string, unknown>;

type OverlayAction = {
  target: string;
  update: unknown;
  description: string;
};

type DefaultPatchRule = {
  fieldName: string;
  defaultValue: unknown;
  description: string;
};

function getArg(flag: string, fallback = ""): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function quoteJsonPathKey(key: string): string {
  return `["${key.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}"]`;
}

const defaultPatchRules: DefaultPatchRule[] = [
  {
    fieldName: "internalversion",
    defaultValue: "1.0.0",
    description: "Help generator as no format is given for plain string"
  },
  {
    fieldName: "isdefault",
    defaultValue: true,
    description: "Help validators to work with mock data"
  },
  {
    fieldName: "desired",
    defaultValue: "00000000-0000-4000-8000-000000000000",
    description: "Help api client! With this being undefined, api client cant handle path arguments correctly and might even call list endpoints!"
  },
  {
    fieldName: "servicename",
    defaultValue: "00000000-0000-4000-8000-000000000000",
    description: "Help list services to return actionable data. Defaulting this field felt more sensible than touch id fields"
  },
  {
    fieldName: "id",
    defaultValue: "00000000-0000-4000-8000-000000000000",
    description: "ID fields missing format. Selector is much too broad though."
  },
  {
    fieldName: "name",
    defaultValue: "node",
    description: "Name field example for app installations. Selector is much too broad though."
  },
  {
    fieldName: "mainUser",
    defaultValue: true,
    description: "Pin main user to true for mock data. Database stuff. Collides with deletion."
  },
  {
    fieldName: "downloadURL",
    defaultValue: "https://example.com",
    description: "Provide example download URL for backup download."
  },
];

function main() {
  const input = getArg("--input");
  const output = getArg("--output");
  const title = getArg("--title", "Overlay: Add defaults for selected fields");

  if (!input || !output) {
    console.error(
      "Usage: tsx generate-field-defaults-overlay.ts --input in.json --output out.overlay.json"
    );
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(input, "utf8")) as unknown;
  const actions: OverlayAction[] = [];

  function walk(node: unknown, path: string): void {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => {
        walk(entry, `${path}[${index}]`);
      });
      return;
    }

    if (!isObject(node)) {
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      const keyPath = `${path}${quoteJsonPathKey(key)}`;

      const matchedRule = defaultPatchRules.find(
        (rule) => key.toLowerCase() === rule.fieldName.toLowerCase()
      );

      if (matchedRule && isObject(value)) {
        const nextSchema: JsonObject = {
          ...value,
          example: matchedRule.defaultValue
        };

        actions.push({
          target: keyPath,
          update: nextSchema,
          description: matchedRule.description
        });
      }

      walk(value, keyPath);
    }
  }

  walk(spec, "$");

  const overlay = {
    overlay: "1.1.0",
    info: {
      title,
      version: "1.0.0",
      description: "Adds default values to configured OpenAPI schema fields."
    },
    actions
  };

  writeFileSync(output, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  console.log(`Overlay written to ${output}: ${actions.length} actions`);
}

main();
