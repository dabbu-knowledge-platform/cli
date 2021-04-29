## Changes

- feat(list): add callback to list function [6aa04d6]
  - call the callback for every fifty files instead of waiting for all files to be returned
  - this applies to copy and move operations as well - they will be performed in batches of 50

## Maintenance

- chore(deps): update pkg and xo [c809e64]
