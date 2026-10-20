import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetTotal,
  startEvaluationProxy,
  reconcileInterruptedEvaluation,
  evaluationReservation,
} from "../src/evaluation-budget.mjs";

const model = {
  id: "model",
  contextLength: 100000,
  inputPerMillionUsd: 1,
  outputPerMillionUsd: 2,
};

test("interrupted billing reconciles by generation receipt without replaying its session", async () => {
  const ledger = {
    requests: [
      { generationId: "gen-1", status: "in-progress", reservedUsd: 0.2 },
    ],
    sessions: [{ id: "paid-session", status: "in-progress" }],
  };
  await reconcileInterruptedEvaluation(ledger, async () => ({
    id: "gen-1",
    total_cost: 0.03,
    cancelled: true,
    finish_reason: null,
  }));
  assert.equal(budgetTotal(ledger.requests), 0.03);
  assert.equal(ledger.sessions[0].status, "interrupted");
  assert.equal(ledger.requests[0].reconciliation.priorStatus, "in-progress");
  for (const changes of [{ generationId: undefined }, { reservedUsd: 0.01 }]) {
    const incomplete = {
      requests: [
        {
          generationId: "gen-1",
          status: "in-progress",
          reservedUsd: 0.2,
          ...changes,
        },
      ],
      sessions: [],
    };
    await assert.rejects(
      reconcileInterruptedEvaluation(incomplete, async () => ({
        id: "gen-1",
        total_cost: 0.03,
        cancelled: true,
      })),
      /reservation|billing/,
    );
    assert.equal(incomplete.requests[0].status, "in-progress");
  }
});
async function harness(fetchImpl, budgetUsd = 1, limits = {}) {
  const ledger = { budgetUsd, requests: [] };
  let checkpoints = 0;
  const proxy = await startEvaluationProxy({
    apiKey: "real-secret",
    models: [{ ...model, ...limits }],
    ledger,
    checkpoint: async () => {
      checkpoints++;
    },
    fetchImpl,
  });
  proxy.session = "session-1";
  const request = (changes = {}) =>
    fetch(`${proxy.baseURL}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${proxy.token}` },
      body: JSON.stringify({
        model: "model",
        messages: [],
        max_tokens: 1000,
        ...changes,
      }),
    });
  return { proxy, ledger, request, checkpoints: () => checkpoints };
}
test("request proxy reserves durably, caps price/output, and accounts actual cost", async () => {
  const h = await harness(async (url, options) => {
    assert.ok(h.checkpoints() >= 1);
    assert.equal(options.headers.authorization, "Bearer real-secret");
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 1000);
    assert.deepEqual(body.provider.max_price, { prompt: 1, completion: 2 });
    return new Response(
      JSON.stringify({ id: "generation", usage: { cost: 0.01 } }),
      { headers: { "content-type": "application/json" } },
    );
  });
  try {
    assert.equal((await h.request()).status, 200);
    assert.equal(budgetTotal(h.ledger.requests), 0.01);
    assert.equal(h.ledger.requests[0].generationId, "generation");
  } finally {
    await h.proxy.close();
  }
});

test("campaign and per-session request ceilings deny before upstream spend", async () => {
  let calls = 0;
  const h = await harness(async () => {
    calls++;
    return new Response('{"usage":{"cost":0.01}}');
  });
  h.ledger.maxRequests = 2;
  h.ledger.maxRequestsPerSession = 1;
  try {
    await (await h.request()).text();
    assert.equal((await h.request()).status, 402);
    assert.equal(calls, 1);
    h.proxy.session = "session-2";
    await (await h.request()).text();
    h.proxy.session = "session-3";
    assert.equal((await h.request()).status, 402);
    assert.equal(calls, 2);
    assert.equal(h.ledger.requests.length, 2);
    assert.equal(h.proxy.blocked, true);
  } finally {
    await h.proxy.close();
  }
});

test("invalid request ceilings fail before proxy setup", async () => {
  for (const maxRequests of [0, -1, 1.5, NaN])
    await assert.rejects(
      startEvaluationProxy({
        apiKey: "unused",
        models: [model],
        ledger: { requests: [], maxRequests },
        checkpoint: async () => {},
      }),
      /Invalid maxRequests/,
    );
});

