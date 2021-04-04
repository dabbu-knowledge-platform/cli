### (prerelease v2.6.1-0)

## Changes to CLI

- feat: change default url to dabbu-server.herokuapp.com [8c2a2b3]

## Builds/CI changes

- ci: check if version is prerelease by parsing it [efcf617]
- ci: run tests instead of checking format [26bc32b]
- build: remove dev deps while building in CI env [8c2a2b3]
- vendor: remove prettier as dev dependency, add xo [8c2a2b3]
- feat(scripts): add scripts to bump version and commit [68b3c4f]

## Code style/linting

style: add editorconfig [44957c7]
style: use xo for linting [8c2a2b3]
- run prettier through xo for formatting
- use tabs instead of spaces
- disabled rules complexity, no-unused-vars, max-params, max-depth,
object-curly-spacing and unicorn/no-nested-ternary
- run xo while testing
