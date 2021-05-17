// Command to move into a folder

// Use the chalk library to write colourful text
import Chalk from 'chalk'

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
// Import the print statement
import { print } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// The cd command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`command.cd.run: cd called with args: ${args}`)

	// Print out the current drive name, type and path
	const currentDrive = Config.get('currentDrive') as string

	if (!currentDrive) {
		throw new Error(`Invalid current drive name`)
	}

	print(
		Chalk.yellow(
			`In drive ${Chalk.keyword('orange')(
				currentDrive,
			)} (${Chalk.keyword('orange')(
				Config.get(`drives.${currentDrive}.provider`),
			)}); current path: ${Chalk.keyword('orange')(
				Config.get(`drives.${currentDrive}.path`) || '/',
			)}`,
		),
	)

	// Also print a list of all drives
	const drives = Config.get(`drives`) as Record<string, any>

	print(Chalk.yellow('\nList of drives:'))
	for (const drive of Object.keys(drives)) {
		print(
			Chalk.yellow(
				`- ${Chalk.keyword('orange')(drive)} (${Chalk.keyword('orange')(
					Config.get(`drives.${drive}.provider`),
				)}); current path: ${Chalk.keyword('orange')(
					Config.get(`drives.${drive}.path`) || '/',
				)}`,
			),
		)
	}
}
