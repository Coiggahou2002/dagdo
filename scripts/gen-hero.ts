// Run with: bun run scripts/gen-hero.ts > docs/hero.svg

const W = 640;
const H = 380;
const NW = 185; // node width
const NH = 58;  // node height
const R = 10;   // border radius

// Node centers
const N1 = { x: 320, y: 69 };   // Design schema (done)
const N2 = { x: 160, y: 201 };  // Implement API (high)
const N3 = { x: 480, y: 201 };  // Build frontend (med)
const N4 = { x: 320, y: 325 };  // Write unit tests (med)

function rect(cx: number, cy: number, opts: {
  fill: string; stroke: string; dashed?: boolean;
}) {
  const x = cx - NW / 2;
  const y = cy - NH / 2;
  const dash = opts.dashed ? `stroke-dasharray="5 3"` : "";
  return `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="${R}"
    fill="${opts.fill}" stroke="${opts.stroke}" stroke-width="1.5" ${dash}
    filter="url(#shadow)"/>`;
}

function label(cx: number, cy: number, main: string, sub: string, mainColor: string) {
  return `
  <text x="${cx}" y="${cy - 8}" text-anchor="middle"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
    font-size="13.5" font-weight="600" fill="${mainColor}">${main}</text>
  <text x="${cx}" y="${cy + 12}" text-anchor="middle"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
    font-size="11" fill="#94A3B8">${sub}</text>`;
}

function dot(cx: number, cy: number, color: string) {
  return `<circle cx="${cx - NW / 2 + 14}" cy="${cy}" r="4.5" fill="${color}"/>`;
}

function edge(x1: number, y1: number, x2: number, y2: number, done = false) {
  const color = done ? "#D1D5DB" : "#94A3B8";
  const dash = done ? `stroke-dasharray="5 3"` : "";
  const marker = done ? "url(#ah-done)" : "url(#ah)";
  // Shorten the line a bit at destination so arrowhead sits on node border
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ex = x2 - (dx / len) * 8;
  const ey = y2 - (dy / len) * 8;
  return `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}"
    stroke="${color}" stroke-width="1.5" ${dash} marker-end="${marker}"/>`;
}

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg">
<defs>
  <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%">
    <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="#0F172A" flood-opacity="0.07"/>
  </filter>
  <marker id="ah" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
    <polygon points="0 0,9 3.5,0 7" fill="#94A3B8"/>
  </marker>
  <marker id="ah-done" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
    <polygon points="0 0,9 3.5,0 7" fill="#D1D5DB"/>
  </marker>
</defs>

<!-- Background -->
<rect width="${W}" height="${H}" fill="white"/>

<!-- ── Edges ── -->
${edge(N1.x, N1.y + NH / 2, N2.x, N2.y - NH / 2, true)}
${edge(N1.x, N1.y + NH / 2, N3.x, N3.y - NH / 2, true)}
${edge(N2.x, N2.y + NH / 2, N4.x, N4.y - NH / 2)}
${edge(N3.x, N3.y + NH / 2, N4.x, N4.y - NH / 2)}

<!-- ── N1: Design schema (done) ── -->
${rect(N1.x, N1.y, { fill: "#F8FAFC", stroke: "#CBD5E1", dashed: true })}
${label(N1.x, N1.y, "✓  Design schema", "backend  ·  done", "#94A3B8")}

<!-- ── N2: Implement API (high) ── -->
${rect(N2.x, N2.y, { fill: "white", stroke: "#FCA5A5" })}
${dot(N2.x, N2.y, "#EF4444")}
${label(N2.x + 6, N2.y, "Implement API", "backend  ·  high", "#0F172A")}

<!-- ── N3: Build frontend (med) ── -->
${rect(N3.x, N3.y, { fill: "white", stroke: "#93C5FD" })}
${dot(N3.x, N3.y, "#60A5FA")}
${label(N3.x + 6, N3.y, "Build frontend", "frontend  ·  medium", "#0F172A")}

<!-- ── N4: Write unit tests (med) ── -->
${rect(N4.x, N4.y, { fill: "white", stroke: "#93C5FD" })}
${dot(N4.x, N4.y, "#60A5FA")}
${label(N4.x + 6, N4.y, "Write unit tests", "testing  ·  medium", "#0F172A")}
</svg>`;

process.stdout.write(svg + "\n");
