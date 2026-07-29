import { readFileSync, writeFileSync } from "node:fs";

type JsonObject = Record<string, unknown>;

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

function getArg(flag: string, fallback = ""): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

function toPathSelector(pathValue: string, method?: string): string {
  return method ? `$.paths['${pathValue}'].${method}` : `$.paths['${pathValue}']`;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function isDeprecated(op: JsonObject): boolean {
  return op.deprecated === true;
}

function main() {
  const input = getArg("--input");
  const output = getArg("--output");
  const title = "Overlay: Remove deprecated operations";

  if (!input || !output) {
    console.error("Usage: tsx generate-filter-overlay.ts --input in.json --output out.overlay.json");
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(input, "utf8")) as JsonObject;
  const rawPaths = spec.paths;
  const paths = isObject(rawPaths) ? rawPaths : {};

  const removedOps: string[] = [];

  for (const [pathValue, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = method.toLowerCase();
      if (!HTTP_METHODS.has(normalizedMethod) || !isObject(operation)) {
        continue;
      }

      if (isDeprecated(operation)) {
        removedOps.push(toPathSelector(pathValue, method));
      }
    }
  }

  const removedSet = new Set(removedOps);
  const removedPaths: string[] = [];

  for (const [pathValue, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) {
      continue;
    }

    let totalOps = 0;
    let removedCount = 0;

    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }
      totalOps += 1;
      if (removedSet.has(toPathSelector(pathValue, method))) {
        removedCount += 1;
      }
    }

    if (totalOps > 0 && totalOps === removedCount) {
      removedPaths.push(toPathSelector(pathValue));
    }
  }

  const actions = [
    ...removedOps.map((target) => ({
      target,
      remove: true,
      description: "Removed deprecated operation"
    })),
    ...removedPaths.map((target) => ({
      target,
      remove: true,
      description: "Remove empty path"
    }))
  ];

  const overlay = {
    overlay: "1.1.0",
    info: {
      title,
      version: "1.0.0",
      description: "Removes deprecated operations, then removes empty paths."
    },
    actions
  };

  writeFileSync(output, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  console.log(`Overlay written to ${output}: ${actions.length} actions`);
}

main();
