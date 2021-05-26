#!/bin/bash

# package
# Builds packages for linux (deb, rpm, pacman, apk, zip), macos (pkg, zip) and win (zip)
# 
# Usage: scripts/package
# 
# Remember to run this script from the root of the project!

# DO NOT fail fast (this is because some packages, e.g. mac-pkg, may 
# not build if you are not on the right OS)
#set -e

# ANSI colour codes so we can highlight text in the terminal
colour_red="\033[0;31m"
colour_green="\033[0;32m"
colour_blue="\033[0;34m"
colour_cyan="\033[0;36m"

# Escape codes for making text bold and returning it back to normal
bold="\e[1m"
normal="\e[0m"

# Compile a deb for linux
function compile_linux_deb {
	echo -e "${colour_blue}package: compiling linux_deb${normal}"
	
	fpm -s dir -t deb -p dist/packages/dabbu-cli-linux-deb-amd64.deb --name dabbu-cli --license gpl3 --version `cat version` --description "A CLI that enables you to access any of your personal information (Gmail, Google Drive, OneDrive, your hard drive, ...) as simple files and folders" --url "https://dabbu-knowledge-platform.github.io" --maintainer "Vedant K (gamemaker1) <dabbuknowledgeplatform@gmail.com>" ./dist/binaries/cli-linux=/usr/bin/dabbu-cli ./assets/packaging/dabbu-cli.1=/usr/share/man/man1/dabbu-cli.1 ./assets/logo.png=/usr/share/icons/dabbu-cli.png ./assets/packaging/dabbu-cli.desktop=/usr/share/applications/dabbu-cli.desktop
}

# Compile a rpm for linux
function compile_linux_rpm {
	echo -e "${colour_blue}package: compiling linux_rpm${normal}"
	
	fpm -s dir -t rpm -p dist/packages/dabbu-cli-linux-rpm-amd64.rpm --name dabbu-cli --license gpl3 --version `cat version` --description "A CLI that enables you to access any of your personal information (Gmail, Google Drive, OneDrive, your hard drive, ...) as simple files and folders" --url "https://dabbu-knowledge-platform.github.io" --maintainer "Vedant K (gamemaker1) <dabbuknowledgeplatform@gmail.com>" ./dist/binaries/cli-linux=/usr/bin/dabbu-cli ./assets/packaging/dabbu-cli.1=/usr/share/man/man1/dabbu-cli.1 ./assets/logo.png=/usr/share/icons/dabbu-cli.png ./assets/packaging/dabbu-cli.desktop=/usr/share/applications/dabbu-cli.desktop
}

# Compile a pacman package for linux
function compile_linux_pacman {
	echo -e "${colour_blue}package: compiling linux_pacman${normal}"
	
	fpm -s dir -t pacman -p dist/packages/dabbu-cli-linux-arch-amd64.tar.gz --name dabbu-cli --license gpl3 --version `cat version` --description "A CLI that enables you to access any of your personal information (Gmail, Google Drive, OneDrive, your hard drive, ...) as simple files and folders" --url "https://dabbu-knowledge-platform.github.io" --maintainer "Vedant K (gamemaker1) <dabbuknowledgeplatform@gmail.com>" ./dist/binaries/cli-linux=/usr/bin/dabbu-cli ./assets/packaging/dabbu-cli.1=/usr/share/man/man1/dabbu-cli.1 ./assets/logo.png=/usr/share/icons/dabbu-cli.png ./assets/packaging/dabbu-cli.desktop=/usr/share/applications/dabbu-cli.desktop
}

# Compile a apk package for linux
function compile_linux_apk {
	echo -e "${colour_blue}package: compiling linux_apk${normal}"
	
	fpm -s dir -t apk -p dist/packages/dabbu-cli-linux-alpine-amd64.apk --name dabbu-cli --license gpl3 --version `cat version` --description "A CLI that enables you to access any of your personal information (Gmail, Google Drive, OneDrive, your hard drive, ...) as simple files and folders" --url "https://dabbu-knowledge-platform.github.io" --maintainer "Vedant K (gamemaker1) <dabbuknowledgeplatform@gmail.com>" ./dist/binaries/cli-alpine=/usr/bin/dabbu-cli ./assets/packaging/dabbu-cli.1=/usr/share/man/man1/dabbu-cli.1 ./assets/logo.png=/usr/share/icons/dabbu-cli.png ./assets/packaging/dabbu-cli.desktop=/usr/share/applications/dabbu-cli.desktop
}

