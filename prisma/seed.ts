/*
 * Seed: a plausible knowledge base for a custom home builder.
 *
 * Two software categories (Buildertrend, QuickBooks Online) with modules,
 * two process categories (Finance, Procurement) with areas, twenty entries
 * at varying completeness, and twelve skills with transcripts.
 *
 * Wipes and recreates all content on every run; users survive via upsert.
 * Skill videos point at Google's public sample MP4s so the future player
 * has something real to play — they stand in for screen recordings.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { initialsFor } from "../src/lib/users";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SECTION_KINDS = ["WHAT", "WHY", "HOW", "WHO", "WHEN"] as const;
type Kind = (typeof SECTION_KINDS)[number];

const VIDEO_BASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// A tiny but valid single-page PDF, so seeded DOCUMENT blocks download.
function minimalPdf(title: string): Buffer {
  const esc = title.replace(/([()\\])/g, "\\$1");
  const stream =
    `BT /F1 16 Tf 72 720 Td (${esc}) Tj ET\n` +
    `BT /F1 10 Tf 72 698 Td (Placeholder document seeded by prisma/seed.ts) Tj ET`;
  const objects = [
    "",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += objects[i];
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

type SkillSeed = {
  title: string;
  video: string; // filename in the sample bucket
  durationSeconds: number;
  transcript?: string;
  segments?: { t: number; text: string }[];
  chapters?: { t: number; label: string }[];
  sop?: { text: string; required: boolean }[];
};

type BlockSeed = {
  section: Kind;
  type: "DOCUMENT" | "WORKFLOW" | "VIDEO" | "SOP" | "LINK" | "FILE";
  payload: Prisma.InputJsonValue;
};

type EntrySeed = {
  title: string;
  summary?: string;
  template: "PROCESS" | "FEATURE";
  category: string;
  subcategory: string;
  owner: string; // email
  status?: "draft" | "published" | "archived";
  difficulty?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  reviewedDaysAgo?: number;
  reviewIntervalDays?: number;
  sections?: Partial<Record<Kind, string>>;
  blocks?: BlockSeed[];
  skills?: SkillSeed[];
  tags?: string[];
  approvers?: string[];
  contacts?: string[];
};

const USERS = [
  { name: "Manpreet Sidhu", email: "manpreet@caizenhomes.com" },
  { name: "Jaspreet Gill", email: "jaspreet@caizenhomes.com" },
  { name: "Amrit Dhillon", email: "amrit@caizenhomes.com" },
  { name: "Sofia Martinez", email: "sofia@caizenhomes.com" },
  { name: "Daniel Chen", email: "daniel@caizenhomes.com" },
  { name: "Dev User", email: "dev@caizenhomes.com" },
];

const TAXONOMY = [
  {
    name: "Buildertrend",
    slug: "buildertrend",
    kind: "SOFTWARE" as const,
    icon: "hammer",
    description: "Construction management — scheduling, daily logs, change orders and selections.",
    subs: [
      { name: "Schedules", slug: "schedules", description: "Build schedules, phases and trade assignments." },
      { name: "Daily logs", slug: "daily-logs", description: "Site reporting: progress, photos, weather and delays." },
      { name: "Change orders", slug: "change-orders", description: "Client-requested changes, pricing and signatures." },
      { name: "Selections", slug: "selections", description: "Client finish selections and their deadlines." },
    ],
  },
  {
    name: "QuickBooks Online",
    slug: "quickbooks-online",
    kind: "SOFTWARE" as const,
    icon: "calculator",
    description: "Accounting — invoicing, bills, bank feeds and reporting.",
    subs: [
      { name: "Invoicing", slug: "invoicing", description: "Client invoices, progress billing and holdbacks." },
      { name: "Bills & expenses", slug: "bills-expenses", description: "Subcontractor and supplier bills, job costing." },
      { name: "Bank feeds", slug: "bank-feeds", description: "Matching deposits and payments to records." },
      { name: "Reports", slug: "reports", description: "Job profitability and financial reporting." },
    ],
  },
  {
    name: "Finance",
    slug: "finance",
    kind: "PROCESS" as const,
    icon: "landmark",
    description: "How money moves: close, payables and job costing.",
    subs: [
      { name: "Month-end close", slug: "month-end-close", description: "The monthly close cycle and reconciliations." },
      { name: "Accounts payable", slug: "accounts-payable", description: "Paying subcontractors and suppliers." },
      { name: "Job costing", slug: "job-costing", description: "Cost codes and build budgets." },
    ],
  },
  {
    name: "Procurement",
    slug: "procurement",
    kind: "PROCESS" as const,
    icon: "package",
    description: "Vendors, purchase orders and site deliveries.",
    subs: [
      { name: "Vendor onboarding", slug: "vendor-onboarding", description: "Bringing on new trades and suppliers." },
      { name: "Purchase orders", slug: "purchase-orders", description: "Committing spend the controlled way." },
      { name: "Site deliveries", slug: "site-deliveries", description: "Receiving materials on site." },
    ],
  },
];

const ENTRIES: EntrySeed[] = [
  // ---------------------------------------------------------- Buildertrend
  {
    title: "Build a schedule from the master template",
    summary: "Start every new build from the master schedule template instead of a blank calendar — it carries our phase order, durations and trade dependencies.",
    template: "FEATURE",
    category: "buildertrend",
    subcategory: "schedules",
    owner: "sofia@caizenhomes.com",
    status: "published",
    difficulty: "INTERMEDIATE",
    reviewedDaysAgo: 30,
    reviewIntervalDays: 180,
    tags: ["scheduling", "templates"],
    approvers: ["manpreet@caizenhomes.com"],
    sections: {
      WHAT: "Creates a full construction schedule for a new job by copying the master template (about 140 items across excavation, foundation, framing, mechanicals, insulation, drywall, finishing and closing) and shifting every date from the actual start date.",
      WHY: "A schedule built from scratch always misses a dependency — inspections before insulation, HVAC rough-in before drywall. The template encodes the order we learned the hard way. Starting from it means a new job is scheduled in twenty minutes, not an afternoon, and nothing load-bearing is forgotten.",
      HOW: "Two recordings below: creating the schedule from the template, then assigning trades to phases.",
      WHO: "Site supervisors build the schedule; the project manager approves it before it goes live to trades.",
      WHEN: "As soon as permits are issued and before any trade is booked. Revisit after each phase inspection.",
    },
    skills: [
      {
        title: "Create the schedule from the master template",
        video: "BigBuckBunny.mp4",
        durationSeconds: 148,
        transcript:
          "Open the job, go to Schedule, and instead of adding items choose Import from template. Pick Caizen master schedule v4 — not the old v3, it still has the two-week drywall duration. Set the start date to the day excavation actually begins, not the permit date. Buildertrend shifts every item from that anchor. Before saving, scan the phase list once: on an infill lot, delete the well and septic items. Save, and the schedule is live but not yet visible to subs — that happens when you assign trades.",
        segments: [
          { t: 0, text: "Open the job, go to Schedule, and instead of adding items choose Import from template." },
          { t: 16, text: "Pick Caizen master schedule v4 — not the old v3, it still has the two-week drywall duration." },
          { t: 38, text: "Set the start date to the day excavation actually begins, not the permit date." },
          { t: 55, text: "Buildertrend shifts every item from that anchor." },
          { t: 66, text: "Before saving, scan the phase list once: on an infill lot, delete the well and septic items." },
          { t: 102, text: "Save, and the schedule is live but not yet visible to subs — that happens when you assign trades." },
        ],
        chapters: [
          { t: 0, label: "Import from template" },
          { t: 38, label: "Anchor the start date" },
          { t: 66, label: "Trim items that don't apply" },
          { t: 102, label: "Save without notifying" },
        ],
      },
      {
        title: "Assign trades to schedule phases",
        video: "ElephantsDream.mp4",
        durationSeconds: 121,
        transcript:
          "With the schedule saved, filter by phase and multi-select the items for one trade — all the framing items, say. Use Assign, pick the sub from the contact list, and leave Notify unchecked until the whole schedule is assigned. When every phase has a trade, do one pass of Notify all. Subs get a single summary email instead of forty separate ones, which is the difference between them reading it and them ignoring it.",
        segments: [
          { t: 0, text: "With the schedule saved, filter by phase and multi-select the items for one trade — all the framing items, say." },
          { t: 24, text: "Use Assign, pick the sub from the contact list, and leave Notify unchecked until the whole schedule is assigned." },
          { t: 58, text: "When every phase has a trade, do one pass of Notify all." },
          { t: 74, text: "Subs get a single summary email instead of forty separate ones, which is the difference between them reading it and them ignoring it." },
        ],
      },
    ],
  },
  {
    title: "Link schedule items so a delay pushes everything downstream",
    summary: "Predecessor links make one slipped date ripple through the whole schedule automatically.",
    template: "FEATURE",
    category: "buildertrend",
    subcategory: "schedules",
    owner: "sofia@caizenhomes.com",
    status: "published",
    difficulty: "BEGINNER",
    sections: {
      WHAT: "Connects schedule items with predecessor links so that moving one item shifts everything that depends on it, keeping the whole schedule honest when weather or an inspection slips a date.",
      HOW: "One recording: linking predecessors on the framing-to-drywall chain.",
    },
    skills: [
      {
        title: "Link predecessor tasks",
        video: "ForBiggerBlazes.mp4",
        durationSeconds: 84,
        transcript:
          "Edit any schedule item and open the Predecessors tab. Add the item that must finish first — drywall's predecessor is insulation inspection, not insulation. Chain the critical path items this way. Now drag the framing end date out three days and watch everything downstream move with it. If something didn't move, it's missing a link; fix it now, not when it bites.",
      },
    ],
  },
  {
    title: "File a daily log with site photos",
    summary: "The daily log is the project's memory: progress, people on site, weather, and photos, captured in five minutes before leaving site.",
    template: "FEATURE",
    category: "buildertrend",
    subcategory: "daily-logs",
    owner: "sofia@caizenhomes.com",
    status: "published",
    difficulty: "BEGINNER",
    reviewedDaysAgo: 45,
    reviewIntervalDays: 180,
    tags: ["site-reports"],
    sections: {
      WHAT: "Files the structured end-of-day site report: work done, trades on site with headcounts, weather, deliveries received and photos of progress and problems.",
      WHY: "When a client disputes a delay or a trade disputes what was ready, the daily log is the record we stand on. Insurance and warranty claims have been won on the strength of a dated photo. An unfiled log is a day we cannot prove.",
      HOW: "Two recordings: filing the log itself, and tagging weather delays so they roll up in reporting.",
      WHO: "Whoever closes the site that day files it — usually the site supervisor. Anyone can read them.",
      WHEN: "Every working day before leaving site, including days a no-show means nothing happened — that is exactly what we need recorded.",
    },
    skills: [
      {
        title: "Write and photo-attach a daily log",
        video: "ForBiggerEscapes.mp4",
        durationSeconds: 132,
        transcript:
          "From the job, open Daily Logs and add today's. Work completed goes in plain sentences — what got done and by whom, not adjectives. Record each trade with a headcount. Attach photos straight from the phone camera roll: wide shot of each active area, close-up of anything you would want proof of later. Flooded window well, cracked truss, tidy insulation — photograph it the day you see it. Save and it timestamps.",
        segments: [
          { t: 0, text: "From the job, open Daily Logs and add today's." },
          { t: 12, text: "Work completed goes in plain sentences — what got done and by whom, not adjectives." },
          { t: 31, text: "Record each trade with a headcount." },
          { t: 44, text: "Attach photos straight from the phone camera roll: wide shot of each active area, close-up of anything you would want proof of later." },
          { t: 78, text: "Flooded window well, cracked truss, tidy insulation — photograph it the day you see it." },
          { t: 105, text: "Save and it timestamps." },
        ],
        chapters: [
          { t: 0, label: "Open today's log" },
          { t: 12, label: "Work and headcounts" },
          { t: 44, label: "Photos that prove things" },
          { t: 105, label: "Save" },
        ],
      },
      {
        title: "Tag weather delays in a daily log",
        video: "ForBiggerFun.mp4",
        durationSeconds: 66,
        transcript:
          "In the log's weather section, pick conditions and then check Weather delay if trades stood down or left early. Write which phase lost time and how many hours. These tags feed the delay report we lean on when extending a client's completion date — untagged weather is a delay we absorb for free.",
      },
    ],
  },
  {
    title: "Create a change order and send it for signature",
    summary: "Every client change gets priced and signed in Buildertrend before anyone builds it. No signature, no work.",
    template: "FEATURE",
    category: "buildertrend",
    subcategory: "change-orders",
    owner: "daniel@caizenhomes.com",
    status: "published",
    difficulty: "INTERMEDIATE",
    tags: ["change-orders", "e-signature"],
    approvers: ["manpreet@caizenhomes.com"],
    sections: {
      WHAT: "Turns a client request — moved wall, upgraded countertop, added pot lights — into a priced change order document that the client signs electronically before the work is scheduled.",
      WHY: "Unsigned changes are how builds lose money quietly. A signed change order is the only version of the conversation that counts at final invoice, and it protects the client as much as us: they know the price before the drywall is open.",
      HOW: "Two recordings: drafting and pricing the change order, then sending it for e-signature. The SOP under the first recording is the pre-send checklist.",
      WHO: "Sales or the project manager drafts; Manpreet approves anything over $5,000 before it goes to the client.",
      WHEN: "The moment a change is requested — before it reaches the schedule or a trade hears about it.",
    },
    skills: [
      {
        title: "Draft a change order from a client request",
        video: "ForBiggerJoyrides.mp4",
        durationSeconds: 156,
        transcript:
          "From the job, open Change Orders and add a new one. Title it the way the client said it — upgrade kitchen counters to quartz — so they recognize it when it lands. Line items: materials with the supplier quote attached, labour from the trade's price, then our markup line. Set the schedule impact in days even when it is zero, because zero in writing ends arguments. Attach the supplier quote PDF. Preview as client before anything else.",
        segments: [
          { t: 0, text: "From the job, open Change Orders and add a new one." },
          { t: 14, text: "Title it the way the client said it — upgrade kitchen counters to quartz — so they recognize it when it lands." },
          { t: 39, text: "Line items: materials with the supplier quote attached, labour from the trade's price, then our markup line." },
          { t: 82, text: "Set the schedule impact in days even when it is zero, because zero in writing ends arguments." },
          { t: 110, text: "Attach the supplier quote PDF. Preview as client before anything else." },
        ],
        chapters: [
          { t: 0, label: "New change order" },
          { t: 39, label: "Price the lines" },
          { t: 82, label: "Schedule impact" },
          { t: 110, label: "Preview as client" },
        ],
        sop: [
          { text: "Title matches the client's own words for the change", required: true },
          { text: "Every line item priced — no TBD rows", required: true },
          { text: "Supplier quote attached for material lines", required: true },
          { text: "Schedule impact stated in days, even if zero", required: true },
          { text: "Over $5,000: approved by Manpreet before sending", required: true },
          { text: "Previewed as the client sees it", required: false },
        ],
      },
      {
        title: "Send a change order for e-signature",
        video: "ForBiggerMeltdowns.mp4",
        durationSeconds: 92,
        transcript:
          "With the draft ready, hit Release to client. Buildertrend emails them a link; they review the lines and sign on their phone. The status moves from Released to Approved when signed — nothing goes on the schedule until you see Approved. If a client stalls past three days, the reminder button is polite enough to use twice.",
      },
    ],
  },
  {
    title: "Approve or void a change order",
    template: "FEATURE",
    category: "buildertrend",
    subcategory: "change-orders",
    owner: "daniel@caizenhomes.com",
    status: "draft",
    sections: {
      WHAT: "Internal approval for change orders over the threshold, and voiding a change order that was superseded or declined — keeping the record straight without deleting history.",
    },
  },
  {
    title: "Set selection deadlines that follow the schedule",
    summary: "Selection deadlines tied to schedule phases chase clients automatically, so finishes are chosen before the trades need them.",
    template: "FEATURE",
    category: "buildertrend",
    subcategory: "selections",
    owner: "sofia@caizenhomes.com",
    status: "published",
    difficulty: "ADVANCED",
    sections: {
      WHAT: "Links each client selection — plumbing fixtures, tile, cabinet colour — to the schedule item that consumes it, with a deadline set far enough ahead of that item for ordering lead time.",
      WHY: "A late tile selection stalls the whole finishing sequence. Deadlines that move with the schedule mean a two-week framing delay quietly gives the client two more weeks on tile, and nobody has to recalculate anything.",
    },
    skills: [
      {
        title: "Tie selection deadlines to schedule phases",
        video: "Sintel.mp4",
        durationSeconds: 174,
        transcript:
          "Open the selection, and instead of a fixed deadline date choose Link to schedule item. Pick the item that consumes the selection — tile selection links to Tile install — and set the offset to the supplier's lead time plus a week of buffer. Tile is usually 21 days. From then on the deadline floats with the schedule. The client's portal shows the live date and Buildertrend nags them at fourteen, seven and one day out, which is exactly the right amount of nagging.",
        chapters: [
          { t: 0, label: "Link instead of a fixed date" },
          { t: 52, label: "Choose the consuming item" },
          { t: 96, label: "Offset by lead time" },
          { t: 138, label: "What the client sees" },
        ],
      },
    ],
  },

  // ------------------------------------------------------ QuickBooks Online
  {
    title: "Create a progress invoice from an estimate",
    summary: "Bill each draw as a percentage of the approved estimate, so invoices tie back to the contract line by line.",
    template: "FEATURE",
    category: "quickbooks-online",
    subcategory: "invoicing",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    difficulty: "INTERMEDIATE",
    reviewedDaysAgo: 20,
    reviewIntervalDays: 90,
    tags: ["invoicing", "holdback"],
    sections: {
      WHAT: "Creates a draw invoice from the job's approved estimate using progress invoicing — a percentage or fixed amount per line — instead of a free-typed invoice.",
      WHY: "Free-typed invoices drift from the contract and make the final reconciliation a forensic exercise. Progress invoices keep a running billed-to-date per line, so the fourth draw knows exactly what the first three covered.",
      HOW: "Two recordings: raising the draw from the estimate, then applying the construction holdback line.",
      WHO: "Finance raises draws; the project manager confirms site progress justifies the percentage first.",
      WHEN: "At each contract draw milestone — typically foundation, framing/lockup, drywall, and completion.",
    },
    skills: [
      {
        title: "Turn an estimate into a progress invoice",
        video: "SubaruOutbackOnStreetAndDirt.mp4",
        durationSeconds: 141,
        transcript:
          "Open the customer's estimate — it must be Accepted status. Choose Create invoice, and QuickBooks asks how much: total, a percentage, or custom per line. Draws are custom per line. Framing draw bills the framing and lumber lines at one hundred percent and leaves finishing at zero. The progress column shows billed-to-date per line so you can see what earlier draws consumed. Check the invoice total against the draw schedule in the contract before saving.",
        segments: [
          { t: 0, text: "Open the customer's estimate — it must be Accepted status." },
          { t: 15, text: "Choose Create invoice, and QuickBooks asks how much: total, a percentage, or custom per line." },
          { t: 36, text: "Draws are custom per line. Framing draw bills the framing and lumber lines at one hundred percent and leaves finishing at zero." },
          { t: 77, text: "The progress column shows billed-to-date per line so you can see what earlier draws consumed." },
          { t: 108, text: "Check the invoice total against the draw schedule in the contract before saving." },
        ],
        chapters: [
          { t: 0, label: "Start from the accepted estimate" },
          { t: 36, label: "Bill lines by draw" },
          { t: 77, label: "Billed-to-date column" },
          { t: 108, label: "Reconcile to the contract" },
        ],
      },
      {
        title: "Apply a holdback to a progress invoice",
        video: "TearsOfSteel.mp4",
        durationSeconds: 88,
        transcript:
          "Ontario construction holdback is ten percent until the lien period clears. On the draw invoice, add the Holdback line item — it is a negative service item mapped to the holdback liability account — at ten percent of the draw subtotal. The invoice shows the client the full value earned and the amount retained. When the lien period ends, a separate holdback release invoice bills the accumulated balance out of that account.",
      },
    ],
  },
  {
    title: "Match builder deposits in the bank feed",
    summary: "Client draw payments land as one deposit; match them to the right invoices instead of creating new income.",
    template: "FEATURE",
    category: "quickbooks-online",
    subcategory: "bank-feeds",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    difficulty: "BEGINNER",
    sections: {
      WHAT: "Matches incoming bank-feed deposits to their open invoices, including a single deposit that pays several invoices at once.",
      HOW: "One recording: matching one deposit across two invoices.",
      WHO: "Finance, during the morning bank-feed review.",
    },
    skills: [
      {
        title: "Match a deposit against two invoices",
        video: "VolkswagenGTIReview.mp4",
        durationSeconds: 97,
        transcript:
          "In the bank feed, a deposit QuickBooks cannot auto-match shows Review. Open it and switch to Find match. Tick the invoices it covers — here the framing draw and an earlier change order invoice — and the difference indicator must read zero before you confirm. Never use Add on a client payment: Add creates untracked income and the invoice stays open, which is how a paid client ends up getting a reminder.",
      },
    ],
  },
  {
    title: "Enter a subcontractor bill against a job",
    summary: "Bills carry the job and cost code so job costing stays true; the payment run pays them on terms.",
    template: "FEATURE",
    category: "quickbooks-online",
    subcategory: "bills-expenses",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    difficulty: "BEGINNER",
    tags: ["subcontractors", "job-costing"],
    sections: {
      WHAT: "Enters a received subcontractor or supplier bill with its job, cost code and terms, so it lands in job costing now and in the payment run at the right time.",
      WHY: "A bill without a job code is a cost no build ever admits to. Coding at entry is thirty seconds; reconstructing it at month-end is an hour of guesswork per bill.",
      HOW: "One recording covering entry and coding.",
      WHO: "Finance enters bills; the site supervisor confirms the work was actually completed before entry.",
      WHEN: "Within two days of the bill arriving, so early-payment discounts and net-30 clocks start from reality.",
    },
    skills: [
      {
        title: "Enter and job-cost a subcontractor bill",
        video: "WeAreGoingOnBullrun.mp4",
        durationSeconds: 119,
        transcript:
          "New bill, pick the vendor, and the terms fill from the vendor record — fix the vendor record if they don't. Date is the bill date, not today. One line per cost code: the electrician's rough-in bill splits between electrical rough-in and temporary power if that is what the bill says. Every line gets the customer-job. Attach the PDF of the bill itself. Save, and it is queued for the Thursday payment run automatically when its terms come due.",
        segments: [
          { t: 0, text: "New bill, pick the vendor, and the terms fill from the vendor record — fix the vendor record if they don't." },
          { t: 22, text: "Date is the bill date, not today." },
          { t: 33, text: "One line per cost code: the electrician's rough-in bill splits between electrical rough-in and temporary power if that is what the bill says." },
          { t: 68, text: "Every line gets the customer-job. Attach the PDF of the bill itself." },
          { t: 95, text: "Save, and it is queued for the Thursday payment run automatically when its terms come due." },
        ],
      },
    ],
  },
  {
    title: "Run the job profitability report",
    template: "FEATURE",
    category: "quickbooks-online",
    subcategory: "reports",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    sections: {
      WHAT: "Runs the per-job profit and loss that compares billed revenue against coded costs, the number the Friday review meeting starts from.",
    },
  },

  // ----------------------------------------------------------------- Finance
  {
    title: "Month-end close",
    summary: "The five-day cycle that turns a month of activity into statements we trust: reconcile, accrue, review, lock.",
    template: "PROCESS",
    category: "finance",
    subcategory: "month-end-close",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    reviewedDaysAgo: 15,
    reviewIntervalDays: 90,
    tags: ["month-end"],
    approvers: ["manpreet@caizenhomes.com"],
    sections: {
      WHAT: "The monthly closing cycle: every account reconciled, subcontractor accruals posted for work done but not yet billed, job costs reviewed against budget, and the period locked in QuickBooks by business day five.",
      WHY: "Draw decisions, trade negotiations and the bank's reporting covenant all run on these numbers. An unclosed month means every job profitability figure is provisional, and provisional numbers get argued with.",
      HOW: "The workflow below is the close in order. The checklist is the gate for locking the period — all required items, every month, no exceptions.",
      WHO: "Jaspreet runs the close. Manpreet reviews and approves the statements before the period locks. Site supervisors owe their final daily logs by day one, because accruals are built from them.",
      WHEN: "Starts the first business day after month end, locks by business day five. The review cadence on this entry is quarterly because the bank's requirements change.",
    },
    blocks: [
      {
        section: "HOW",
        type: "WORKFLOW",
        payload: {
          steps: [
            { id: "w1", label: "Final daily logs in", description: "Chase any site missing logs — accruals depend on them.", durationHint: "day 1" },
            { id: "w2", label: "Bank and credit card reconciliations", description: "Operating, payroll and card accounts to statement.", durationHint: "day 1–2" },
            { id: "w3", label: "Subcontractor accruals", description: "Accrue work completed but unbilled, from daily logs and PO status.", durationHint: "day 2–3" },
            { id: "w4", label: "Job cost review", description: "Each active job's coded costs against budget; investigate anything over 5% off.", durationHint: "day 3–4" },
            { id: "w5", label: "Holdback account roll-forward", description: "Tie the holdback liability to the per-job schedule.", durationHint: "day 4" },
            { id: "w6", label: "Draft statements to Manpreet", description: "P&L, balance sheet and job summaries with notes on anything unusual.", durationHint: "day 4" },
            { id: "w7", label: "Lock the period", description: "Close the books in QuickBooks with the password, after approval.", durationHint: "day 5" },
          ],
        },
      },
      {
        section: "HOW",
        type: "SOP",
        payload: {
          items: [
            { id: "s1", text: "All bank and card accounts reconciled to statement", required: true },
            { id: "s2", text: "No unmatched bank feed lines older than the period", required: true },
            { id: "s3", text: "Subcontractor accruals posted and tied to daily logs", required: true },
            { id: "s4", text: "Job cost variances over 5% have a written explanation", required: true },
            { id: "s5", text: "Holdback liability ties to the per-job schedule", required: true },
            { id: "s6", text: "Statements approved by Manpreet", required: true },
            { id: "s7", text: "Period locked with close password", required: true },
          ],
        },
      },
      {
        section: "HOW",
        type: "DOCUMENT",
        payload: {
          fileId: "seed-month-end-close-checklist.pdf",
          filename: "Month-end close checklist.pdf",
          mimeType: "application/pdf",
          sizeBytes: 0, // patched after the file is written
        },
      },
    ],
  },
  {
    title: "Reconcile the operating account",
    summary: "Statement to QuickBooks, line by line, the first business day after the statement lands.",
    template: "PROCESS",
    category: "finance",
    subcategory: "month-end-close",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    reviewedDaysAgo: 200,
    reviewIntervalDays: 90,
    tags: ["month-end"],
    sections: {
      WHAT: "Reconciles the RBC operating account against the bank statement in QuickBooks — every statement line matched, every book entry accounted for, ending balances equal.",
      HOW: "1. Banking → Reconcile, pick the operating account, enter the statement ending date and balance.\n2. Work the statement top to bottom; anything unmatched in the feed gets resolved now, not suspended.\n3. Outstanding cheques older than 60 days: chase the payee or void and reissue.\n4. Difference must be $0.00 — a reconciliation forced through with an adjustment is a problem hidden, not solved.\n5. Save the reconciliation report PDF to the finance drive.",
      WHEN: "First business day after the statement is available, ahead of the close cycle that depends on it.",
    },
    blocks: [
      {
        section: "HOW",
        type: "LINK",
        payload: {
          url: "https://quickbooks.intuit.com/learn-support/en-ca/help-article/banking/reconcile-account-quickbooks-online/L3XzsllsK_CA_en_CA",
          title: "QuickBooks: Reconcile an account",
          description: "Intuit's reference for the reconcile screen itself.",
        },
      },
    ],
  },
  {
    title: "Pay subcontractor invoices on net-30",
    summary: "One weekly payment run, invoices paid on terms, no side-channel e-transfers.",
    template: "PROCESS",
    category: "finance",
    subcategory: "accounts-payable",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    tags: ["subcontractors", "accounts-payable"],
    approvers: ["manpreet@caizenhomes.com"],
    sections: {
      WHAT: "The weekly payment run that pays subcontractor and supplier bills as they come due on net-30 terms, by EFT, every Thursday.",
      WHY: "Trades price reliability into their quotes. Paying on terms — not early under pressure, not late by neglect — is why our subs show up when a competitor's site sits empty. One predictable run also means one approval, one bank batch, and no Friday-afternoon e-transfer favours that skip job costing.",
      HOW: "The workflow below. Bills enter the run automatically when entered against the job with terms (see the QuickBooks entry for that).",
      WHO: "Jaspreet prepares the run; Manpreet approves the batch before it is released to the bank.",
      WHEN: "Every Thursday. Cut-off for inclusion is Wednesday noon.",
    },
    blocks: [
      {
        section: "HOW",
        type: "WORKFLOW",
        payload: {
          steps: [
            { id: "w1", label: "Pull bills due within 7 days", description: "Payables aging, filtered to due dates through next Thursday.", durationHint: "30 min" },
            { id: "w2", label: "Hold-check with site", description: "Any bill for disputed or incomplete work is held with a note to the vendor.", durationHint: "same day" },
            { id: "w3", label: "Batch approval", description: "Run summary to Manpreet; approval in writing.", durationHint: "Wed EOD" },
            { id: "w4", label: "Release EFT batch", description: "Payments released in RBC Express; remittances email automatically.", durationHint: "Thu am" },
            { id: "w5", label: "Mark paid and file", description: "Payments applied in QuickBooks against their bills.", durationHint: "Thu am" },
          ],
        },
      },
    ],
  },
  {
    title: "Set up cost codes for a new build",
    summary: "Every job starts with the standard cost code list, so cross-job comparison stays possible.",
    template: "PROCESS",
    category: "finance",
    subcategory: "job-costing",
    owner: "jaspreet@caizenhomes.com",
    status: "published",
    tags: ["job-costing"],
    sections: {
      WHAT: "Sets up a new job in QuickBooks with the standard Caizen cost code structure — 24 codes from site prep through landscaping — plus the budget per code from the estimate.",
      WHY: "Custom code lists per job feel flexible and destroy comparability. When every build codes framing the same way, we can answer whether framing costs are drifting across the year — the question that actually changes what we bid.",
    },
  },
  {
    title: "File the quarterly HST return",
    template: "PROCESS",
    category: "finance",
    subcategory: "month-end-close",
    owner: "jaspreet@caizenhomes.com",
    status: "draft",
    sections: {
      WHAT: "Quarterly HST filing: input tax credits on build costs against HST collected on draws, the new-housing rebate treatment, and the CRA My Business filing itself.",
    },
  },

  // -------------------------------------------------------------- Procurement
  {
    title: "Onboard a new trade or supplier",
    summary: "Insurance, WSIB and banking verified before the first PO — no paperwork, no site access.",
    template: "PROCESS",
    category: "procurement",
    subcategory: "vendor-onboarding",
    owner: "amrit@caizenhomes.com",
    status: "published",
    reviewedDaysAgo: 10,
    reviewIntervalDays: 180,
    tags: ["vendors", "compliance"],
    contacts: ["jaspreet@caizenhomes.com"],
    sections: {
      WHAT: "Brings a new subcontractor or supplier into the system: certificate of insurance, WSIB clearance, signed trade agreement, banking details for EFT, and vendor records in both Buildertrend and QuickBooks.",
      WHY: "An uninsured trade on site is an uncapped liability, and a WSIB lapse can transfer their premiums to us. The packet exists because we once learned both of these the expensive way in the same month.",
      HOW: "The workflow below, start to finish, before any PO is issued or site access granted. The checklist is what 'done' means.",
      WHO: "Amrit runs onboarding. Jaspreet verifies banking by callback — never from details in an email alone.",
      WHEN: "Triggered by the decision to use a new trade; takes two to five days depending on how fast their broker moves. Certificates are re-verified at each renewal date.",
    },
    blocks: [
      {
        section: "HOW",
        type: "WORKFLOW",
        payload: {
          steps: [
            { id: "w1", label: "Send the vendor packet", description: "Packet PDF with our requirements and the trade agreement.", durationHint: "day 0" },
            { id: "w2", label: "Certificate of insurance", description: "$2M commercial general liability minimum, Caizen Homes as additional insured.", durationHint: "from their broker" },
            { id: "w3", label: "WSIB clearance certificate", description: "Pulled live from the WSIB portal, not accepted as an attachment.", durationHint: "same day" },
            { id: "w4", label: "Signed trade agreement", description: "Payment terms, warranty and site rules.", durationHint: "1–2 days" },
            { id: "w5", label: "Banking verified by callback", description: "Jaspreet calls the number on record — not the number in the email — to confirm EFT details.", durationHint: "1 day" },
            { id: "w6", label: "Create vendor records", description: "Buildertrend contact and QuickBooks vendor with terms and default cost codes.", durationHint: "30 min" },
          ],
        },
      },
      {
        section: "HOW",
        type: "SOP",
        payload: {
          items: [
            { id: "s1", text: "COI on file: $2M CGL, Caizen listed as additional insured, current dates", required: true },
            { id: "s2", text: "WSIB clearance verified on the portal", required: true },
            { id: "s3", text: "Trade agreement signed by a principal of the company", required: true },
            { id: "s4", text: "Banking confirmed by callback to the number on record", required: true },
            { id: "s5", text: "Vendor created in QuickBooks with terms", required: true },
            { id: "s6", text: "Contact created in Buildertrend with trade type", required: true },
            { id: "s7", text: "Insurance renewal date in the tracking calendar", required: false },
          ],
        },
      },
      {
        section: "HOW",
        type: "DOCUMENT",
        payload: {
          fileId: "seed-vendor-onboarding-packet.pdf",
          filename: "Vendor onboarding packet.pdf",
          mimeType: "application/pdf",
          sizeBytes: 0, // patched after the file is written
        },
      },
    ],
  },
  {
    title: "Issue a purchase order",
    summary: "Committed spend gets a PO first: scope, price, job and cost code, before the vendor starts.",
    template: "PROCESS",
    category: "procurement",
    subcategory: "purchase-orders",
    owner: "amrit@caizenhomes.com",
    status: "published",
    tags: ["purchase-orders"],
    sections: {
      WHAT: "Issues a Buildertrend purchase order for materials or subcontracted scope: description, quantity, agreed price, job and cost code, sent to the vendor for acknowledgement.",
      WHY: "The PO is where the price is fixed while everyone still agrees on it. Bills that arrive against a PO reconcile themselves; bills that arrive against a phone call start negotiations.",
      HOW: "The short workflow below. Anything over $10,000 needs three quotes first — see the three-quote rule.",
      WHO: "Site supervisors raise POs for materials; Amrit raises trade-scope POs. Bills without a PO number go back to the vendor.",
      WHEN: "Before the vendor commits labour or orders material. A PO raised after the invoice arrives is paperwork theatre.",
    },
    blocks: [
      {
        section: "HOW",
        type: "WORKFLOW",
        payload: {
          steps: [
            { id: "w1", label: "Confirm budget line", description: "Check remaining budget on the job's cost code before committing.", durationHint: "5 min" },
            { id: "w2", label: "Raise the PO in Buildertrend", description: "Scope, quantities, unit prices, job and cost code.", durationHint: "10 min" },
            { id: "w3", label: "Send for vendor acknowledgement", description: "Vendor confirms price and delivery date in the portal.", durationHint: "same day" },
            { id: "w4", label: "Attach to the schedule item", description: "Link the PO to the phase that consumes it.", durationHint: "2 min" },
          ],
        },
      },
    ],
  },
  {
    title: "Three quotes for anything over $10,000",
    summary: "Larger commitments get three written quotes, apples to apples, before a PO is raised.",
    template: "PROCESS",
    category: "procurement",
    subcategory: "purchase-orders",
    owner: "amrit@caizenhomes.com",
    status: "published",
    tags: ["purchase-orders", "compliance"],
    sections: {
      WHAT: "Any single commitment over $10,000 — one PO or an obviously split series — requires three written quotes on the same scope sheet before the PO is raised. The chosen quote and the two others are attached to the PO.",
      WHY: "Not because trades are dishonest — because prices drift and relationships get comfortable. The rule keeps our regulars sharp and gives us a defensible answer when a client asks how their money was spent.",
      WHEN: "Before raising the PO. The exception is a genuine emergency — burst pipe, failed inspection blocking a closing — where Manpreet can waive it in writing, and the waiver is attached where the quotes would have been.",
    },
    blocks: [
      {
        section: "WHAT",
        type: "LINK",
        payload: {
          url: "https://caizenhomes.sharepoint.com/sites/procurement/quote-comparison-sheet",
          title: "Quote comparison sheet",
          description: "The scope sheet all three quotes are taken against.",
        },
      },
    ],
  },
  {
    title: "Receive and inspect a site delivery",
    summary: "Count it, check it, photograph it — before the driver leaves, not after.",
    template: "PROCESS",
    category: "procurement",
    subcategory: "site-deliveries",
    owner: "sofia@caizenhomes.com",
    status: "published",
    tags: ["site-deliveries"],
    sections: {
      WHAT: "Receives a material delivery on site: quantities counted against the PO, condition checked, discrepancies photographed and noted on the delivery slip before signing.",
      HOW: "Work through the checklist below for every delivery. A signed-clean slip with a shortage discovered later is a donation to the supplier.",
    },
    blocks: [
      {
        section: "HOW",
        type: "SOP",
        payload: {
          items: [
            { id: "s1", text: "Pull up the PO before the truck is unloaded", required: true },
            { id: "s2", text: "Count quantities against the PO lines, not the slip", required: true },
            { id: "s3", text: "Check condition — lumber crowns, damaged wrap, broken banding", required: true },
            { id: "s4", text: "Photograph anything short or damaged before signing", required: true },
            { id: "s5", text: "Write discrepancies on the slip above the signature", required: true },
            { id: "s6", text: "Attach slip photo to the day's daily log", required: true },
            { id: "s7", text: "Flag shortages to procurement the same day", required: true },
          ],
        },
      },
    ],
  },
  {
    title: "Confirm purchase orders by fax",
    summary: "Superseded: vendor acknowledgement now happens in the Buildertrend portal.",
    template: "PROCESS",
    category: "procurement",
    subcategory: "purchase-orders",
    owner: "amrit@caizenhomes.com",
    status: "archived",
    sections: {
      WHAT: "The old confirmation loop: print the PO, fax it to the vendor, file the fax confirmation sheet in the job binder as proof of acknowledgement.",
      WHY: "Kept for the record — several 2019–2021 job binders reference fax confirmation sheets, and this explains what those were.",
    },
  },
];

async function main(): Promise<void> {
  // Placeholder PDFs for seeded DOCUMENT blocks, written straight into the
  // dev uploads dir with stable ids so reseeding stays deterministic.
  const uploads = path.join(process.cwd(), "uploads");
  await mkdir(uploads, { recursive: true });
  const pdfSizes = new Map<string, number>();
  for (const [fileId, title] of [
    ["seed-month-end-close-checklist.pdf", "Month-end close checklist"],
    ["seed-vendor-onboarding-packet.pdf", "Vendor onboarding packet"],
  ] as const) {
    const buf = minimalPdf(title);
    await writeFile(path.join(uploads, fileId), buf);
    pdfSizes.set(fileId, buf.length);
  }

  // Wipe content (children before parents); users survive via upsert.
  await prisma.comment.deleteMany();
  await prisma.revision.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.entryTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.block.deleteMany();
  await prisma.section.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();

  const users = new Map<string, { id: string }>();
  for (const u of USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, avatarInitials: initialsFor(u.name) },
      create: { email: u.email, name: u.name, avatarInitials: initialsFor(u.name) },
    });
    users.set(u.email, row);
  }

  const subIds = new Map<string, { categoryId: string; subcategoryId: string }>();
  for (const [i, cat] of TAXONOMY.entries()) {
    const category = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        kind: cat.kind,
        icon: cat.icon,
        description: cat.description,
        order: i,
      },
    });
    for (const [j, sub] of cat.subs.entries()) {
      const subcategory = await prisma.subcategory.create({
        data: {
          categoryId: category.id,
          name: sub.name,
          slug: sub.slug,
          description: sub.description,
          order: j,
        },
      });
      subIds.set(`${cat.slug}/${sub.slug}`, {
        categoryId: category.id,
        subcategoryId: subcategory.id,
      });
    }
  }

  const tagIds = new Map<string, string>();
  const entryIds = new Map<string, string>();

  for (const seed of ENTRIES) {
    const dest = subIds.get(`${seed.category}/${seed.subcategory}`);
    if (!dest) throw new Error(`Unknown destination ${seed.category}/${seed.subcategory}`);
    const owner = users.get(seed.owner);
    if (!owner) throw new Error(`Unknown owner ${seed.owner}`);

    const entry = await prisma.entry.create({
      data: {
        title: seed.title,
        summary: seed.summary ?? "",
        template: seed.template,
        categoryId: dest.categoryId,
        subcategoryId: dest.subcategoryId,
        ownerId: owner.id,
        status: seed.status ?? "draft",
        difficulty: seed.difficulty,
        reviewedAt: seed.reviewedDaysAgo !== undefined ? daysAgo(seed.reviewedDaysAgo) : undefined,
        reviewIntervalDays: seed.reviewIntervalDays,
        sections: {
          create: SECTION_KINDS.map((kind, order) => ({
            kind,
            order,
            body: seed.sections?.[kind] ?? "",
          })),
        },
      },
      include: { sections: true },
    });
    entryIds.set(seed.title, entry.id);
    const sectionByKind = new Map(entry.sections.map((s) => [s.kind, s]));

    for (const [order, block] of (seed.blocks ?? []).entries()) {
      const section = sectionByKind.get(block.section);
      if (!section) throw new Error(`Missing section ${block.section}`);
      let payload = block.payload;
      // Patch real byte sizes into seeded document payloads.
      if (
        block.type === "DOCUMENT" &&
        typeof payload === "object" &&
        payload !== null &&
        "fileId" in payload &&
        pdfSizes.has(String(payload.fileId))
      ) {
        payload = { ...payload, sizeBytes: pdfSizes.get(String(payload.fileId)) };
      }
      await prisma.block.create({
        data: { sectionId: section.id, type: block.type, order, payload },
      });
    }

    for (const [order, skill] of (seed.skills ?? []).entries()) {
      let sopBlockId: string | undefined;
      if (skill.sop) {
        const how = sectionByKind.get("HOW");
        if (!how) throw new Error("Missing HOW section");
        const sopBlock = await prisma.block.create({
          data: {
            sectionId: how.id,
            type: "SOP",
            order: 100 + order, // after any authored HOW blocks
            payload: {
              items: skill.sop.map((item, i) => ({ id: `s${i + 1}`, ...item })),
            },
          },
        });
        sopBlockId = sopBlock.id;
      }
      await prisma.skill.create({
        data: {
          entryId: entry.id,
          title: skill.title,
          order,
          videoUrl: `${VIDEO_BASE}/${skill.video}`,
          durationSeconds: skill.durationSeconds,
          transcript: skill.transcript,
          transcriptSegments: skill.segments,
          chapters: skill.chapters,
          sopBlockId,
        },
      });
    }

    for (const label of seed.tags ?? []) {
      let tagId = tagIds.get(label);
      if (!tagId) {
        tagId = (await prisma.tag.create({ data: { label } })).id;
        tagIds.set(label, tagId);
      }
      await prisma.entryTag.create({ data: { entryId: entry.id, tagId } });
    }

    const assignments: { userId: string; role: "OWNER" | "APPROVER" | "CONTACT" }[] = [
      { userId: owner.id, role: "OWNER" },
    ];
    for (const email of seed.approvers ?? []) {
      assignments.push({ userId: users.get(email)!.id, role: "APPROVER" });
    }
    for (const email of seed.contacts ?? []) {
      assignments.push({ userId: users.get(email)!.id, role: "CONTACT" });
    }
    await prisma.assignment.createMany({
      data: assignments.map((a) => ({ ...a, entryId: entry.id })),
    });

    // Initial revision: the entry as created.
    const full = await prisma.entry.findUniqueOrThrow({
      where: { id: entry.id },
      include: {
        sections: { orderBy: { order: "asc" }, include: { blocks: { orderBy: { order: "asc" } } } },
        skills: { orderBy: { order: "asc" } },
        tags: { include: { tag: true } },
      },
    });
    await prisma.revision.create({
      data: {
        entryId: entry.id,
        authorId: owner.id,
        snapshot: {
          title: full.title,
          summary: full.summary,
          template: full.template,
          status: full.status,
          difficulty: full.difficulty,
          reviewIntervalDays: full.reviewIntervalDays,
          tags: full.tags.map((t) => t.tag.label),
          sections: full.sections.map((s) => ({
            kind: s.kind,
            body: s.body,
            blocks: s.blocks.map((b) => ({ type: b.type, payload: b.payload })),
          })),
          skills: full.skills.map((sk) => ({
            title: sk.title,
            videoUrl: sk.videoUrl,
            durationSeconds: sk.durationSeconds,
          })),
        } as Prisma.InputJsonValue,
      },
    });
  }

  // A few live comments so the reader and editor have something to render.
  const progressInvoiceId = entryIds.get("Create a progress invoice from an estimate")!;
  const howSection = await prisma.section.findUnique({
    where: { entryId_kind: { entryId: progressInvoiceId, kind: "HOW" } },
  });
  await prisma.comment.create({
    data: {
      entryId: progressInvoiceId,
      sectionId: howSection?.id,
      authorId: users.get("manpreet@caizenhomes.com")!.id,
      body: "Does the holdback step change now that Maple Grove bills through progress draws? Worth a note either way.",
    },
  });
  await prisma.comment.create({
    data: {
      entryId: entryIds.get("Month-end close")!,
      authorId: users.get("daniel@caizenhomes.com")!.id,
      body: "Added the holdback roll-forward step after last quarter's audit note.",
      resolved: true,
    },
  });
  await prisma.comment.create({
    data: {
      entryId: entryIds.get("Onboard a new trade or supplier")!,
      authorId: users.get("sofia@caizenhomes.com")!.id,
      body: "Can we add who to call when a trade shows up on site before their COI clears? It keeps happening.",
    },
  });

  const [entries, skills, docs] = await Promise.all([
    prisma.entry.count(),
    prisma.skill.count(),
    prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "SearchDoc"`,
  ]);
  console.log(
    `Seeded ${entries} entries, ${skills} skills, ${docs[0].n} search docs ` +
      `(expected docs: published+archived entries plus their skills).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
