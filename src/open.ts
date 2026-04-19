import { execSync } from "child_process";

/**
 * Open a file or URL with the user's default handler. Picks the right
 * invocation per platform; gives a clearer error on Linux when `xdg-open`
 * is missing.
 */
export function openExternal(target: string): void {
  let command: string;
  switch (process.platform) {
    case "darwin":
      command = `open "${target}"`;
      break;
    case "win32":
      // `start ""` — the empty string is the window title, required so a quoted
      // path isn't interpreted as the title.
      command = `start "" "${target}"`;
      break;
    default:
      command = `xdg-open "${target}"`;
      break;
  }

  try {
    execSync(command, { stdio: "ignore" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.platform !== "darwin" && process.platform !== "win32") {
      console.error(
        `Failed to open ${target}: ${msg}\n` +
          "Hint: xdg-open may not be installed. Install xdg-utils or open the URL manually.",
      );
    } else {
      console.error(`Failed to open ${target}: ${msg}`);
    }
  }
}
