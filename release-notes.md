## Fixes

- fix(copy): wrong file name displayed in loading indicator [5ad094b]
- fix(auth): register a new client if server does not recognise creds [0aeb411]
- fix(copy): error when copying files on hard drive from disk to disk [918c853]
  - fixes itself when trying the same operation again once or twice
- fix(copy): 404 when copying a file from the root of a drive [c6920ef]

## Builds/CI

- fix(build): add fail fast flag to all bash scripts except the package script [b3c2557, 9a0a2f2]
- fix(build): incorrect path to compiled js files [e598e43]
- fix(package script): copy-paste error in comments [9696392]
- fix(bump version script): remove package-lock.json from git add command [3149ecb]

## Docs

- change(logo): use a different logo [2ee8cf2]
