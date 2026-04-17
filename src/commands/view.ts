import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { graphCommand } from "./graph";

export async function viewCommand(): Promise<void> {
  const dir = join(tmpdir(), "dagdo-view");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `dagdo-${Date.now()}.svg`);

  await graphCommand(["--all", "--png", file]);

  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  execSync(`${opener} "${file}"`);
}
