#!/usr/bin/env bun

import { addCommand } from "./commands/add";
import { removeCommand } from "./commands/remove";
import { editCommand } from "./commands/edit";
import { listCommand } from "./commands/list";
import { doneCommand } from "./commands/done";
import { nextCommand } from "./commands/next";
import { linkCommand } from "./commands/link";
import { unlinkCommand } from "./commands/unlink";
import { graphCommand } from "./commands/graph";
import { viewCommand } from "./commands/view";
import { statusCommand } from "./commands/status";
import { helpCommand } from "./commands/help";
import { setGlobal } from "./storage";
import { checkAliasOffer } from "./alias";
import { checkForUpdate, upgradeCommand } from "./upgrade";
import pkg from "../package.json";

const args = process.argv.slice(2);

// Extract --global flag before dispatching to subcommands
const globalIdx = args.indexOf("--global");
if (globalIdx !== -1) {
  setGlobal(true);
  args.splice(globalIdx, 1);
}

const command = args[0];
const rest = args.slice(1);

// Background update check (non-blocking, once per day)
checkForUpdate();

switch (command) {
  case "add":
    await addCommand(rest);
    break;
  case "rm":
  case "remove":
    await removeCommand(rest);
    break;
  case "edit":
    await editCommand(rest);
    break;
  case "list":
  case "ls":
    await listCommand(rest);
    break;
  case "done":
    await doneCommand(rest);
    break;
  case "next":
    await nextCommand(rest);
    break;
  case "link":
    await linkCommand(rest);
    break;
  case "unlink":
    await unlinkCommand(rest);
    break;
  case "graph":
    await graphCommand(rest);
    break;
  case "view":
    await viewCommand();
    break;
  case "status":
    await statusCommand(rest);
    break;
  case "upgrade":
    await upgradeCommand();
    break;
  case "version":
  case "--version":
  case "-v":
    console.log(pkg.version);
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    helpCommand();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "dagdo help" for usage.');
    process.exit(1);
}

await checkAliasOffer();
