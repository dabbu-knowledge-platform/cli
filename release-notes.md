## Features added

- Add the PRINT_ERRORS environment variable for printing errors to console [dc2b6b3]

## Bug Fixes

- Use the name returned by server for downloaded file [3b12a8d]
	- this is because some providers (like google drive/gmail) add an extension to the file name (e.g. docx or zip) so it can be opened on the user's computer through the file manager (most file managers associate apps with file extensions)
- Fix crash on startup when checking creds and server url is null [efcd2bf]

## Changes

- Change logo (again! it will probably go through a few more iterations until we are happy with it, PRs welcome!) [f799b61]
- Add instructions for creating oauth client for google drive, gmail and one drive to a single detailed gist and direct users to that [3e7dc67]

## Builds/CI

- Don't add version to artifact name [7de6fe8]
	- it confuses some linux distros while parsing the package name
