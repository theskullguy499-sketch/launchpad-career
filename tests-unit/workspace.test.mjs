import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankWorkspace,
  analytics,
  reminders,
  starterRoadmap,
} from "../lib/model.mjs";
import { createWorkspace } from "../lib/workspace.mjs";
test("analytics and reminders use only real workspace data", () => {
  const data = blankWorkspace();
  data.applications = [
    {
      id: "a",
      company: "Company",
      country: "Brazil",
      status: "Interview",
      applicationDate: "2026-10-01",
      deadline: "2026-10-27",
      interviewAt: "2026-10-28T12:00",
    },
  ];
  data.milestones = [{ id: "m", title: "Project", completed: true }];
  const stats = analytics(data);
  assert.equal(stats.total, 1);
  assert.equal(stats.responseRate, 100);
  assert.equal(stats.roadmap, 100);
  assert.equal(stats.monthly[0][0], "2026-10");
  assert.equal(reminders(data, new Date("2026-10-26T12:00")).length, 2);
  assert.equal(analytics(blankWorkspace()).responseRate, 0);
  assert.equal(
    starterRoadmap({ targetRole: "Engineer", skills: ["JavaScript"] }).length,
    5,
  );
});
test("guest records survive account isolation, queued commits and stale revisions", async () => {
  const local = new Map();
  globalThis.localStorage = {
    getItem: (k) => local.get(k) || null,
    setItem: (k, v) => local.set(k, v),
  };
  const guest = {
    applications: [{ id: "guest", company: "Guest" }],
    completed: [0],
  };
  let cloud = { ...blankWorkspace(), profile: { age_band: "18+" } },
    fail = false,
    persisted = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "alice" } } }) },
    rpc: async (name, args) => {
      if (name === "load_workspace") return { data: structuredClone(cloud) };
      if (fail) return { error: { code: "40001" } };
      if (name === "commit_workspace") {
        assert.equal(args.expected_revision, cloud.revision);
        cloud = {
          ...structuredClone(args.payload),
          revision: cloud.revision + 1,
        };
        return { data: cloud.revision };
      }
    },
  };
  const store = createWorkspace({
    getClient: async () => client,
    readGuest: () => structuredClone(guest),
    persistGuest: () => {
      persisted++;
      return true;
    },
    onChange: () => {},
  });
  await store.enter(null);
  assert.equal(store.snapshot.applications[0].id, "guest");
  await store.enter({ id: "alice", email: "alice@example.com" });
  assert.equal(store.snapshot.applications.length, 0);
  assert.equal(persisted, 0);
  await Promise.all([
    store.update((next) => next.tasks.push({ id: "a", title: "A" })),
    store.update((next) => next.tasks.push({ id: "b", title: "B" })),
  ]);
  assert.equal(cloud.tasks.length, 2);
  assert.equal(store.snapshot.revision, 2);
  fail = true;
  await assert.rejects(
    store.update((next) => (next.tasks = [])),
    /another tab/,
  );
  assert.equal(store.snapshot.tasks.length, 2);
  assert.equal(persisted, 0);
  await store.enter(null);
  assert.equal(store.snapshot.applications[0].id, "guest");
  assert.deepEqual(guest.completed, [0]);
});
test("failed cloud initialization never silently displays guest records as account data", async () => {
  globalThis.localStorage = { getItem: () => null };
  let last;
  const store = createWorkspace({
    getClient: async () => ({
      rpc: async () => ({ error: { message: "migration missing" } }),
    }),
    readGuest: () => ({
      applications: [{ id: "sensitive-guest" }],
      completed: [],
    }),
    persistGuest: () => true,
    onChange: (s) => (last = s),
  });
  await store.enter({ id: "alice" });
  assert.equal(last.busy, true);
  assert.equal(last.data.applications.length, 0);
  assert.equal(last.mode, "account");
  await assert.rejects(
    store.update(() => {}),
    /loading/,
  );
});
test("account switches discard queued and in-flight writes before they can target another owner", async () => {
  globalThis.localStorage = { getItem: () => null };
  let releaseAuth;
  let commits = 0;
  const client = {
    auth: {
      getUser: () =>
        new Promise((resolve) => {
          releaseAuth = resolve;
        }),
    },
    rpc: async (name) =>
      name === "load_workspace"
        ? { data: blankWorkspace() }
        : (commits++, { data: 1 }),
  };
  const store = createWorkspace({
    getClient: async () => client,
    readGuest: () => ({ applications: [], completed: [] }),
    persistGuest: () => true,
    onChange: () => {},
  });
  await store.enter({ id: "alice" });
  const first = store.update((next) =>
    next.tasks.push({ id: "sensitive", title: "Alice private task" }),
  );
  const second = store.update((next) =>
    next.goals.push({ id: "goal", title: "Alice private goal" }),
  );
  while (!releaseAuth) await new Promise((resolve) => setTimeout(resolve, 0));
  await store.enter({ id: "bob" });
  releaseAuth({ data: { user: { id: "alice" } } });
  const outcomes = await Promise.allSettled([first, second]);
  assert.ok(outcomes.every((o) => o.status === "rejected"));
  assert.equal(commits, 0);
  assert.equal(store.snapshot.tasks.length, 0);
  assert.equal(store.snapshot.goals.length, 0);
});

test("late workspace save failures reject the caller without overwriting the next workspace status", async () => {
  globalThis.localStorage = { getItem: () => null };
  const statuses = [],
    changes = [];
  let complete, started;
  const began = new Promise((resolve) => (started = resolve));
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "alice" } } }) },
    rpc: async (name) => {
      if (name === "load_workspace") return { data: blankWorkspace() };
      started();
      return new Promise((resolve) => (complete = resolve));
    },
  };
  const store = createWorkspace({
    getClient: async () => client,
    readGuest: () => ({ applications: [], completed: [] }),
    persistGuest: () => true,
    onStatus: (value) => statuses.push(value),
    onChange: (value) => changes.push(value),
  });
  await store.enter({ id: "alice" });
  const failed = store
    .update((next) =>
      next.tasks.push({ id: "private-task", title: "Private draft" }),
    )
    .catch((error) => error);
  await began;
  await store.enter(null);
  const statusCount = statuses.length;
  complete({ error: { message: "Old account save failed" } });
  const error = await failed;
  assert.equal(error.message, "Old account save failed");
  assert.equal(statuses.length, statusCount);
  assert.equal(changes.at(-1).mode, "guest");
  assert.match(changes.at(-1).status, /Guest data/);
  assert.equal(store.snapshot.tasks.length, 0);
});
