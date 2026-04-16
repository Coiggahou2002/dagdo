#!/bin/bash
set -e

bun build src/cli.ts --compile --outfile depdo

# Bun 1.3.12 produces a malformed code signature on macOS.
# Strip it and re-sign with an ad-hoc signature.
if [[ "$(uname)" == "Darwin" ]]; then
  codesign --remove-signature ./depdo
  codesign --sign - ./depdo
fi

echo "Built: ./depdo"
