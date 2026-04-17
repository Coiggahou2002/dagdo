import { parseArgs } from "util";
import { writeFileSync } from "fs";
import { loadGraph } from "../storage";
import { buildActiveGraph, buildFullGraph } from "../graph/dag";
import { renderAscii, renderMermaid, renderDot } from "../graph/render";

export async function graphCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      mermaid: { type: "boolean", default: false },
      png: { type: "string" },
      all: { type: "boolean", default: false },
    },
  });

  const data = await loadGraph();
  const graph = values.all ? buildFullGraph(data) : buildActiveGraph(data);

  if (values.mermaid) {
    console.log(renderMermaid(graph));
    return;
  }

  if (values.png != null) {
    const outFile = (values.png as string) || "dagdo.png";
    await renderPng(graph, outFile);
    return;
  }

  console.log(renderAscii(graph));
}

async function renderPng(graph: Parameters<typeof renderDot>[0], outFile: string): Promise<void> {
  let Graphviz: any;
  try {
    const mod = await import("@hpcc-js/wasm-graphviz");
    Graphviz = mod.Graphviz;
  } catch {
    console.error("PNG rendering requires @hpcc-js/wasm-graphviz.");
    console.error("Install it: bun add @hpcc-js/wasm-graphviz");
    process.exit(1);
  }

  const graphviz = await Graphviz.load();
  const dot = renderDot(graph);
  const svg = graphviz.layout(dot, "svg", "dot");

  if (outFile.endsWith(".svg")) {
    writeFileSync(outFile, svg);
    console.log(`Saved: ${outFile}`);
    return;
  }

  let Resvg: any;
  try {
    const mod = await import("@resvg/resvg-js");
    Resvg = mod.Resvg;
  } catch {
    console.error("PNG rendering requires @resvg/resvg-js.");
    console.error("Install it: bun add @resvg/resvg-js");
    process.exit(1);
  }

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  writeFileSync(outFile, pngBuffer);
  console.log(`Saved: ${outFile}`);
}
