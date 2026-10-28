import { blankWorkspace, backupPayload } from "./model.mjs";
const extrasKey = "launchpad-workspace-v4";
const copy = (value) => structuredClone(value);
export function createWorkspace({
  getClient,
  readGuest,
  persistGuest,
  onChange,
  onStatus = () => {},
}) {
  let queued = 0;
  let data = blankWorkspace(),
    mode = "guest",
    owner = null,
    epoch = 0,
    busy = false,
    queue = Promise.resolve();
  const emit = (status) =>
    onChange({ data: copy(data), mode, owner, busy, status });
  function guest() {
    const snapshot = readGuest();
    let extras = {};
    try {
      extras = JSON.parse(localStorage.getItem(extrasKey) || "{}");
    } catch {}
    return {
      ...blankWorkspace(),
      ...extras,
      applications: snapshot.applications,
      completed: snapshot.completed,
      revision: 0,
    };
  }
  async function checked(query) {
    const result = await query;
    if (result.error)
      throw new Error(
        result.error.code === "40001"
          ? "This workspace changed in another tab. Reload cloud data before saving again."
          : result.error.message || "Cloud request failed.",
      );
    return result.data;
  }
  function run(operation) {
    const operationEpoch = epoch;
    queued++;
    const pending = queue.then(operation);
    queue = pending.catch(() => {});
    return pending
      .catch((error) => {
        if (operationEpoch === epoch) onStatus("Not saved. " + error.message);
        throw error;
      })
      .finally(() => queued--);
  }
  return {
    get snapshot() {
      return copy(data);
    },
    get mode() {
      return mode;
    },
    get owner() {
      return owner;
    },
    get busy() {
      return busy;
    },
    guestSnapshot: guest,
    async enter(user) {
      const ticket = ++epoch;
      owner = user;
      mode = user ? "account" : "guest";
      busy = !!user;
      data = user ? blankWorkspace() : guest();
      emit(
        user
          ? "Loading private cloud workspace…"
          : "Guest data saved on this device",
      );
      if (!user) return;
      try {
        const client = await getClient();
        const result = await checked(client.rpc("load_workspace"));
        if (ticket !== epoch) return;
        if (
          !result ||
          !Array.isArray(result.applications) ||
          !Number.isInteger(result.revision)
        )
          throw new Error(
            "Cloud database is not ready. Apply the Launchpad 4.0 migrations.",
          );
        data = {
          ...blankWorkspace(),
          ...result,
          profile: { ...blankWorkspace().profile, ...result.profile },
          preferences: {
            ...blankWorkspace().preferences,
            ...result.preferences,
          },
        };
        busy = false;
        emit("Cloud workspace loaded");
      } catch (error) {
        if (ticket === epoch) {
          busy = true;
          emit(
            error.message +
              " Your guest records are untouched. You may switch to guest mode.",
          );
        }
      }
    },
    async update(mutator) {
      const requestedEpoch = epoch;
      return run(async () => {
        if (requestedEpoch !== epoch)
          throw new Error("Workspace changed before the save began.");
        if (busy)
          throw new Error("Wait for cloud loading, or reload after an error.");
        const ticket = epoch;
        const candidate = copy(data);
        mutator(candidate);
        if (mode === "guest") {
          if (!persistGuest(candidate))
            throw new Error(
              "Storage is unavailable. Download a backup before continuing.",
            );
          if (ticket !== epoch) throw new Error("Workspace changed.");
          data = candidate;
          emit("Saved on this device");
          return;
        }
        onStatus("Saving to your account…");
        const id = owner.id;
        const expectedRevision = data.revision;
        const client = await getClient();
        const { data: auth, error } = await client.auth.getUser();
        if (error || auth.user?.id !== id)
          throw new Error("Your account changed. Sign in again.");
        if (ticket !== epoch)
          throw new Error(
            "Account changed before saving. No changes were sent.",
          );
        const revision = await checked(
          client.rpc("commit_workspace", {
            payload: candidate,
            expected_revision: expectedRevision,
            expected_owner: id,
          }),
        );
        if (ticket !== epoch) return;
        candidate.revision = revision;
        data = candidate;
        emit("All changes saved to your private cloud workspace");
      });
    },
    trackerChanged(snapshot) {
      if (mode === "guest") {
        data.applications = copy(snapshot.applications);
        data.completed = copy(snapshot.completed);
        emit("Saved on this device");
      }
    },
    async saveTracker(entries) {
      if (mode !== "account")
        throw new Error(
          "Guest persistence must use the original storage keys.",
        );
      return this.update((next) => {
        for (const [key, value] of entries) {
          if (key === "launchpad-opportunities-v1") next.applications = value;
          else if (key === "launchpad-roadmap-v1") next.completed = value;
        }
      });
    },
    async importGuest() {
      if (mode !== "account" || busy || queued > 0)
        throw new Error("Load your account workspace first.");
      const ticket = epoch;
      const client = await getClient();
      await checked(
        client.rpc("import_guest_workspace", {
          guest: guest(),
          expected_user: owner.id,
        }),
      );
      if (ticket === epoch) await this.enter(owner);
    },
    async refresh() {
      if (queued > 0)
        throw new Error("Wait for pending changes before reloading.");
      return this.enter(owner);
    },
    async checkRevision() {
      if (mode !== "account" || busy || queued > 0) return;
      const ticket = epoch;
      const client = await getClient();
      const row = await checked(
        client
          .from("user_preferences")
          .select("revision")
          .eq("user_id", owner.id)
          .maybeSingle(),
      );
      if (
        ticket === epoch &&
        row &&
        Number.isInteger(row.revision) &&
        row.revision !== data.revision
      )
        await this.refresh();
    },
    async clearGuest() {
      if (mode !== "guest")
        throw new Error("Switch to guest mode before clearing local records.");
      return this.update((next) => Object.assign(next, blankWorkspace()));
    },
    async exportAll() {
      if (queued > 0)
        throw new Error("Wait for pending changes before exporting.");
      if (mode === "guest") return backupPayload(data);
      const ticket = epoch;
      const client = await getClient();
      const latest = await checked(client.rpc("load_workspace"));
      const exportOwner = owner.id;
      const history = [];
      for (let offset = 0; ; offset += 500) {
        const rows = await checked(
          client
            .from("ai_planning_history")
            .select("data")
            .eq("user_id", exportOwner)
            .range(offset, offset + 499),
        );
        history.push(...rows.map((r) => r.data));
        if (rows.length < 500) break;
      }
      const feedback = [];
      for (let offset = 0; ; offset += 500) {
        const rows = await checked(
          client
            .from("feedback")
            .select("data")
            .eq("user_id", exportOwner)
            .range(offset, offset + 499),
        );
        feedback.push(...rows.map((r) => r.data));
        if (rows.length < 500) break;
      }
      if (ticket !== epoch) throw new Error("Account changed during export.");
      return {
        ...backupPayload({ ...latest, aiHistory: history }),
        account: { id: owner.id, email: owner.email },
        feedback,
        notifications: latest.notifications || [],
      };
    },
    async clearHistory() {
      if (mode !== "account") return;
      const ticket = epoch,
        id = owner.id;
      const client = await getClient();
      await checked(
        client.from("ai_planning_history").delete().eq("user_id", id),
      );
      if (ticket !== epoch) return;
      data.aiHistory = [];
      emit("Saved AI history deleted");
    },
    async markNotificationRead(notice) {
      if (mode !== "account") return;
      const ticket = epoch,
        id = owner.id;
      const client = await getClient();
      await checked(
        client
          .from("notifications")
          .update({ data: { ...notice, read: true } })
          .eq("user_id", id)
          .eq("client_id", notice.id),
      );
      if (ticket !== epoch) return;
      data.notifications = data.notifications.map((n) =>
        n.id === notice.id ? { ...n, read: true } : n,
      );
      emit("Notification marked read");
    },
    async feedback(message) {
      if (mode !== "account")
        throw new Error(
          "Sign in to submit feedback, or download it in guest mode.",
        );
      if (!message.trim())
        throw new Error("Please enter feedback before submitting.");
      const id = owner.id;
      const client = await getClient();
      await checked(
        client.from("feedback").insert({
          user_id: id,
          client_id: crypto.randomUUID(),
          data: { message, createdAt: new Date().toISOString() },
        }),
      );
    },
    async restoreExtras(extras) {
      await this.update((next) => {
        for (const key of [
          "companies",
          "goals",
          "milestones",
          "tasks",
          "profile",
          "preferences",
        ])
          if (extras[key] !== undefined) next[key] = extras[key];
      });
    },
  };
}
