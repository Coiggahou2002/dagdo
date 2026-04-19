import { execSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { graphCommand } from "./graph";

export async function viewCommand(): Promise<void> {
  const dir = join(tmpdir(), "dagdo-view");
  mkdirSync(dir, { recursive: true });

  const stamp = Date.now();
  const svgFile = join(dir, `dagdo-${stamp}.svg`);
  const htmlFile = join(dir, `dagdo-${stamp}.html`);

  await graphCommand(["--all", "--png", svgFile]);

  const svg = readFileSync(svgFile, "utf-8");
  writeFileSync(htmlFile, wrapSvgInHtml(svg));

  openFile(htmlFile);
}

/**
 * Wrap an SVG string in a minimal HTML document so `dagdo view` always lands
 * in a browser (where the graph is zoomable/scrollable) rather than whatever
 * the OS has registered to handle the `.svg` extension (image viewer, Inkscape,
 * editor, …).
 */
export function wrapSvgInHtml(svg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>dagdo graph</title>
<style>
  html, body { margin: 0; padding: 0; background: #faf9f5; }
  body { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: Georgia, serif; }
  svg { max-width: 100vw; max-height: 100vh; height: auto; width: auto; }
</style>
</head>
<body>
${svg}
</body>
</html>
`;
}

function openFile(path: string): void {
  let command: string;
  switch (process.platform) {
    case "darwin":
      command = `open "${path}"`;
      break;
    case "win32":
      // `start ""` — the empty string is the window title, required so a quoted
      // path isn't interpreted as the title.
      command = `start "" "${path}"`;
      break;
    default:
      command = `xdg-open "${path}"`;
      break;
  }

  try {
    execSync(command, { stdio: "ignore" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.platform !== "darwin" && process.platform !== "win32") {
      console.error(
        `Failed to open ${path}: ${msg}\n` +
          "Hint: xdg-open may not be installed. Install xdg-utils (apt: xdg-utils, dnf: xdg-utils) or open the file manually.",
      );
    } else {
      console.error(`Failed to open ${path}: ${msg}`);
    }
    process.exit(1);
  }
}
