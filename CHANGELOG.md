### New features:

#### Sync command

Used to sync all files from one folder to another, based on `lastModifiedTime`. (Issue #12)

Example usage:

```
c:/$ sync g:/Work/ ./Dabbu/
```

The above command syncs all files from the `Work` folder in `g` drive to the `Dabbu` folder in `c` drive.

### UI Changes:

- Changed highlight colour to `orange` from `blue`.

### Bug fixes

- Fix bugs in path parsing.
- Show how many files have been listed/deleted/copied/moved/synced.
- Overwrite files if they already exist while copying/moving.

### Builds and CI

- Added support for Alpine Linux.
- Completely revamp CI to build executables and release versions automatically based on CHANGELOG.md and version file.

### Documentation

- Updated `README`, `CONTRIBUTING` and `.github/*TEMPLATE`.
