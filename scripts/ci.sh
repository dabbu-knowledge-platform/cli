#!/bin/bash

# ci
# Runs the Typescript Compiler, then the linter, then all tests, and finally builds the packages

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

echo -e "${bold}${colour_green}job: ci; status: running${normal}"
# Run the linter
yarn lint
# Run all tests
yarn test
# Build packages
yarn package
echo -e "${bold}${colour_green}job: ci; status: done${normal}"
