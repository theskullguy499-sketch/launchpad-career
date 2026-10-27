import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJobResults } from "../lib/model.mjs";
const job = {
  id: "fixture",
  title: " Engineer ",
  company: " Employer ",
  url: "https://remotive.com/remote-jobs/fixture",
  tags: ["JavaScript"],
};
test("retrieved jobs are bounded, normalized and retain only supported fields", () => {
  assert.deepEqual(validateJobResults([]), []);
  const result = validateJobResults([
    { ...job, description: "<script>untrusted</script>" },
  ])[0];
  assert.equal(result.title, "Engineer");
  assert.equal(result.company, "Employer");
  assert.equal(result.source, "Remotive");
  assert.equal(result.description, undefined);
});
test("malformed jobs, unsafe links and oversized provider results fail explicitly", () => {
  for (const value of [
    null,
    {},
    [null],
    [{ ...job, title: 2 }],
    [{ ...job, url: "javascript:alert(1)" }],
    [{ ...job, url: "https://user:password@example.com/" }],
    [{ ...job, tags: [null] }],
    [{ ...job, salary: {} }],
    Array(101).fill(job),
  ])
    assert.throws(() => validateJobResults(value), /invalid listings/);
});
