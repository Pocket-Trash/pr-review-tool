import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("skill installer uses the locked CLI and copies skills from pinned checkouts", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "review-skills-fixture-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of ["src", "scripts", "skills", "bin"])
    mkdirSync(join(directory, name));
  writeFileSync(
    join(directory, "bin/package.json"),
    JSON.stringify({ type: "commonjs" }),
  );
  cpSync("src", join(directory, "src"), { recursive: true });
  cpSync(
    "scripts/install-skills.mjs",
    join(directory, "scripts/install-skills.mjs"),
  );
  cpSync("package.json", join(directory, "package.json"));
  cpSync("skills/manifest.json", join(directory, "skills/manifest.json"));
  writeFileSync(
    join(directory, "bin/git"),
    `#!${process.execPath}
const fs=require("node:fs");if(process.argv.includes("init"))fs.mkdirSync(process.argv.at(-1),{recursive:true});
`,
    {
      mode: 0o755,
    },
  );
  writeFileSync(
    join(directory, "bin/pnpm"),
    `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2);
if(args[0]!=='exec'||args[1]!=='skills'||args[2]!=='add')throw new Error('Unpinned installer');
for(const name of args.slice(args.indexOf('--skill')+1,args.indexOf('--copy'))){const target=path.join('.agents/skills',name);fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'SKILL.md'),name);}
`,
    { mode: 0o755 },
  );
  const result = spawnSync(
    process.execPath,
    [resolve(directory, "scripts/install-skills.mjs")],
    {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, PATH: join(directory, "bin") },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(
    readFileSync(join(directory, "skills/install-status.json")),
  );
  assert.deepEqual(status.failures, [], result.stderr);
  const manifest = JSON.parse(readFileSync("skills/manifest.json"));
  for (const source of manifest.sources)
    for (const skill of source.skills)
      assert.equal(
        readFileSync(join(directory, "skills", skill.name, "SKILL.md"), "utf8"),
        skill.name,
      );
});
