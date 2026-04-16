import pc from "picocolors";

const HELP = `
${pc.bold("depdo")} — dependency-aware todo manager

${pc.bold("Usage:")} depdo <command> [options]

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

  ${pc.cyan("link")} <id> --before <other>   <id> must be done before <other>
  ${pc.cyan("link")} <id> --after <other>    <id> must be done after <other>

  ${pc.cyan("unlink")} <id-a> <id-b>          Remove dependency between two tasks

  ${pc.cyan("graph")} [options]             Visualize the task DAG
      --all                          Include done tasks
      --mermaid                      Output Mermaid syntax
      --png <file>                   Render to PNG/SVG file

  ${pc.cyan("status")}                      Overview of all tasks

  ${pc.cyan("help")}                        Show this help

${pc.bold("IDs:")} Use any unique prefix (e.g. "a3f" for "a3f1b2").
`.trim();

export function helpCommand(): void {
  console.log(HELP);
}
