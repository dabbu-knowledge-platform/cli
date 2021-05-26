#!/bin/bash

# test
# Runs all tests using jest

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

echo -e "${bold}${colour_blue}job: test; status: running${normal}"

# Run all the tests and generate a coverage report
yarn jest --testTimeout 50000 --coverage

echo -e "${bold}${colour_green}job: test; status: done${normal}"
