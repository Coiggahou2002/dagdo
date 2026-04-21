// Generate the README hero graph in a given theme.
//
//   bun run scripts/gen-hero.ts       > docs/hero.svg        # light (default)
//   bun run scripts/gen-hero.ts dark  > docs/hero-dark.svg   # dark
//
// README uses <picture> with prefers-color-scheme to swap between them.

const W = 860;
const H = 640;
const NW = 160;
const NH = 52;
const R = 8;

type Theme = "light" | "dark";

interface Palette {
  bg: string;
  doneFill: string;
  doneStroke: string;
  doneText: string;
  blockedFill: string;
  blockedStroke: string;
  blockedText: string;
  blockedMeta: string;
  readyFill: string;
  readyText: string;
  readyMeta: string;
  priHigh: string;
  priMed: string;
  priLow: string;
  edgeLive: string;
  edgeDone: string;
  /** Flood colour for the blocked-card drop shadow. */
  shadowColor: string;
  shadowOpacity: number;
  /** Flood colour for the ready-node glow. */
  elevatedGlow: string;
  elevatedGlowOpacity: number;
}

// Linear-inspired light palette (mirrors web/src/styles.css).
const LIGHT: Palette = {
  bg: "#f7f8f8",
  doneFill: "#f3f4f5",
  doneStroke: "#d0d6e0",
  doneText: "#8a8f98",
  blockedFill: "#ffffff",
  blockedStroke: "rgba(0,0,0,0.08)",
  blockedText: "#1a1a1e",
  blockedMeta: "#62666d",
  readyFill: "#5e6ad2",
  readyText: "#ffffff",
  readyMeta: "rgba(255,255,255,0.78)",
  priHigh: "#e5484d",
  priMed: "#62666d",
  priLow: "#8a8f98",
  edgeLive: "#62666d",
  edgeDone: "#d0d6e0",
  shadowColor: "#000000",
  shadowOpacity: 0.05,
  elevatedGlow: "#5e6ad2",
  elevatedGlowOpacity: 0.22,
};

// Dark palette inspired by Linear's own dark theme: near-black page, lifted
// surfaces, same indigo brand (it reads well on both backdrops).
const DARK: Palette = {
  bg: "#0e0e10",
  doneFill: "#1c1c20",
  doneStroke: "#2a2a30",
  doneText: "#6c6f77",
  blockedFill: "#1a1a1e",
  blockedStroke: "rgba(255,255,255,0.08)",
  blockedText: "#eeeeee",
  blockedMeta: "#8a8f98",
  readyFill: "#5e6ad2",
  readyText: "#ffffff",
  readyMeta: "rgba(255,255,255,0.78)",
  priHigh: "#ff6368",
  priMed: "#8a8f98",
  priLow: "#55595f",
  edgeLive: "#8a8f98",
  edgeDone: "#3a3a40",
  shadowColor: "#000000",
  shadowOpacity: 0.3,
  elevatedGlow: "#5e6ad2",
  elevatedGlowOpacity: 0.4,
};

const theme: Theme = process.argv[2] === "dark" ? "dark" : "light";
const C: Palette = theme === "dark" ? DARK : LIGHT;

const FONT =
  "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

type State = "done" | "ready" | "blocked";
type Priority = "high" | "med" | "low";

interface NodeSpec {
  cx: number;
  cy: number;
  title: string;
  meta: string;
  state: State;
  priority?: Priority;
}

// 5 levels: 2 done roots → 2 ready → 4 blocked → 1 hub → 1 release.
// Canvas centers at x=430 so L2's four columns sit symmetric.
const N: Record<string, NodeSpec> = {
  research:    { cx: 230, cy: 66,  title: "Research",     meta: "research · done",    state: "done" },
  prd:         { cx: 630, cy: 66,  title: "Write PRD",    meta: "product · done",     state: "done" },
  api:         { cx: 230, cy: 194, title: "API contract", meta: "backend · high",     state: "ready",   priority: "high" },
  ux:          { cx: 630, cy: 194, title: "UX mockups",   meta: "design · medium",    state: "ready",   priority: "med" },
  db:          { cx: 130, cy: 322, title: "DB schema",    meta: "backend · high",     state: "blocked", priority: "high" },
  auth:        { cx: 330, cy: 322, title: "Auth service", meta: "backend · high",     state: "blocked", priority: "high" },
  ui:          { cx: 530, cy: 322, title: "UI kit",       meta: "frontend · medium",  state: "blocked", priority: "med" },
  docs:        { cx: 730, cy: 322, title: "Docs",         meta: "docs · low",         state: "blocked", priority: "low" },
  integration: { cx: 330, cy: 450, title: "Integration",  meta: "full-stack · high",  state: "blocked", priority: "high" },
  release:     { cx: 530, cy: 578, title: "Release",      meta: "ops · high",         state: "blocked", priority: "high" },
};

