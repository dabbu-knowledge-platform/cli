## Features added

- feat(config): add ability to change defaults using the config command [c66d753]

- feat(defaults): add default value feature [dcc7e10]
	- when creating a new drive, the values entered the first time are preserved
	- when you create a new drive with the same provider, the default values are used to fill in the fields (such as base path, client ID, client secret, etc)

- feat(help): add help command [ef9aad2]

- feat(config): add config command [4e2baff]
	- alias: config, conf or cfg
	- usage: config <get | set | del> <field name> [value to set]
	  - you can get any field, nested fields accessed using dots
	  - you can set only current drive and server URL
	  - you can delete only history or a specific drive
	- added a del() method to utils/config.util.ts

## Bug fixes

- fix(new-drive): close oauth callback server once response is received [c7c2f71]

## Documentation

- Change logo (final one!) [6008d33]
- Make readme concise, update links [c488d3b, 3bf308c, d702775, 3fc6c42]

## Builds/CI

- fix(scripts): add colours and .sh extensions to scripts [37b28fd]
