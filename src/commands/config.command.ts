// Command to change config details

// Use the chalk library to print colourful text
import Chalk from 'chalk'

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import { json, print } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// The config command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`command.config.run: config called with args: ${args}`)

	// Check what the command is
	if (args[0] === 'get' || args[0] === 'view') {
		if (!args[1]) {
			throw new Error(
				'Please specify the field to view (currentDrive OR serverUrl OR history OR drives OR creds)',
			)
		}

		print(
			`${Chalk.yellow(args[1])}: ${Chalk.keyword('orange')(
				json(Config.get(args[1])),
			)}`,
		)

		return
	}

	if (args[0] === 'set') {
		if (!args[1] || !args[2]) {
			throw new Error(
				'Please specify the name of the field to set and the value to set, like this: `config set serverUrl "https://localhost:8000"`',
			)
		}

		// Make sure that only certain fields can be set and the values set are not invalid
		// Set the current drive
		if (
			args[1] === 'currentDrive' ||
			args[1] === 'currentdrive' ||
			args[1] === 'current-drive'
		) {
			// Check that it is a valid drive
			const drives = Object.keys(
				Config.get(`drives`) as Record<string, any>,
			)
			const driveToSet = args[2].replace(/:/g, '')

			// If the drive is valid, set it in the config file
			if (drives.includes(driveToSet)) {
				Config.set('currentDrive', driveToSet)
				print(
					Chalk.yellow(
						`Set current drive to ${Chalk.keyword('orange')(
							driveToSet,
						)}`,
					),
				)

				return
			} else {
				// Else throw an error
				throw new Error(`Invalid drive: ${driveToSet}`)
			}
		}

		// Set the server URl
		if (
			args[1] === 'serverUrl' ||
			args[1] === 'serverurl' ||
			args[1] === 'server' ||
			args[1] === 'server-url' ||
			args[1] === 'url'
		) {
			// If the server URL is non null, set it in the config file
			if (args[2]) {
				Config.set('serverUrl', args[2])
				print(
					Chalk.yellow(
						`Set server URL to ${Chalk.keyword('orange')(
							args[2],
						)}; please restart the CLI.`,
					),
				)

				return
			} else {
				// Else throw an error
				throw new Error(`Invalid drive: ${args[2]}`)
			}
		}

		// Set a default for some provider
		if (args[1].startsWith('defaults')) {
			// If a default for some provider is non null, set it in the config file
			if (args[2]) {
				Config.set(args[1], args[2])
				print(
					Chalk.yellow(
						`Set default ${Chalk.keyword('orange')(
							args[1],
						)} to ${Chalk.keyword('orange')(args[2])}`,
					),
				)

				return
			} else {
				// Else throw an error
				throw new Error(`Invalid drive: ${args[2]}`)
			}
		}

		throw new Error(
			'Invalid field to set: you can only set the current drive and server URL using the `config set` command',
		)
	}

	if (
		args[0] === 'del' ||
		args[0] === 'delete' ||
		args[0] === 'clear'
	) {
		if (!args[1]) {
			throw new Error(
				'Please specify the field to delete (history OR drive name)',
			)
		}

		// Clear history
		if (args[1] === 'history' || args[1] === 'hist') {
			Config.set('history', [])
			print(Chalk.yellow('Cleared history'))

			return
		}

		// Clear defaults
		if (args[1].startsWith('defaults')) {
			Config.del(args[1])
			print(Chalk.yellow(`Cleared default ${args[1]}`))

			return
		}

		// Else delete the drive
		// Check that it is a valid drive
		const drives = Object.keys(
			Config.get(`drives`) as Record<string, any>,
		)
		const driveToDelete = args[1].replace(/:/g, '')

		if (driveToDelete === Config.get('currentDrive')) {
			throw new Error(
				'Cannot delete current drive. Switch to a different drive (using `cd <drive name>:`) and then delete this drive.',
			)
		}

		if (drives.includes(driveToDelete)) {
			// If the drive is valid, set it in the config file
			Config.del(`drives.${driveToDelete}`)
			print(
				Chalk.yellow(
					`Deleted drive ${Chalk.keyword('orange')(driveToDelete)}`,
				),
			)

			return
		} else {
			// Else throw an error
			throw new Error(
				`Invalid drive to delete: ${driveToDelete}; you can only clear command history (using \`command del history\`) or delete a drive (using \`command del <drive name>\`)`,
			)
		}
	}

	throw new Error(
		'Please enter a command to view/set/delete a config field, like this: `config <get or set or del> <field name> [value]`',
	)
}
