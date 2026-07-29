import { readFileSync, writeFileSync } from "node:fs";

type JsonObject = Record<string, unknown>;

function getArg(flag: string, fallback = ""): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function esc(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}

function propBase(schemaName: string, propName: string): string {
  return `$.components.schemas["${esc(schemaName)}"].properties["${esc(propName)}"]`;
}

function main() {
  const input = getArg("--input");
  const output = getArg("--output");
  const title = getArg("--title", "Unroll Recursion Overlay");

  if (!input || !output) {
    console.error("Usage: tsx generate-unroll-overlay.ts --input in.json --output out.overlay.json");
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(input, "utf8")) as JsonObject;
  const components = isObject(spec.components) ? spec.components : {};
  const schemas = isObject(components.schemas) ? components.schemas : {};

  const actions: Array<Record<string, unknown>> = [];

  for (const [schemaName, schemaRaw] of Object.entries(schemas)) {
    if (!isObject(schemaRaw)) {
      continue;
    }

    const props = isObject(schemaRaw.properties) ? schemaRaw.properties : {};

    for (const [propName, propRaw] of Object.entries(props)) {
      if (!isObject(propRaw)) {
        continue;
      }

      const selfRef = `#/components/schemas/${schemaName}`;
      const base = propBase(schemaName, propName);

      const items = propRaw.items;
      const isArraySelfRef =
        propRaw.type === "array" && isObject(items) && items.$ref === selfRef;

      if (isArraySelfRef) {
        const inlinedProps: JsonObject = {};
        for (const [k, v] of Object.entries(props)) {
          if (k !== propName) {
            inlinedProps[k] = clone(v);
          }
        }

        actions.push({ target: `${base}.items["$ref"]`, remove: true });
        actions.push({
          target: `${base}.items`,
          update: {
            type: "object",
            properties: inlinedProps,
            "x-unrolled": true
          }
        });
      }

      const isDirectSelfRef = propRaw.$ref === selfRef;
      if (isDirectSelfRef) {
        const inlinedProps: JsonObject = {};
        for (const [k, v] of Object.entries(props)) {
          if (k !== propName) {
            inlinedProps[k] = clone(v);
          }
        }

        actions.push({ target: `${base}["$ref"]`, remove: true });
        actions.push({
          target: base,
          update: {
            type: "object",
            properties: inlinedProps,
            "x-unrolled": true
          }
        });
      }
    }
  }

  const overlay = {
    overlay: "1.0.0",
    info: {
      title,
      version: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      description: "Unroll direct and array self-recursion by replacing self references with inline schema shape."
    },
    actions
  };

  writeFileSync(output, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  console.log(`Overlay written to ${output}: ${actions.length} actions`);
}

main();