const E: [keyof typeof N, keyof typeof N][] = [
  ["research", "api"],
  ["prd", "api"],
  ["prd", "ux"],
  ["api", "db"],
  ["api", "auth"],
  ["ux", "ui"],
  ["ux", "docs"],
  ["db", "integration"],
  ["auth", "integration"],
  ["ui", "integration"],
  ["docs", "release"],
  ["integration", "release"],
];

function rect(n: NodeSpec): string {
  const x = n.cx - NW / 2;
  const y = n.cy - NH / 2;

  let fill: string;
  let stroke: string;
  let dash = "";
  let filter = `filter="url(#shadow)"`;

  if (n.state === "done") {
    fill = C.doneFill;
    stroke = C.doneStroke;
    dash = `stroke-dasharray="4 3"`;
    filter = "";
  } else if (n.state === "ready") {
    fill = C.readyFill;
    stroke = C.readyFill;
    filter = `filter="url(#shadow-elevated)"`;
  } else {
    fill = C.blockedFill;
    stroke = C.blockedStroke;
  }

  return `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="${R}"
    fill="${fill}" stroke="${stroke}" stroke-width="1" ${dash}
    ${filter}/>`;
}

function priDot(n: NodeSpec): string {
  if (n.state === "done" || !n.priority) return "";

  const x = n.cx - NW / 2 + 12;
  const y = n.cy - NH / 2 + 12;

  let color: string;
  let opacity = 1;

  if (n.state === "ready") {
    color = "#ffffff";
    opacity = n.priority === "high" ? 1 : n.priority === "med" ? 0.65 : 0.4;
  } else {
    color =
      n.priority === "high" ? C.priHigh : n.priority === "med" ? C.priMed : C.priLow;
  }

  const opAttr = opacity < 1 ? ` opacity="${opacity}"` : "";
  return `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"${opAttr}/>`;
}

function label(n: NodeSpec): string {
  const titleY = n.cy - 3;
  const metaY = n.cy + 14;

  let titleFill: string;
  let metaFill: string;

  if (n.state === "done") {
    titleFill = C.doneText;
    metaFill = C.doneText;
  } else if (n.state === "ready") {
    titleFill = C.readyText;
    metaFill = C.readyMeta;
  } else {
    titleFill = C.blockedText;
    metaFill = C.blockedMeta;
  }

  const titleText = n.state === "done" ? `✓  ${n.title}` : n.title;

  return `
  <text x="${n.cx}" y="${titleY}" text-anchor="middle"
    font-family="${FONT}" font-size="13.5" font-weight="500" fill="${titleFill}">${titleText}</text>
  <text x="${n.cx}" y="${metaY}" text-anchor="middle"
    font-family="${FONT}" font-size="10.5" fill="${metaFill}">${n.meta}</text>`;
}

function edge(a: NodeSpec, b: NodeSpec): string {
  const fromDone = a.state === "done";
  const x1 = a.cx;
  const y1 = a.cy + NH / 2;
  const x2 = b.cx;
  const y2 = b.cy - NH / 2;

  const color = fromDone ? C.edgeDone : C.edgeLive;
  const dash = fromDone ? `stroke-dasharray="4 3"` : "";
  const marker = fromDone ? "url(#ah-done)" : "url(#ah)";

  // Shorten at destination so the marker tip lands on the border.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ex = x2 - (dx / len) * 6;
  const ey = y2 - (dy / len) * 6;

  return `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}"
    stroke="${color}" stroke-width="1.25" ${dash} marker-end="${marker}"/>`;
}

function node(n: NodeSpec): string {
  return `${rect(n)}${priDot(n)}${label(n)}`;
}

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg">
<defs>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="${C.shadowColor}" flood-opacity="${C.shadowOpacity}"/>
  </filter>
  <filter id="shadow-elevated" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="${C.elevatedGlow}" flood-opacity="${C.elevatedGlowOpacity}"/>
  </filter>
  <marker id="ah" markerWidth="9" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0,8 3,0 6" fill="${C.edgeLive}"/>
  </marker>
  <marker id="ah-done" markerWidth="9" markerHeight="6" refX="7" refY="3" orient="auto">
    <polygon points="0 0,8 3,0 6" fill="${C.edgeDone}"/>
  </marker>
</defs>

<rect width="${W}" height="${H}" fill="${C.bg}"/>

<!-- ── Edges ── -->
${E.map(([from, to]) => edge(N[from]!, N[to]!)).join("\n")}

<!-- ── Nodes ── -->
${Object.values(N).map(node).join("\n")}
</svg>`;

process.stdout.write(svg + "\n");
