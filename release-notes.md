## Features added

- feat(logging): log errors only if env var PRINT_ERRORS is set [544f51a]
	- run `PRINT_ERRORS=true dabbu-cli` to enable verbose error logging
- feat(list method/`ls`): folders are returned first (though this might not be seen when the result is more than 50 items long)
- feat(list api): implement pagination [d641cfc]
	- results are requested in batches of 50
	- as the results come in, they are printed
	- only exception is the hard drive provider, as it does not support pagination

## Bug fixes

- fix(spinner): use only one spinner throughout the CLI [4615dcc, 59daa55]
- fix(oauth): 400 error while refreshing access token [cca941e]
	- send auth metadata in query param or request body based on send-auth-metadata-in variable in provider-fields.json
- fix(setup): init method had names with _ [9e90719]
	- changed them to -	

## Changes to install script

- feat(install scipt): add comments, rename -f to -d (for dry run) and remove -o in install script [3054fed]
- fix(bump version script): don't push tags, else ci doesn't release assets [15257a9]

## Builds/CI

- ci: test and build for all branches, release only for main [aa02a8f]
- ci: release builds only from main branch [2a273f9]
