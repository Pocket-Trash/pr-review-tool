import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const workspacePolicy = await readFile("pnpm-workspace.yaml", "utf8");
test("rejects a fresh exact external dependency", async (t) => {
  const publishedAt = new Date().toISOString();
  const registry = await startRegistry(t, {
    "external-package": { publishedAt },
  });

  const result = await installFixture(t, registry, {
    "external-package": "1.0.0",
  });

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /ERR_PNPM_NO_MATURE_MATCHING_VERSION/);
});

test("rejects an external dependency without a publication timestamp", async (t) => {
  const registry = await startRegistry(t, {
    "external-package": {},
  });

  const result = await installFixture(t, registry, {
    "external-package": "1.0.0",
  });

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /ERR_PNPM_MISSING_TIME/);
});

test("accepts only the named internal packages without timestamps", async (t) => {
  const dependencies = {
    "@pocket-trash/cli": "1.0.0",
    "@pocket-trash/localizations": "1.0.0",
    "@pocket-trash/skills": "1.0.0",
  };
  const registry = await startRegistry(
    t,
    Object.fromEntries(Object.keys(dependencies).map((name) => [name, {}])),
  );

  const result = await installFixture(t, registry, dependencies);

  assert.equal(result.code, 0, result.output);
});

test("rejects a fresh transitive dependency of an exempt internal package", async (t) => {
  const registry = await startRegistry(t, {
    "@pocket-trash/cli": { dependencies: { "external-package": "1.0.0" } },
    "external-package": { publishedAt: new Date().toISOString() },
  });
  const result = await installFixture(t, registry, {
    "@pocket-trash/cli": "1.0.0",
  });
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /ERR_PNPM_NO_MATURE_MATCHING_VERSION/);
});

test("accepts an exact reviewed age exception", async (t) => {
  const registry = await startRegistry(t, {
    "external-package": { publishedAt: new Date().toISOString() },
  });

  const result = await installFixture(
    t,
    registry,
    { "external-package": "1.0.0" },
    { ageException: "external-package@1.0.0" },
  );

  assert.equal(result.code, 0, result.output);
});

test("revalidates committed lockfiles against the current policy", async (t) => {
  const registry = await startRegistry(t, {
    "external-package": { publishedAt: new Date().toISOString() },
  });
  const seeded = await installFixture(
    t,
    registry,
    { "external-package": "1.0.0" },
    { ageException: "external-package@1.0.0" },
  );
  assert.equal(seeded.code, 0, seeded.output);

  await writeFile(
    path.join(seeded.directory, "pnpm-workspace.yaml"),
    workspacePolicy,
  );
  const result = await run(
    "pnpm",
    [
      "install",
      "--frozen-lockfile",
      "--lockfile-only",
      "--ignore-scripts",
      "--reporter=append-only",
      `--registry=${registry}`,
      `--store-dir=${path.join(seeded.directory, ".pnpm-store")}`,
    ],
    seeded.directory,
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION/);
});

test("provides the locked skills executable", async () => {
  const result = await run(
    "pnpm",
    ["exec", "skills", "--version"],
    process.cwd(),
  );

  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /1\.7\.2/);
});

test("blocks artifacts for a high-severity development advisory", async (t) => {
  await assertAuditBlocksArtifact(
    t,
    vulnerableAudit,
    200,
    /fixture development advisory/i,
  );
});

test("blocks artifacts when the advisory service is unavailable", async (t) => {
  await assertAuditBlocksArtifact(
    t,
    { error: "unavailable" },
    503,
    /503|audit.*response/i,
  );
});

async function assertAuditBlocksArtifact(t, audit, status, outputPattern) {
  const registry = await startAuditRegistry(t, audit, status);
  const directory = await mkdtemp(path.join(tmpdir(), "pnpm-security-gate-"));
  const artifact = path.join(directory, "artifact.txt");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const result = await run(
    "sh",
    [
      "-c",
      'pnpm run security:audit && node -e \'require("node:fs").writeFileSync(process.env.SECURITY_ARTIFACT, "built")\'',
    ],
    process.cwd(),
    {
      PNPM_CONFIG_FETCH_RETRIES: "0",
      PNPM_CONFIG_REGISTRY: registry,
      SECURITY_ARTIFACT: artifact,
    },
  );

  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, outputPattern);
  await assert.rejects(stat(artifact), { code: "ENOENT" });
}

async function installFixture(
  t,
  registry,
  dependencies,
  { ageException } = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), "pnpm-security-policy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const policy = ageException
    ? workspacePolicy.replace(
        "minimumReleaseAgeExclude:\n",
        `minimumReleaseAgeExclude:\n  - "${ageException}"\n`,
      )
    : workspacePolicy;

  await Promise.all([
    writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ name: "security-policy-fixture", dependencies }),
    ),
    writeFile(path.join(directory, "pnpm-workspace.yaml"), policy),
  ]);

  return {
    ...(await run(
      "pnpm",
      [
        "install",
        "--lockfile-only",
        "--ignore-scripts",
        "--reporter=append-only",
        `--registry=${registry}`,
        `--store-dir=${path.join(directory, ".pnpm-store")}`,
      ],
      directory,
    )),
    directory,
  };
}

async function startRegistry(t, packages) {
  const server = createServer((request, response) => {
    const name = decodeURIComponent(request.url.slice(1));
    const entry = packages[name];

    if (!entry) {
      response.writeHead(404).end();
      return;
    }

    const registry = `http://127.0.0.1:${server.address().port}`;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        name,
        "dist-tags": { latest: "1.0.0" },
        versions: {
          "1.0.0": {
            name,
            version: "1.0.0",
            dependencies: entry.dependencies,
            dist: {
              integrity:
                "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
              tarball: `${registry}/${name}/-/package-1.0.0.tgz`,
            },
          },
        },
        time: entry.publishedAt ? { "1.0.0": entry.publishedAt } : undefined,
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );

  return `http://127.0.0.1:${server.address().port}`;
}

async function startAuditRegistry(t, audit, status = 200) {
  const server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(404).end();
      return;
    }

    request.resume();
    request.on("end", () => {
      response.setHeader("content-type", "application/json");
      response.statusCode = status;
      response.end(JSON.stringify(audit));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );

  return `http://127.0.0.1:${server.address().port}`;
}

function run(command, args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env, CI: "true" },
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("close", (code) => resolve({ code, output }));
  });
}

const vulnerableAudit = {
  auditReportVersion: 2,
  vulnerabilities: {
    typescript: {
      name: "typescript",
      severity: "high",
      isDirect: true,
      via: [
        {
          source: 999999,
          name: "typescript",
          dependency: "typescript",
          title: "Fixture development advisory",
          url: "https://example.invalid/advisory",
          severity: "high",
          range: "*",
        },
      ],
      effects: [],
      range: "*",
      nodes: ["node_modules/typescript"],
      fixAvailable: false,
    },
  },
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 1,
      critical: 0,
      total: 1,
    },
    dependencies: {
      prod: 0,
      dev: 1,
      optional: 0,
      peer: 0,
      peerOptional: 0,
      total: 1,
    },
  },
};
