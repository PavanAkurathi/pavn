export const NAV_ITEMS = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/how-it-works/businesses", label: "Businesses" },
  { href: "/how-it-works/workers", label: "Workers" },
  { href: "/faq", label: "FAQ" },
];

export const businessSteps = [
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
];

export const industryHighlights = [
  {
    slug: "warehousing",
    title: "Warehousing",
    summary:
      "Coverage for warehouse crews, logistics teams, and shift-based operations.",
    detail:
      "Use Workers Hive to coordinate receiving, picking, floor coverage, and site attendance across one or more operating locations.",
  },
  {
    slug: "restaurants",
    title: "Restaurants",
    summary:
      "A cleaner operating flow for service teams, kitchen shifts, and day-to-day coordination.",
    detail:
      "Restaurant groups can separate manager access from worker access, publish live shifts, and keep attendance reviewable across prep, service, and close.",
  },
  {
    slug: "bars-nightlife",
    title: "Bars & nightlife",
    summary:
      "Useful for late shifts, handoffs, and attendance when service picks up fast.",
    detail:
      "Night teams benefit from clear handoffs, shift visibility, and mobile attendance records that do not get lost in closing-hour chaos.",
  },
  {
    slug: "hotels-hospitality",
    title: "Hotels & hospitality",
    summary:
      "Supports teams managing room-ready work, guest operations, and shift accountability.",
    detail:
      "Hospitality operators can coordinate housekeeping, front desk, and support staff while keeping who was scheduled and who actually worked easy to review.",
  },
  {
    slug: "retail-grocery",
    title: "Retail & grocery",
    summary:
      "Better for teams juggling store hours, coverage gaps, and verified shift attendance.",
    detail:
      "Retail teams can run store schedules, track site-based work, and avoid losing the operational thread between planning, attendance, and approvals.",
  },
  {
    slug: "cleaning-janitorial",
    title: "Cleaning & janitorial",
    summary:
      "Helps site-based support teams run scheduled work with clearer accountability.",
    detail:
      "Cleaning and facility-support teams can manage recurring work, multi-site coverage, and correction review without relying on scattered text messages or spreadsheets.",
  },
] as const;

export const workerSteps = [
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
];

export const valueHighlights = [
  {
    title: "Operations, not marketplace staffing",
    body:
      "Workers Hive is built for businesses managing their own team, locations, and shifts. It is not a labor marketplace.",
  },
  {
    title: "Two distinct access models",
    body:
      "Business users sign in with email and password. Workers sign in with phone OTP only after business-created workforce access exists.",
  },
  {
    title: "Shift lifecycle from start to approval",
    body:
      "The product covers creation, publication, attendance, correction review, and final approval instead of stopping at schedule creation.",
  },
];

export const faqs = [
  {
    question: "Can workers sign up without being invited?",
    answer:
      "No. A business must first add the worker to the workforce with a valid phone number before that worker can log into the mobile app.",
  },
  {
    question: "Are business invites the same as worker invites?",
    answer:
      "No. Business invites are for admins and managers. Worker access comes from workforce setup and phone-based mobile login.",
  },
  {
    question: "Do managers have to complete business onboarding?",
    answer:
      "No. Admins are responsible for incomplete business setup. Managers can help run the operation without being forced through admin-only onboarding steps.",
  },
  {
    question: "What happens if a worker forgets to clock out?",
    answer:
      "The worker can request a correction and the business can review it before the final shift approval is completed.",
  },
];
