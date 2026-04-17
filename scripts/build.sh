#!/bin/bash
set -e

bun build src/cli.ts --compile --outfile dagdo \
  --external mermaid-isomorphic \
  --external playwright \
  --external @hpcc-js/wasm-graphviz \
  --external @resvg/resvg-js

# Bun 1.3.12 produces a malformed code signature on macOS.
# Strip it and re-sign with an ad-hoc signature.
if [[ "$(uname)" == "Darwin" ]]; then
  codesign --remove-signature ./dagdo
  codesign --sign - ./dagdo
fi

echo "Built: ./dagdo"
