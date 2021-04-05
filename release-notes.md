## Changes to installation process

- Installation for Linux and MacOS can be done using a bash script.
- Windows install process remains the same, a batch script for that is in progress.

## Changes to existing features

- feat: change default url to dabbu-server.herokuapp.com

## Bug Fixes

- fix(delete): file name is specified twice in URL [5dcd763]
	- remove file name from folder path if there is no regex

## Code style/formatting

- style: rename readme, contributing, release notes to lower case [090bc49]
	- delete now unused CHANGELOG.md
	- remove .prettierignore, .prettierrc
- style: use xo for linting [8c2a2b3]
	- run prettier through xo for formatting
	- use tabs instead of spaces
	- disabled rules complexity, no-unused-vars, max-params, max-depth,	object-curly-spacing and unicorn/no-nested-ternary
	- run xo while testing
- style: add editorconfig [44957c7]

## Builds/CI

- ci: check if version is prerelease by parsing it [efcf617]
	- it will contain a dash if it is a prerelease, i.e., 3.0.0-alpha.1
- ci: run tests instead of checking format [26bc32b]
- feat(scripts): add scripts to bump version and commit [68b3c4f]
- build: remove dev deps while building in CI env
- vendor: remove prettier as dev dependency, add xo

## Maintainence

- chore(deps): bump [open](https://github.com/sindresorhus/open) from 8.0.4 to 8.0.5 [c3d2002]
