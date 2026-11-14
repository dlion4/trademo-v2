const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const cache = new Map();

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  function resolve(id) {
    if (id.startsWith("@/")) {
      const aliasedFile = `src/${id.slice(2)}.ts`;
      return load(fs.existsSync(aliasedFile) ? aliasedFile : `src/${id.slice(2)}/index.ts`);
    }
    if (id.startsWith("./")) return load(path.join(path.dirname(file), `${id}.ts`));
    return require(id);
  }
  new Function("exports", "require", "module", source)(mod.exports, resolve, mod);
  cache.set(file, mod.exports);
  return mod.exports;
}

test("waitlist uses a process-local mock store without a database URL", async () => {
  delete process.env.DATABASE_URL;
  const { joinWaitlist } = load("src/server/services/waitlist-service.ts");
  const email = `mock-${Date.now()}@example.test`;

  const first = await joinWaitlist({ email, role: "investor" });
  const duplicate = await joinWaitlist({ email, role: "investor" });

  assert.equal(first.position, 1);
  assert.match(first.message, /stored in memory/);
  assert.equal(duplicate.id, "already-registered");
  assert.equal(duplicate.position, first.position);
  assert.match(duplicate.message, /already on the demo waitlist/);
});
