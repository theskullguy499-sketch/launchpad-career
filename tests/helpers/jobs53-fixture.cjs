// Deterministic UI records only. Not live vacancies or evidence of provider availability.
exports.jobs53 = [
  {
    id: "ui-fixture-53-a",
    title: "[UI fixture] Frontend Engineer",
    company: "Google",
    location: "Worldwide",
    salary: "",
    tags: ["TypeScript", "React"],
    category: "Software Development",
    employmentType: "full_time",
    arrangement: "Remote",
    postedAt: "2026-10-28",
    source: "Remotive",
    url: "https://remotive.com/remote-jobs/ui-fixture-53-a",
    descriptionText:
      "About the role\n\nUI TEST FIXTURE — NOT A LIVE VACANCY.\n\nThis description exists only to validate the interface. No hiring status or relationship is implied.\n\nResponsibilities\n\n• Build accessible interfaces.\n• Collaborate on reliable software.\n\nRequirements\n\nTypeScript and React are sample fixture tags, not a real employer requirement.",
  },
  {
    id: "ui-fixture-53-b",
    title: "[UI fixture] Product Designer",
    company: "GitHub",
    location: "Canada",
    salary: "",
    tags: ["Figma", "Accessibility"],
    category: "Design",
    employmentType: "contract",
    arrangement: "Remote",
    postedAt: "2026-10-27",
    source: "Remotive",
    url: "https://remotive.com/remote-jobs/ui-fixture-53-b",
    descriptionText:
      "UI TEST FIXTURE — NOT A LIVE VACANCY.\n\nUsed only for layout, filtering and bookmark tests. No salary is supplied and no hiring relationship is implied.",
  },
];
exports.mockJobs53 = async (page) =>
  page.route("**/functions/v1/job-explorer", (route) =>
    route.fulfill({
      json: {
        source: "Remotive",
        fetchedAt: "2026-10-28T12:00:00Z",
        jobs: exports.jobs53,
      },
    }),
  );
