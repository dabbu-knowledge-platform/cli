#!/bin/bash

# build
# Runs the Typescript Compiler on the code and output the compiled code
# to ./dist/compiled/

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

# Remove generated dirs first
yarn clean
echo -e "${bold}${colour_blue}job: build; status: running${normal}"
# Then build it
yarn tsc
# Then copy the package.json file
cp ./package.json ./dist/
echo -e "${bold}${colour_green}job: build; status: done${normal}"
