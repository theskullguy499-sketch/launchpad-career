# Launchpad 5.3 — actual browser captures

33 JPEG captures, 28 October 2026. Before: isolated 5.2 commit `8985e39`; after: fresh 5.3 distribution build. Both use the same deterministic fixtures and real Chromium rendering. These are local captures, not a new Cloudflare deployment.

Populated jobs carry **UI TEST FIXTURES — NOT LIVE VACANCIES** notices and fixture titles. Auth panels carry **AUTH UI FIXTURE** notices. No actual employer opening, hiring relationship, account creation, inbox delivery or integration acceptance is implied. No salaries were invented.

## Job Explorer

| Size | Before 5.2 | After light | After dark |
| --- | --- | --- | --- |
| desktop | [Before](before-jobs-light-desktop.jpg) | [Light](after-jobs-light-desktop.jpg) | [Dark](after-jobs-dark-desktop.jpg) |
| mobile | [Before](before-jobs-light-mobile.jpg) | [Light](after-jobs-light-mobile.jpg) | [Dark](after-jobs-dark-mobile.jpg) |

## Login

| Size | Before 5.2 | After light | After dark |
| --- | --- | --- | --- |
| desktop | [Before](before-login-light-desktop.jpg) | [Light](after-login-light-desktop.jpg) | [Dark](after-login-dark-desktop.jpg) |
| mobile | [Before](before-login-light-mobile.jpg) | [Light](after-login-light-mobile.jpg) | [Dark](after-login-dark-mobile.jpg) |

## Registration

| Size | Before 5.2 | After light | After dark |
| --- | --- | --- | --- |
| desktop | [Before](before-registration-light-desktop.jpg) | [Light](after-registration-light-desktop.jpg) | [Dark](after-registration-dark-desktop.jpg) |
| mobile | [Before](before-registration-light-mobile.jpg) | [Light](after-registration-light-mobile.jpg) | [Dark](after-registration-dark-mobile.jpg) |

## Job Details — newly implemented screen

| Size | Light | Dark |
| --- | --- | --- |
| Desktop 1440px | [Light](after-details-light-desktop.jpg) | [Dark](after-details-dark-desktop.jpg) |
| Mobile 390px | [Light](after-details-light-mobile.jpg) | [Dark](after-details-dark-mobile.jpg) |

No before-details screen existed in 5.2. The source description, marks, tabs and application links here use declared fixtures; actual provider responses must be validated separately.

## Responsive and setup states

- 1280px: [jobs](after-jobs-light-desktop1280.jpg), [details](after-details-light-desktop1280.jpg).
- 768px: [jobs](after-jobs-light-tablet768.jpg), [registration](after-registration-light-tablet768.jpg).
- 375px: [jobs](after-jobs-light-mobile375.jpg), [details](after-details-light-mobile375.jpg).
- Registration on mobile is scrollable: [top](after-registration-light-mobile.jpg), [bottom controls](after-registration-light-mobile-bottom.jpg).
- Verification pending: [desktop](after-verification-light-desktop.jpg), [mobile](after-verification-light-mobile.jpg). These show a mocked signup response, not a delivered email.
- Optional owned-account setup: [desktop](after-onboarding-light-desktop.jpg), [mobile](after-onboarding-light-mobile.jpg). These use a mocked verified identity/private workspace, not an external account acceptance record.

[Reference comparison](../../releases/5.3-VISUAL.md) · [Release evidence and limits](../../releases/5.3-RELEASE.md) · [Windows/Staging instructions](../../releases/5.3-STAGING.md).
