## Bug fixes
- fix(read): folder path is always null [fbbd944]
	- typo in code, did not specify .length in slice() function call
- fix(utils): remove unnecessary \n while printing token expiry [99ec1bf]
- fix(list): don't print no of files/folders in dir twice [9997c23]

- fix(list): show number of files listed at the end if no of files > 50 [6eb8290]
	- also show headers when listing files, they were not shown since last release due to a bug
- fix(spinner): hide spinner while printing access token expiry time [973cd34]
- fix(prompt): show / in prompt if in root dir [59edb12]

## Documentation
- docs: add code of conduct [9bf14ba]
- fix(contributing): update instructions regarding linter [035d18e]
- docs(readme): copy website intro, install and getting started parts to readme [8fc2929]

## Legal stuff
- docs: change copyright headers to Dabbu Knowledge Platform [6467227]

## Build/CI
- fix(version script): fetch tags before generating release notes [87ab616]
