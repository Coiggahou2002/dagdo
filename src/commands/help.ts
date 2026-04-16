import pc from "picocolors";

const HELP = `
${pc.bold("todo-dag")} — DAG-based task manager

${pc.bold("Usage:")} todo-dag <command> [options]

${pc.bold("Commands:")}
  ${pc.cyan("add")} <title> [options]      Add a task
      --priority, -p <high|med|low>  Set priority (default: med)
      --tag, -t <tag>                Add tag (repeatable)
      --after <id>                   This task depends on <id>
      --before <id>                  <id> depends on this task

  ${pc.cyan("rm")} <id> [--force]           Remove a task and its edges

  ${pc.cyan("edit")} <id> [options]         Edit a task
      --title <new>                  Change title
      --priority, -p <high|med|low>  Change priority
      --tag, -t <tag>                Add tag
      --untag <tag>                  Remove tag

  ${pc.cyan("list")} [options]              List tasks (alias: ls)
      --all                          Include done tasks
      --done                         Show only done tasks
      --tag, -t <tag>                Filter by tag
      --priority, -p <p>             Filter by priority

  ${pc.cyan("done")} <id> [--force]         Mark task(s) as done

  ${pc.cyan("next")} [--limit <n>]          Show tasks ready to do (in-degree = 0)

  ${pc.cyan("link")} <from> <to>            Add dependency: <from> blocks <to>

  ${pc.cyan("unlink")} <from> <to>          Remove a dependency

  ${pc.cyan("graph")}                       Visualize the task DAG

  ${pc.cyan("help")}                        Show this help

${pc.bold("IDs:")} Use any unique prefix (e.g. "a3f" for "a3f1b2").
`.trim();

export function helpCommand(): void {
  console.log(HELP);
}
