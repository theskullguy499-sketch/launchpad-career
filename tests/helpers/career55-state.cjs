// Explicit local UI fixtures. No real customers, offers, qualifications or vacancies.
const { workspace54 } = require("./workspace54-fixture.cjs");
const { jobs53 } = require("./jobs53-fixture.cjs");
exports.career55State = () => {
  const data = workspace54();
  data.profile.display_name = "UI Fixture";
  data.preferences.savedJobs = [
    { ...jobs53[0], bookmarkedAt: "2026-10-28T12:00:00Z" },
  ];
  data.preferences.careerStudio55 = {
    version: 1,
    resumes: [
      {
        id: "fixture-resume",
        label: "[UI fixture] Frontend resume",
        template: "classic",
        name: "UI Fixture",
        title: "Student · Frontend development",
        email: "fixture@example.com",
        phone: "",
        location: "Brazil",
        summary:
          "UI TEST FIXTURE — NOT A REAL PERSON OR QUALIFICATION. Practicing accessible web development through personal projects.",
        github: "https://github.com/example",
        portfolio: "",
        skills: "JavaScript, TypeScript, Accessibility",
        languages: "English · self-declared practice level",
        experience: [],
        education: [],
        projects: [
          {
            heading: "[UI fixture] Personal career workspace",
            organization: "Personal project · not employment",
            period: "In progress",
            description:
              "Example editor content entered only for a local browser screenshot. No commercial results are claimed.",
            url: "",
          },
        ],
        updatedAt: "2026-10-28T12:00:00Z",
      },
    ],
    practices: [
      {
        id: "fixture-practice",
        questionId: "project-intro",
        answer:
          "UI TEST FIXTURE. I am practicing how to explain a personal web project, my own contribution and one technical trade-off.",
        seconds: 75,
        updatedAt: "2026-10-28T12:05:00Z",
        source: "static-practice",
      },
    ],
    checklist: ["0", "2"],
  };
  return data;
};
exports.seedCareer55 = (page) =>
  page.addInitScript((data) => {
    localStorage.setItem(
      "launchpad-opportunities-v1",
      JSON.stringify(data.applications),
    );
    const { applications, aiHistory, revision, ...extra } = data;
    localStorage.setItem("launchpad-workspace-v4", JSON.stringify(extra));
  }, exports.career55State());
