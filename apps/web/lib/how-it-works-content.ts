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

export type IndustryPageContent = {
  slug: string;
  title: string;
  pageTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroAccent: string;
  heroDescription: string;
  heroBadge: string;
  heroMediaAlt: string;
  summary: string;
  detail: string;
  rolesTitle: string;
  rolesIntro: string;
  roles: readonly string[];
  heroChips: readonly {
    label: string;
    detail: string;
  }[];
  workflowTitle: string;
  workflowDescription: string;
  workflowPoints: readonly {
    title: string;
    body: string;
  }[];
  ctaTitle: string;
  ctaDescription: string;
  posterSrc: string;
  videoSrc: string;
};

export const industryPages: readonly IndustryPageContent[] = [
  {
    slug: "warehousing",
    title: "Warehousing",
    pageTitle: "Warehouse Scheduling Software | Workers Hive",
    metaDescription:
      "Workers Hive helps warehouse teams set up workforce access, publish live floor shifts, and verify attendance across receiving, picking, and loading operations.",
    heroTitle: "Run warehouse crews",
    heroAccent: "without floor-coverage gaps",
    heroDescription:
      "Coordinate receiving, picking, dock work, and facility attendance from one operating loop built for businesses managing their own workforce.",
    heroBadge: "Warehouse flow",
    heroMediaAlt: "Warehouse crew moving inventory across an active floor",
    summary:
      "Coverage for warehouse crews, logistics teams, and shift-based operations.",
    detail:
      "Use Workers Hive to coordinate receiving, picking, floor coverage, and site attendance across one or more operating locations.",
    rolesTitle: "From receivers to forklift crews, we have the floor covered",
    rolesIntro:
      "Keep supervisors, floor teams, and site-based workers aligned without turning shift operations into a spreadsheet handoff.",
    roles: [
      "Receiving teams",
      "Pickers",
      "Packers",
      "Forklift operators",
      "Loaders",
      "Inventory crew",
      "Dock supervisors",
      "Shift leads",
    ],
    heroChips: [
      {
        label: "Multi-site floors",
        detail: "Keep each facility and dock in the same operating system.",
      },
      {
        label: "Live floor shifts",
        detail: "Publish once coverage and headcount are actually ready.",
      },
      {
        label: "Verified attendance",
        detail: "Review the shift record before the day gets approved.",
      },
    ],
    workflowTitle: "Built for warehouse work that changes by the hour",
    workflowDescription:
      "Use one clear workflow for supervisors, shift leads, and floor crews instead of piecing together planning, attendance, and approvals in separate tools.",
    workflowPoints: [
      {
        title: "Set up each facility and grant supervisor access",
        body:
          "Admins set up the warehouse workspace and give managers or supervisors the right business-side access before shift planning starts.",
      },
      {
        title: "Publish floor shifts when headcount is final",
        body:
          "Build the lineup, assign the team, and publish live floor coverage only when the plan is ready for workers to act on.",
      },
      {
        title: "Close the loop on attendance before approval",
        body:
          "Workers record attendance from mobile and managers review corrections before the final shift record is approved.",
      },
    ],
    ctaTitle: "Ready to run warehouse shifts with less scramble?",
    ctaDescription:
      "Set up the business workspace, add floor teams through workforce access, and publish the schedule when the operation is ready.",
    posterSrc:
      "https://images.pexels.com/photos/17229385/pexels-photo-17229385.jpeg?cs=srgb&dl=pexels-manduko-17229385.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/31751344/",
  },
  {
    slug: "food-beverage",
    title: "Restaurants",
    pageTitle: "Food & Beverage Scheduling Software | Workers Hive",
    metaDescription:
      "Workers Hive helps restaurants, bars, and dining facilities manage workforce access, publish shifts, and review attendance from one operating system.",
    heroTitle: "Run food service teams",
    heroAccent: "without shift chaos",
    heroDescription:
      "Workers Hive helps restaurants, bars, caterers, and dining facilities set up workforce access, publish live shifts, and review attendance from one operating loop.",
    heroBadge: "Food & beverage flow",
    heroMediaAlt: "Bartender preparing drinks during live service",
    summary:
      "A cleaner operating flow for service teams, kitchen shifts, and day-to-day coordination.",
    detail:
      "Restaurant groups can separate manager access from worker access, publish live shifts, and keep attendance reviewable across prep, service, and close.",
    rolesTitle: "From bartenders to prep cooks, we have service covered",
    rolesIntro:
      "Use one clear system for front-of-house, back-of-house, and shift leads without falling back to text threads and spreadsheet swaps.",
    roles: [
      "Bartenders",
      "Servers",
      "Line cooks",
      "Prep cooks",
      "Hosts",
      "Bussers",
      "Dishwashers",
      "Shift leads",
    ],
    heroChips: [
      {
        label: "Manager access",
        detail: "Keep supervisors in the workspace and workers in the mobile flow.",
      },
      {
        label: "Published service shifts",
        detail: "Go live only when prep, service, and close are actually locked.",
      },
      {
        label: "Reviewable corrections",
        detail: "Fix attendance issues before the shift record is finalized.",
      },
    ],
    workflowTitle: "Built for teams moving from prep to service to close",
    workflowDescription:
      "Use one operating rhythm for staffing the floor, publishing the shift, and approving final attendance after service ends.",
    workflowPoints: [
      {
        title: "Separate business access from worker access",
        body:
          "Managers and supervisors get workspace access through team invites, while service staff access the mobile experience through workforce setup and phone verification.",
      },
      {
        title: "Publish shifts when service is ready",
        body:
          "Build the schedule, assign the team, and publish only when the lineup is final so workers see one clear source of truth.",
      },
      {
        title: "Run attendance without back-and-forth",
        body:
          "Workers clock in and out on mobile, and correction requests can be reviewed before the final shift is approved.",
      },
    ],
    ctaTitle: "Ready to run restaurant shifts with less friction?",
    ctaDescription:
      "Start with a business workspace, add your team, and publish the schedule when service is ready.",
    posterSrc:
      "https://images.pexels.com/photos/19674061/pexels-photo-19674061.jpeg?cs=srgb&dl=pexels-alexandru-cojanu-828538450-19674061.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/7593094/",
  },
  {
    slug: "bars-nightlife",
    title: "Bars & nightlife",
    pageTitle: "Bar & Nightlife Scheduling Software | Workers Hive",
    metaDescription:
      "Workers Hive helps bars and nightlife teams publish live shifts, coordinate late-service coverage, and review attendance after the rush.",
    heroTitle: "Keep late-service teams aligned",
    heroAccent: "after the rush starts",
    heroDescription:
      "Bars, lounges, and nightlife venues need clean handoffs, visible shift coverage, and attendance that still makes sense after close.",
    heroBadge: "Late-shift flow",
    heroMediaAlt: "Bar staff working service late into the evening",
    summary:
      "Useful for late shifts, handoffs, and attendance when service picks up fast.",
    detail:
      "Night teams benefit from clear handoffs, shift visibility, and mobile attendance records that do not get lost in closing-hour chaos.",
    rolesTitle: "From bartenders to closers, we have the late shift covered",
    rolesIntro:
      "Run the handoff from open to close with one source of truth for who is scheduled, who actually worked, and what needs approval.",
    roles: [
      "Bartenders",
      "Barbacks",
      "Servers",
      "Door staff",
      "Floor hosts",
      "Bottle service",
      "Security leads",
      "Closers",
    ],
    heroChips: [
      {
        label: "Late-shift coverage",
        detail: "Keep openers, rush coverage, and closers in one visible plan.",
      },
      {
        label: "Cleaner handoffs",
        detail: "Make last-minute swaps easier to track before the night starts.",
      },
      {
        label: "Post-close approval",
        detail: "Review attendance after the shift instead of guessing the next day.",
      },
    ],
    workflowTitle: "Built for service that moves faster after dark",
    workflowDescription:
      "Use the same operating loop even when traffic spikes, responsibilities split, and the real close happens later than planned.",
    workflowPoints: [
      {
        title: "Give leads and managers the right workspace access",
        body:
          "Keep business-side permissions with the people running the room while frontline staff stay in the worker attendance flow.",
      },
      {
        title: "Publish the lineup before the rush begins",
        body:
          "Lock the late-service shift, assign the team, and make sure workers are seeing the final live version of the night.",
      },
      {
        title: "Review what happened before approving the night",
        body:
          "Clock-ins, clock-outs, and correction requests stay visible so the final shift record does not depend on memory.",
      },
    ],
    ctaTitle: "Ready to tighten late-shift operations?",
    ctaDescription:
      "Bring front-of-house, bar service, and closing coverage into one scheduling and attendance workflow.",
    posterSrc:
      "https://images.pexels.com/photos/19674061/pexels-photo-19674061.jpeg?cs=srgb&dl=pexels-alexandru-cojanu-828538450-19674061.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/7593094/",
  },
  {
    slug: "hotels-hospitality",
    title: "Hotels & hospitality",
    pageTitle: "Hotel Scheduling Software | Workers Hive",
    metaDescription:
      "Workers Hive helps hospitality teams coordinate housekeeping, guest-facing work, and verified shift attendance across one or more properties.",
    heroTitle: "Coordinate guest-facing teams",
    heroAccent: "without chasing updates",
    heroDescription:
      "Hotels and hospitality operators need one system for housekeeping, front desk, support work, and attendance review across the property.",
    heroBadge: "Hospitality flow",
    heroMediaAlt: "Housekeeping worker preparing a guest room",
    summary:
      "Supports teams managing room-ready work, guest operations, and shift accountability.",
    detail:
      "Hospitality operators can coordinate housekeeping, front desk, and support staff while keeping who was scheduled and who actually worked easy to review.",
    rolesTitle: "From housekeeping to front desk, we have guest operations covered",
    rolesIntro:
      "Keep room-ready work, guest-facing coverage, and support teams moving together without losing the record of who actually worked.",
    roles: [
      "Housekeeping",
      "Front desk",
      "Night audit",
      "Porters",
      "Banquet staff",
      "Laundry teams",
      "Maintenance support",
      "Supervisors",
    ],
    heroChips: [
      {
        label: "Property setup",
        detail: "Keep buildings, departments, and supervisor access organized.",
      },
      {
        label: "Department coverage",
        detail: "Plan housekeeping, guest support, and event support in one flow.",
      },
      {
        label: "Shift accountability",
        detail: "Review attendance before payroll-facing approval decisions are made.",
      },
    ],
    workflowTitle: "Built for properties running across departments",
    workflowDescription:
      "Use one operating system for teams that hand work across departments instead of letting each group manage coverage in isolation.",
    workflowPoints: [
      {
        title: "Set up the property and supervisor structure",
        body:
          "Admins configure the workspace and give department leads the right business-side access before shifts go live.",
      },
      {
        title: "Publish the schedule across guest-facing teams",
        body:
          "Make the final shift plan visible to workers only after housekeeping, front desk, and support coverage are ready.",
      },
      {
        title: "Review corrections before the day is closed",
        body:
          "Attendance stays reviewable when coverage changes, rooms run late, or support work extends beyond the original plan.",
      },
    ],
    ctaTitle: "Ready to run property operations with less friction?",
    ctaDescription:
      "Set up departments, add workforce access, and publish live coverage from one hospitality workflow.",
    posterSrc:
      "https://images.pexels.com/photos/9462737/pexels-photo-9462737.jpeg?cs=srgb&dl=pexels-liliana-drew-9462737.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/6466563/",
  },
  {
    slug: "retail-grocery",
    title: "Retail & grocery",
    pageTitle: "Retail Scheduling Software | Workers Hive",
    metaDescription:
      "Workers Hive helps retail and grocery teams manage store coverage, workforce access, and attendance approvals across active locations.",
    heroTitle: "Run store coverage",
    heroAccent: "without daily reshuffling",
    heroDescription:
      "Retail and grocery teams need to see who is assigned, who showed up, and where store coverage still needs attention across the day.",
    heroBadge: "Retail flow",
    heroMediaAlt: "Retail worker stocking shelves in a grocery aisle",
    summary:
      "Better for teams juggling store hours, coverage gaps, and verified shift attendance.",
    detail:
      "Retail teams can run store schedules, track site-based work, and avoid losing the operational thread between planning, attendance, and approvals.",
    rolesTitle: "From cashiers to stock teams, we have the shift covered",
    rolesIntro:
      "Keep floor coverage, backroom work, and store support in one scheduling and attendance flow that still works during busy hours.",
    roles: [
      "Cashiers",
      "Stock associates",
      "Pickers",
      "Merchandisers",
      "Receivers",
      "Service desk",
      "Department leads",
      "Shift managers",
    ],
    heroChips: [
      {
        label: "Store coverage",
        detail: "See open, mid, and close coverage across the trading day.",
      },
      {
        label: "Worker access",
        detail: "Keep supervisors in the workspace and store workers in mobile.",
      },
      {
        label: "Attendance review",
        detail: "Close the shift record with fewer last-minute questions.",
      },
    ],
    workflowTitle: "Built for stores balancing coverage, hours, and footfall",
    workflowDescription:
      "Use one operating loop for schedule changes, site-based attendance, and approvals instead of rebuilding the picture at the end of each shift.",
    workflowPoints: [
      {
        title: "Set up locations and department leads",
        body:
          "Keep the store structure clean so the people running coverage have the right access before shifts are published.",
      },
      {
        title: "Publish live shifts once the floor plan is ready",
        body:
          "Workers should only see the shift after the actual store coverage plan is final, not while changes are still moving.",
      },
      {
        title: "Review what happened before approving hours",
        body:
          "Clock activity and correction requests stay reviewable so final approvals do not depend on after-the-fact guesswork.",
      },
    ],
    ctaTitle: "Ready to run store shifts with more control?",
    ctaDescription:
      "Plan store coverage, add workforce access, and keep attendance reviewable across every trading day.",
    posterSrc:
      "https://images.pexels.com/photos/10907746/pexels-photo-10907746.jpeg?cs=srgb&dl=pexels-laudiatsr-10907746.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/36074343/",
  },
  {
    slug: "cleaning-janitorial",
    title: "Cleaning & janitorial",
    pageTitle: "Cleaning & Janitorial Scheduling Software | Workers Hive",
    metaDescription:
      "Workers Hive helps cleaning and janitorial teams manage site coverage, workforce access, and verified attendance across recurring work.",
    heroTitle: "Keep site teams accountable",
    heroAccent: "across every property",
    heroDescription:
      "Cleaning and janitorial teams need repeatable scheduling, clear site-based attendance, and a simple way to review corrections before work is approved.",
    heroBadge: "Site-support flow",
    heroMediaAlt: "Cleaning worker handling site support tasks",
    summary:
      "Helps site-based support teams run scheduled work with clearer accountability.",
    detail:
      "Cleaning and facility-support teams can manage recurring work, multi-site coverage, and correction review without relying on scattered text messages or spreadsheets.",
    rolesTitle: "From cleaners to floor techs, we have every site covered",
    rolesIntro:
      "Run recurring site work with one system for scheduling, attendance, and approval instead of rebuilding the shift record from messages.",
    roles: [
      "Janitors",
      "Cleaners",
      "Floor techs",
      "Day porters",
      "Site leads",
      "Inspectors",
      "Maintenance support",
      "Supervisors",
    ],
    heroChips: [
      {
        label: "Recurring work",
        detail: "Keep repeat schedules and one-off coverage in the same flow.",
      },
      {
        label: "Multi-site teams",
        detail: "Manage properties, zones, and support leads from one workspace.",
      },
      {
        label: "Verified presence",
        detail: "Review attendance before the business closes the shift record.",
      },
    ],
    workflowTitle: "Built for recurring work that depends on verified attendance",
    workflowDescription:
      "Use one operating loop for site scheduling, worker access, and shift approval across properties that run on repeatable support work.",
    workflowPoints: [
      {
        title: "Set up properties and site leads first",
        body:
          "Keep each property and supervisor mapped cleanly so the business knows who is running the work before shifts go live.",
      },
      {
        title: "Publish the schedule when each site is ready",
        body:
          "Workers should only see live assignments after the property coverage plan is final and ready to execute.",
      },
      {
        title: "Review attendance before closing recurring work",
        body:
          "Correction requests stay reviewable when site work changes, coverage shifts, or timing needs to be adjusted after the fact.",
      },
    ],
    ctaTitle: "Ready to run site-support work with less admin?",
    ctaDescription:
      "Bring recurring work, workforce access, and verified attendance into one janitorial operating workflow.",
    posterSrc:
      "https://images.pexels.com/photos/34516670/pexels-photo-34516670.jpeg?cs=srgb&dl=pexels-caleboquendo-34516670.jpg&fm=jpg",
    videoSrc: "https://www.pexels.com/download/video/6197060/",
  },
] as const;

export type IndustryHighlight = {
  slug: string;
  title: string;
  summary: string;
  detail: string;
  posterSrc: string;
  videoSrc: string;
  href: string;
};

export const industryHighlights: readonly IndustryHighlight[] = industryPages.map(
  ({ slug, title, summary, detail, posterSrc, videoSrc }) => ({
    slug,
    title,
    summary,
    detail,
    posterSrc,
    videoSrc,
    href: `/industries/${slug}`,
  }),
);

export function getIndustryPage(slug: string) {
  return industryPages.find((industry) => industry.slug === slug);
}
