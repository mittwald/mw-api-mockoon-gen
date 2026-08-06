import { readFileSync, writeFileSync } from "node:fs";

type JsonObject = Record<string, unknown>;

type OverlayAction = {
  target: string;
  update: unknown;
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

function main() {
  const input = getArg("--input");
  const output = getArg("--output");
  const title = getArg("--title", "Overlay: Add example for internalversion fields");

  if (!input || !output) {
    console.error(
      "Usage: tsx generate-internalversion-example-overlay.ts --input in.json --output out.overlay.json"
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

      if (key.toLowerCase() === "internalversion" && isObject(value)) {
        const nextSchema: JsonObject = {
          ...value,
          example: "1.0.0"
        };

        actions.push({
          target: keyPath,
          update: nextSchema,
          description: "Ensure internalversion contains a stable string example"
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
      description: "Adds example: 1.0.0 to every field named internalversion."
    },
    actions
  };

  writeFileSync(output, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  console.log(`Overlay written to ${output}: ${actions.length} actions`);
}

main();
