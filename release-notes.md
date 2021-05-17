## Features added

- Add `pwd` command [3610074]
  - shows current drive name, provider and path
  - also displays list of drives

## Fixes/changes

- Check creds in the background on startup [d05ea92]
  - it used to block the shell for a few seconds on startup
- Move instructions for creating oauth client to gist [b5bdf63]
  - direct users to follow the instructions in the gist, then copy-paste the client ID and secret into the CLI
