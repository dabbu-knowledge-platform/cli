## Changes

- Typescript rewrite
- Knowledge drive removed *temporarily*, it is being rewritten in Typescript
- Use Files API Server v3 APIs
  - add support for client ID - API key authentication required by v3 server
- Add logging
  - Logs are stored locally ONLY, in the config directory
    - Windows: `%APPDATA%\Dabbu CLI\logs\dabbu-cli.log`
    - MacOS: `/Users/<username>/Library/Dabbu CLI/logs/dabbu-cli.log`
    - Linux: `($HOME OR $XDG_CONFIG_HOME)/.config/Dabbu CLI/logs/dabbu-cli.log`
  - These logs contain sensitive information, please be careful to remove sensitive information while posting them publicly. Work is underway to mask this sensitive information.

## Fixes

- Fix error 400 while attempting to create new drive

## Documentation

- Add logo, demo image to README.
- Add install instructions for each OS to README.

## Builds/CI

- Build packages for different operating systems for direct download
  - Windows: Generic `ZIP`
    - The generic zip (for win, macos, linux) contains:
      - Manual page (or manpage)
      - Logo
      - Desktop entry (`.desktop` file)
      - License file
      - Readme file
      - Version file
      - Binary file (named `dabbu-cli` or `dabbu-cli.exe`)
    - The `.exe` needs to be run every time you want to start the CLI in Windows
  - MacOS: `PKG` file, Generic `ZIP`
    - The MacOS package contains the man page, but no desktop entry (need to start it from terminal by typing `dabbu-cli`)
    - TODO: Find out how to create a desktop entry
  - Linux: `DEB` file, `RPM` file, `PACMAN` package, `APK` file, Generic `ZIP`
    - The Linux packages contain man pages and desktop entries for the CLI
- Automatic releases only from the develop branch
- Add bash scripts for all jobs

## Tests

- Use Jest to test
  - Added dummy test
  - TODO: Add actual unit tests

## Style/Format

- Add `ts` files to `.editorconfig`
- Use ESLint to lint typescript files