# Compile a zip for linux
function compile_linux_zip {
	echo -e "${colour_blue}package: compiling linux_zip${normal}"
	
	mkdir -p ./dist/generated/linux-zip/

	cp ./readme.md ./dist/generated/linux-zip/
	cp ./license.md ./dist/generated/linux-zip/
	cp ./version ./dist/generated/linux-zip/

	cp ./assets/logo.png ./dist/generated/linux-zip/
	cp ./assets/packaging/dabbu-cli.1 ./dist/generated/linux-zip/
	cp ./assets/packaging/dabbu-cli.desktop ./dist/generated/linux-zip

	cp ./dist/binaries/cli-linux ./dist/generated/linux-zip/dabbu-cli

	cd ./dist/generated/linux-zip/
	zip -9 ../../packages/dabbu-cli-linux-generic-amd64.zip ./*
	cd ../../../
}

# Compile a osxpkg package for linux
function compile_macos_pkg {
	echo -e "${colour_blue}package: compiling macos_pkg${normal}"
	
	fpm -s dir -t osxpkg -p dist/packages/dabbu-cli-macos-pkg-amd64.pkg --name dabbu-cli --license gpl3 --version `cat version` --description "A CLI that enables you to access any of your personal information (Gmail, Google Drive, OneDrive, your hard drive, ...) as simple files and folders" --url "https://dabbu-knowledge-platform.github.io" --maintainer "Vedant K (gamemaker1) <dabbuknowledgeplatform@gmail.com>" ./dist/binaries/cli-macos=/usr/bin/dabbu-cli ./assets/packaging/dabbu-cli.1=/usr/share/man/man1/dabbu-cli.1 ./assets/logo.png=/usr/share/icons/dabbu-cli.png ./assets/packaging/dabbu-cli.desktop=/usr/share/applications/dabbu-cli.desktop
}

# Compile a zip for macos
function compile_macos_zip {
	echo -e "${colour_blue}package: compiling macos_zip${normal}"

	mkdir -p ./dist/generated/macos-zip/

	cp ./readme.md ./dist/generated/macos-zip/
	cp ./license.md ./dist/generated/macos-zip/
	cp ./version ./dist/generated/macos-zip/

	cp ./assets/logo.png ./dist/generated/macos-zip/
	cp ./assets/packaging/dabbu-cli.1 ./dist/generated/macos-zip/
	cp ./assets/packaging/dabbu-cli.desktop ./dist/generated/macos-zip

	cp ./dist/binaries/cli-macos ./dist/generated/macos-zip/dabbu-cli

	cd ./dist/generated/macos-zip/
	zip -9 ../../packages/dabbu-cli-macos-generic-amd64.zip ./*
	cd ../../../
}

# Compile a zip for win
function compile_win_zip {
	echo -e "${colour_blue}package: compiling win_zip${normal}"

	mkdir -p ./dist/generated/win-zip/

	cp ./readme.md ./dist/generated/win-zip/
	cp ./license.md ./dist/generated/win-zip/
	cp ./version ./dist/generated/win-zip/

	cp ./assets/logo.png ./dist/generated/win-zip/
	cp ./assets/packaging/dabbu-cli.1 ./dist/generated/win-zip/dabbu-cli.manualpage
	cp ./assets/packaging/dabbu-cli.desktop ./dist/generated/win-zip/

	cp ./dist/binaries/cli-win.exe ./dist/generated/win-zip/dabbu-cli.exe

	cd ./dist/generated/win-zip/
	zip -9 ../../packages/dabbu-cli-windows-generic-amd64.zip ./*
	cd ../../../
}


# Compile for all machines
function cross_compile {
	# First create the output directory
	mkdir -p ./dist/packages/
	mkdir -p ./dist/generated/
	# Then compile
	compile_linux_deb
	compile_linux_rpm
	compile_linux_pacman
	compile_linux_apk
	compile_linux_zip
	compile_macos_pkg
	compile_macos_zip
	compile_win_zip
}

# First build the CLI
yarn build
cp ./package.json ./dist/package.json

echo -e "${bold}${colour_blue}job: generate-binaries; status: running${normal}"
# Then compile the JS code into binaries
yarn pkg .
echo -e "${bold}${colour_green}job: generate-binaries; status: done${normal}"

echo -e "${bold}${colour_blue}job: package; status: running${normal}"
# Then generate packages from the binaries
cross_compile
echo -e "${bold}${colour_green}job: package; status: done${normal}"
