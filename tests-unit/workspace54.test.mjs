import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applicationHistory,
  recordApplicationUpdate,
  periodApplications,
  datedMonths,
  applicationSchedule,
  nextApplicationAction,
  safeCompanyLink,
} from "../lib/workspace-insights.mjs";
const now = new Date("2026-10-28T12:00:00Z");
test("recorded application history logs actual changes, stays bounded and does not reconstruct old events", () => {
  const old = {
    id: "original",
    company: "Existing",
    role: "Engineer",
    country: "Brazil",
    status: "Saved",
    createdAt: "2020-01-01",
  };
  const updated = recordApplicationUpdate(
    old,
    { ...old, status: "Interview" },
    now,
  );
  assert.equal(updated.id, old.id);
  assert.equal(updated.createdAt, old.createdAt);
  assert.equal(updated.updates.length, 1);
  assert.equal(updated.updates[0].type, "status");
  assert.match(updated.updates[0].summary, /Saved → Interview/);
  assert.equal(updated.updates[0].at, now.toISOString());
  assert.equal(
    recordApplicationUpdate(updated, { ...updated }, now).updates.length,
    1,
  );
  let value = updated;
  for (let i = 0; i < 30; i++)
    value = recordApplicationUpdate(
      value,
      { ...value, notes: "Change " + i },
      now,
    );
  assert.equal(value.updates.length, 20);
  assert.deepEqual(applicationHistory(null), []);
  assert.deepEqual(
    applicationHistory([{ at: "invalid", summary: "fake" }]),
    [],
  );
});
test("period and month projections use valid actual application dates, retaining undated records only in all", () => {
  const apps = [
    { id: "recent", applicationDate: "2026-10-01" },
    { id: "today", applicationDate: "2026-10-28" },
    { id: "old", applicationDate: "2025-01-01" },
    { id: "undated", createdAt: "2026-10-28" },
    { id: "bad", applicationDate: "2026-02-31" },
    { id: "future", applicationDate: "2027-01-01" },
  ];
  assert.equal(periodApplications(apps, "all", now).length, 6);
  assert.deepEqual(
    periodApplications(apps, "30", now).map((x) => x.id),
    ["recent", "today"],
  );
  assert.deepEqual(datedMonths(apps), [
    ["2025-01", 1],
    ["2026-10", 2],
    ["2027-01", 1],
  ]);
});
test("application agenda derives recorded dates without inventing activity for closed or undated records", () => {
  const open = {
    id: "a",
    company: "Known",
    role: "Engineer",
    status: "Interview",
    deadline: "2026-10-30",
    interviewAt: "2026-10-29T12:00",
    followUp: "2026-02-31",
  };
  assert.equal(
    applicationSchedule([open, { ...open, id: "closed", status: "Withdrawn" }])
      .length,
    2,
  );
  assert.equal(nextApplicationAction(open, now), "Interview · 2026-10-29");
  assert.equal(
    nextApplicationAction({ ...open, status: "Hired" }, now),
    "Set your next action",
  );
  assert.match(
    nextApplicationAction(
      { ...open, deadline: "2020-01-01", interviewAt: "" },
      now,
    ),
    /Overdue/,
  );
});
test("company links reject embedded credentials and executable protocols without changing existing records", () => {
  assert.equal(safeCompanyLink("javascript:alert(1)"), "");
  assert.equal(safeCompanyLink("https://user:secret@example.com/"), "");
  assert.equal(safeCompanyLink("https://example.com"), "https://example.com/");
  assert.equal(safeCompanyLink("http://example.com"), "http://example.com/");
});
