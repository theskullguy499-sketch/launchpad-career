// Deterministic workspace examples, not actual customers, hiring or business metrics.
exports.workspace54 = () => ({
  applications: [
    {
      id: "fixture-app-a",
      company: "Google",
      role: "[UI fixture] Frontend Engineer",
      country: "Canada",
      status: "Applied",
      applicationDate: "2026-10-27",
      deadline: "2026-11-02",
      interviewAt: "2026-10-30T12:00",
      priority: "High",
      arrangement: "Remote",
      createdAt: "2026-10-27T12:00:00Z",
      notes: "UI TEST FIXTURE — not a live vacancy.",
    },
    {
      id: "fixture-app-b",
      company: "GitHub",
      role: "[UI fixture] Accessibility Engineer",
      country: "Ireland",
      status: "Interview",
      applicationDate: "2026-10-05",
      deadline: "2026-10-29",
      priority: "Medium",
      createdAt: "2026-10-05T12:00:00Z",
      notes: "UI TEST FIXTURE — not a live vacancy.",
    },
    {
      id: "fixture-app-c",
      company: "Stripe",
      role: "[UI fixture] Product Engineer",
      country: "United States",
      status: "Offer",
      applicationDate: "2025-05-01",
      createdAt: "2025-05-01T12:00:00Z",
      notes: "UI TEST FIXTURE — not a real offer.",
    },
    {
      id: "fixture-app-d",
      company: "Atlassian",
      role: "[UI fixture] Software Engineer",
      country: "Australia",
      status: "Saved",
      createdAt: "2026-10-28T12:00:00Z",
      notes: "UI TEST FIXTURE — undated application.",
    },
  ],
  companies: [
    {
      id: "google",
      name: "Google",
      website: "https://www.google.com",
      industry: "Technology",
      favorite: true,
    },
  ],
  profile: {
    display_name: "UI Fixture",
    age_band: "18+",
    title: "Frontend Engineer",
    country: "Brazil",
  },
  goals: [
    {
      id: "fixture-goal",
      title: "[UI fixture] An international career",
      targetRole: "Frontend Engineer",
      countries: ["Canada", "Ireland"],
      skills: ["JavaScript", "Accessibility", "Testing"],
      arrangement: "Remote",
    },
  ],
  milestones: [
    {
      id: "fixture-m1",
      title: "[UI fixture] Build a portfolio project",
      kind: "Project",
      completed: true,
      targetDate: "2026-10-20",
    },
    {
      id: "fixture-m2",
      title: "[UI fixture] Practice accessible forms",
      kind: "Weekly",
      completed: false,
      targetDate: "2026-11-03",
    },
    {
      id: "fixture-m3",
      title: "[UI fixture] Prepare interview notes",
      kind: "Monthly",
      completed: false,
      targetDate: "2026-11-20",
    },
  ],
  tasks: [
    {
      id: "fixture-task",
      title: "[UI fixture] Review portfolio",
      completed: false,
      dueDate: "2026-11-02",
    },
  ],
  preferences: { onboarded: true },
  completed: [],
  aiHistory: [],
  revision: 0,
});
exports.seedWorkspace54 = async (page) =>
  page.addInitScript((data) => {
    if (localStorage.getItem("workspace54-seeded")) return;
    localStorage.setItem("workspace54-seeded", "yes");
    localStorage.setItem(
      "launchpad-opportunities-v1",
      JSON.stringify(data.applications),
    );
    const { applications, aiHistory, revision, ...extra } = data;
    localStorage.setItem("launchpad-workspace-v4", JSON.stringify(extra));
  }, exports.workspace54());
