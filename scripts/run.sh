#!/bin/bash

# run
# Runs the Typescript Compiler on the code and output the compiled code
# to ./dist/compiled/. Then runs the CLI in development mode

# Fail fast
set -e

# ANSI colour codes so we can highlight text in the terminal
colour_red="\033[0;31m"
colour_green="\033[0;32m"
colour_blue="\033[0;34m"
colour_cyan="\033[0;36m"

# Escape codes for making text bold and returning it back to normal
bold="\e[1m"
normal="\e[0m"

# First build it
yarn build

echo -e "${bold}${colour_blue}job: start; status: running${normal}"

# Then run it
if [[ "$1" == "prod" ]]; then
  env NODE_ENV=production node ./dist/compiled/server.js
else
  env PORT=8000 NODE_ENV=development node ./dist/compiled/server.js
fi

echo -e "${bold}${colour_green}job: start; status: done${normal}"