test("reservation includes the highest cache-write input rate", async () => {
  let calls = 0;
  const h = await harness(
    async () => {
      calls++;
      return new Response('{"usage":{"cost":0.01}}');
    },
    0.3,
    { reservedInputPerMillionUsd: 4 },
  );
  try {
    assert.equal((await h.request()).status, 402);
    assert.equal(calls, 0);
  } finally {
    await h.proxy.close();
  }
});
test("budget denies upstream requests and never releases unknown/interrupted spend", async () => {
  let calls = 0;
  const h = await harness(async () => {
    calls++;
    throw new Error("secret must not leak");
  }, 0.11);
  try {
    const failure = await h.request();
    assert.equal(failure.status, 502);
    assert.doesNotMatch(await failure.text(), /secret must/);
    assert.ok(budgetTotal(h.ledger.requests) > 0.1);
    assert.equal((await h.request()).status, 402);
    assert.equal(calls, 1);
  } finally {
    await h.proxy.close();
  }
});
test("streamed usage is accounted and unsupported models/modalities cannot call upstream", async () => {
  let calls = 0;
  const h = await harness(async () => {
    calls++;
    return new Response(
      'data: {"id":"gen","choices":[],"usage":{"cost":0.02}}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  try {
    assert.equal((await h.request({ model: "unapproved" })).status, 403);
    assert.equal(
      (await h.request({ messages: [{ content: [{ type: "image_url" }] }] }))
        .status,
      403,
    );
    const response = await h.request({ stream: true });
    assert.match(await response.text(), /DONE/);
    assert.equal(budgetTotal(h.ledger.requests), 0.02);
    assert.equal(calls, 1);
  } finally {
    await h.proxy.close();
  }
});

test("missing billing metadata stops further requests with the full reservation retained", async () => {
  const h = await harness(async () => new Response('{"choices":[]}'));
  try {
    await (await h.request()).text();
    assert.equal(h.proxy.blocked, true);
    assert.equal(h.ledger.requests[0].status, "unmetered");
    assert.ok(budgetTotal(h.ledger.requests) > 0.1);
    assert.equal((await h.request()).status, 402);
  } finally {
    await h.proxy.close();
  }
});

test("smaller request output ceiling is enforced and reserved instead of expanded", async () => {
  const h = await harness(
    async (_url, options) => {
      assert.equal(JSON.parse(options.body).max_tokens, 16384);
      return new Response('{"usage":{"cost":0.01}}');
    },
    1,
    { maxOutputTokens: 32768 },
  );
  try {
    await (await h.request({ max_tokens: 16384 })).text();
    assert.equal(h.ledger.requests[0].maxOutputTokens, 16384);
    assert.equal(
      h.ledger.requests[0].reservationMethod,
      "full-model-context-v1",
    );
    assert.equal(
      h.ledger.requests[0].inputReservationTokens,
      model.contextLength,
    );
    assert.ok(h.ledger.requests[0].reservedUsd < 0.16);
  } finally {
    await h.proxy.close();
  }
});

test("malformed limits and non-text requests cannot spend", async () => {
  let calls = 0;
  const h = await harness(async () => {
    calls++;
    return new Response('{"usage":{"cost":0}}');
  });
  try {
    for (const max_tokens of [0, -1, 1.5, "100", null])
      assert.equal((await h.request({ max_tokens })).status, 400);
    assert.equal((await h.request({ max_completion_tokens: 0 })).status, 400);
    assert.equal((await h.request({ messages: {} })).status, 400);
    assert.equal((await h.request({ messages: [null] })).status, 403);
    assert.equal((await h.request({ modalities: ["image"] })).status, 403);
    assert.equal(calls, 0);
    assert.equal(h.ledger.requests.length, 0);
  } finally {
    await h.proxy.close();
  }
  for (const limits of [
    { contextLength: NaN },
    { maxOutputTokens: 0 },
    { reservedInputPerMillionUsd: -1 },
    { maxInputBytes: 0 },
  ]) {
    assert.throws(
      () => evaluationReservation({ ...model, ...limits }),
      /Invalid/,
    );
  }
});

test("byte cap includes Unicode tools and proxy framing without claiming a token estimate", async () => {
  let calls = 0;
  const h = await harness(
    async () => {
      calls++;
      return new Response('{"usage":{"cost":0}}');
    },
    1,
    { maxInputBytes: 400 },
  );
  try {
    assert.equal(
      (
        await h.request({
          messages: [{ role: "user", content: "漢".repeat(200) }],
          tools: [
            {
              type: "function",
              function: { name: "read", description: "x".repeat(100) },
            },
          ],
        })
      ).status,
      413,
    );
    assert.equal(calls, 0);
    assert.equal(h.ledger.requests.length, 0);
  } finally {
    await h.proxy.close();
  }
});

test("SSE DONE ends the request even if the upstream leaves its connection open", async () => {
  let cancelled = false;
  const h = await harness(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"gen-done","usage":{"cost":0.03}}\n\ndata: [DONE]\n\n',
              ),
            );
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  try {
    await Promise.race([
      h.request({ stream: true }).then((response) => response.text()),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(Error("DONE did not finish")), 2000),
      ),
    ]);
    assert.equal(cancelled, true);
    assert.equal(budgetTotal(h.ledger.requests), 0.03);
    assert.equal(h.ledger.requests[0].generationId, "gen-done");
  } finally {
    await h.proxy.close();
  }
});

test("concurrent requests cannot share a reservation and shutdown preserves uncertain billing", async () => {
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const h = await harness(async (_url, { signal }) => {
    started();
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(Error("cancelled")), {
        once: true,
      }),
    );
  }, 0.15);
  const client = h
    .request()
    .then((response) => response.text())
    .catch(() => {});
  await ready;
  assert.equal((await h.request()).status, 402);
  await h.proxy.close();
  await client;
  assert.equal(h.ledger.requests.length, 1);
  assert.equal(h.ledger.requests[0].status, "interrupted");
  assert.ok(budgetTotal(h.ledger.requests) > 0.1);
  assert.throws(
    () => budgetTotal([{ costUsd: -1 }]),
    /Invalid request accounting/,
  );
});
