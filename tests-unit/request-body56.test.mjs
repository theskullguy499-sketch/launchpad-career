import test from "node:test";
import assert from "node:assert/strict";
import { boundedJson } from "../supabase/functions/_shared/request-body.mjs";
test("a chunked oversized body is canceled while streaming, not read into unlimited memory", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    pull(c) {
      c.enqueue(new Uint8Array(7000));
    },
    cancel() {
      canceled = true;
    },
  });
  const req = new Request("https://example.com", {
    method: "POST",
    body: stream,
    duplex: "half",
  });
  await assert.rejects(boundedJson(req, 12000), (e) => e.status === 413);
  assert.equal(canceled, true);
});
test("invalid UTF-8 never reaches JSON parsing or downstream services", async () => {
  const req = new Request("https://example.com", {
    method: "POST",
    body: new Uint8Array([0xff]),
  });
  await assert.rejects(boundedJson(req, 12000), (e) => e.status === 400);
});
