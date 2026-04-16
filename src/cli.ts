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
import { helpCommand } from "./commands/help";

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);

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
  case "help":
  case "--help":
  case "-h":
  case undefined:
    helpCommand();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "todo-dag help" for usage.');
    process.exit(1);
}
