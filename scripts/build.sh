#!/bin/bash
set -e
bun build src/cli.ts --compile --outfile todo-dag
echo "Built: ./todo-dag"
