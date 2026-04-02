export const marketingSteps = [
  {
    number: "1",
    title: "Set up your business",
    body: "Create the workspace, finish onboarding, and configure the first operating location before shift planning starts.",
  },
  {
    number: "2",
    title: "Add workers and publish shifts",
    body: "Bring in managers through team invites, add workers through workforce access, then publish the schedule when it is ready.",
  },
  {
    number: "3",
    title: "Run the shift and approve the result",
    body: "Workers clock in and out from mobile, managers review correction requests, and the business approves the final timesheet.",
  },
] as const;

export const howItWorksFaqs = [
  {
    question: "Can workers sign up without an invitation from the business?",
    answer:
      "No. Workers Hive uses workforce access as the gate. A business must first add the worker with a valid phone number before that worker can log into the mobile app.",
  },
  {
    question: "Are business team invites and worker access the same thing?",
    answer:
      "No. Admins and managers are invited into the business workspace. Workers receive workforce access for the mobile app and shift attendance flow.",
  },
  {
    question: "What happens after a shift is published?",
    answer:
      "Published shifts become visible to eligible workers. From there, workers can view shift details, clock in and out, and request corrections if something needs review.",
  },
  {
    question: "Who handles onboarding when the business is not fully set up yet?",
    answer:
      "Admins own incomplete business onboarding. Managers can help operate the business later without being forced through admin-only setup tasks.",
  },
  {
    question: "What makes the product different from a staffing marketplace?",
    answer:
      "Workers Hive is for businesses managing their own workforce. It is focused on scheduling, attendance, approvals, and mobile worker access, not matching businesses with marketplace labor.",
  },
] as const;

export const businessFlowSteps = [
  {
    step: "01",
    title: "Create your business workspace",
    description:
      "An admin signs up with email and password, verifies the account, and finishes the first-time business setup.",
    detail:
      "This is where business profile details and the first working location get set up.",
  },
  {
    step: "02",
    title: "Add your team and workforce",
    description:
      "Invite admins or managers to help run operations, then add workers through roster setup, imports, or manual entry.",
    detail:
      "Business team access and worker access are different on purpose. Managers run the business. Workers receive shifts in the mobile app.",
  },
  {
    step: "03",
    title: "Build and publish shifts",
    description:
      "Create schedules, assign workers, and publish live shifts once the plan is ready for the team.",
    detail:
      "Publishing is the moment the shift moves from planning to something workers can actually see and act on.",
  },
  {
    step: "04",
    title: "Run attendance and approvals",
    description:
      "Workers clock in and out from the mobile app, managers review timesheets, and any correction requests are approved from the business side.",
    detail:
      "The full loop is schedule, attendance, review, and approval, not just schedule creation.",
  },
] as const;

export const workerFlowSteps = [
  {
    step: "01",
    title: "Get added by your business",
    description:
      "Workers do not create open self-serve accounts. A business must first add them to the workforce with a usable phone number.",
    detail:
      "That workforce record is what unlocks mobile access. The invite link is only a shortcut into the app.",
  },
  {
    step: "02",
    title: "Verify your phone",
    description:
      "The worker enters their phone number, receives a one-time code, and signs in with phone OTP.",
    detail:
      "This keeps the worker flow fast while still making the business-created workforce record the source of truth.",
  },
  {
    step: "03",
    title: "See shifts and shift details",
    description:
      "Once verified, workers can see live shifts, review details, and understand where and when they need to be on site.",
    detail:
      "The mobile experience is built around assigned work, not around marketplace browsing or public job discovery.",
  },
  {
    step: "04",
    title: "Clock in, clock out, and request corrections",
    description:
      "Workers record attendance on mobile and can request corrections if the shift timing needs review.",
    detail:
      "Managers then review those requests on the business side before the shift is finalized.",
  },
] as const;

export const industryHighlights: IndustryHighlight[] = [
  {
    slug: "warehousing",
    title: "Warehousing",
    summary:
      "Coverage for warehouse crews, logistics teams, and shift-based operations.",
    detail:
      "Use Workers Hive to coordinate receiving, picking, floor coverage, and site attendance across one or more operating locations.",
    posterSrc:
      "https://images.pexels.com/photos/17229385/pexels-photo-17229385.jpeg?cs=srgb&dl=pexels-manduko-17229385.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/31751344/",
  },
  {
    slug: "restaurants",
    title: "Restaurants",
    href: "/industries/food-beverage",
    summary:
      "A cleaner operating flow for service teams, kitchen shifts, and day-to-day coordination.",
    detail:
      "Restaurant groups can separate manager access from worker access, publish live shifts, and keep attendance reviewable across prep, service, and close.",
    posterSrc:
      "https://images.pexels.com/photos/12203611/pexels-photo-12203611.jpeg?cs=srgb&dl=pexels-alialcantara-12203611.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/9356231/",
  },
  {
    slug: "bars-nightlife",
    title: "Bars & nightlife",
    summary:
      "Useful for late shifts, handoffs, and attendance when service picks up fast.",
    detail:
      "Night teams benefit from clear handoffs, shift visibility, and mobile attendance records that do not get lost in closing-hour chaos.",
    posterSrc:
      "https://images.pexels.com/photos/19674061/pexels-photo-19674061.jpeg?cs=srgb&dl=pexels-alexandru-cojanu-828538450-19674061.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/7593094/",
  },
  {
    slug: "hotels-hospitality",
    title: "Hotels & hospitality",
    summary:
      "Supports teams managing room-ready work, guest operations, and shift accountability.",
    detail:
      "Hospitality operators can coordinate housekeeping, front desk, and support staff while keeping who was scheduled and who actually worked easy to review.",
    posterSrc:
      "https://images.pexels.com/photos/9462737/pexels-photo-9462737.jpeg?cs=srgb&dl=pexels-liliana-drew-9462737.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/6466563/",
  },
  {
    slug: "retail-grocery",
    title: "Retail & grocery",
    summary:
      "Better for teams juggling store hours, coverage gaps, and verified shift attendance.",
    detail:
      "Retail teams can run store schedules, track site-based work, and avoid losing the operational thread between planning, attendance, and approvals.",
    posterSrc:
      "https://images.pexels.com/photos/10907746/pexels-photo-10907746.jpeg?cs=srgb&dl=pexels-laudiatsr-10907746.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/36074343/",
  },
  {
    slug: "cleaning-janitorial",
    title: "Cleaning & janitorial",
    summary:
      "Helps site-based support teams run scheduled work with clearer accountability.",
    detail:
      "Cleaning and facility-support teams can manage recurring work, multi-site coverage, and correction review without relying on scattered text messages or spreadsheets.",
    posterSrc:
      "https://images.pexels.com/photos/34516670/pexels-photo-34516670.jpeg?cs=srgb&dl=pexels-caleboquendo-34516670.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/6197060/",
  },
] as const;
type IndustryHighlight = {
  slug: string;
  title: string;
  summary: string;
  detail: string;
  posterSrc: string;
  videoSrc: string;
  href?: string;
};
