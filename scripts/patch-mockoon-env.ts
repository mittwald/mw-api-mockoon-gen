import { readFileSync, writeFileSync } from "node:fs";

function getArg(flag: string): string {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : "";
}

// XXX: check if this is still needed.
function patchString(value: string): string {
  let out = value;

  out = out.replaceAll(
    "{{faker 'date.recent' 365}}",
    "{{dateFormat (faker 'date.recent' 365) 'yyyy-MM-dd'}}"
  );

  const intEnumPattern = /\\\\\"\\\{\\\{oneOf \\\(array ((?:'[0-9]+'\\s*)+)\\\)\\\}\\\}\\\\\"/g;
  out = out.replace(intEnumPattern, (_match, values: string) => {
    const numbers = values
      .trim()
      .split(/\s+/)
      .map((v) => v.replaceAll("'", ""));
    return `{{oneOf (array ${numbers.join(" ")})}}`;
  });

  return out;
}

function deepPatch(node: unknown): unknown {
  if (typeof node === "string") {
    return patchString(node);
  }

  if (Array.isArray(node)) {
    return node.map((entry) => deepPatch(entry));
  }

  if (node && typeof node === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = deepPatch(value);
    }
    return result;
  }

  return node;
}

function main() {
  const input = getArg("--input");
  const output = getArg("--output");

  if (!input || !output) {
    console.error("Usage: tsx patch-mockoon-env.ts --input mockoon_env.json --output mockoon-env-patched.json");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(input, "utf8")) as unknown;
  const patched = deepPatch(data);

  writeFileSync(output, `${JSON.stringify(patched, null, 2)}\n`, "utf8");
  console.log(`Patched Mockoon environment written to ${output}`);
}

main();
