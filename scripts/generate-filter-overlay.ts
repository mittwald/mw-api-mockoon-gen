import { readFileSync, writeFileSync } from "node:fs";

type JsonObject = Record<string, unknown>;

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

function getArg(flag: string, fallback = ""): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

function parseCsv(input: string): Set<string> {
  return new Set(input.split(",").map((value) => value.trim()).filter(Boolean));
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

function matchesTags(op: JsonObject, allowedTags: Set<string>, essentialTags: Set<string>): boolean {
  const rawTags = op.tags;
  const tags = Array.isArray(rawTags) ? rawTags.filter((value): value is string => typeof value === "string") : [];
  return tags.some((tag) => allowedTags.has(tag) || essentialTags.has(tag));
}

function main() {
  const input = getArg("--input");
  const output = getArg("--output");
  const title = getArg("--title", "Overlay: Remove deprecated and unwanted operations");
  const allowedTags = parseCsv(getArg("--tags", ""));
  const essentialTags = parseCsv(getArg("--essential-tags", "User"));
  const tagFilterActive = allowedTags.size > 0;

  if (!input || !output) {
    console.error("Usage: tsx generate-filter-overlay.ts --input in.json --output out.overlay.json [--tags A,B] [--essential-tags User]");
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
        continue;
      }

      if (tagFilterActive && !matchesTags(operation, allowedTags, essentialTags)) {
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
      description: "Removed operation: deprecated or does not match tag filter"
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
      description: "Removes deprecated operations and optionally non-matching tag operations, then removes empty paths."
    },
    actions
  };

  writeFileSync(output, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  console.log(`Overlay written to ${output}: ${actions.length} actions`);
}

main();
