// Command to print out all commands and their usage

// Use the chalk library to write colourful text
import Chalk from 'chalk'

// Import the print statement
import { print } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// The help command
export const run = async (): Promise<void> => {
	Logger.debug(`command.help.run: help called`)

	print(
		Chalk.yellow(
			[
				'Usage:',
				'  - Anything in <> must be mentioned, while if it is in [], it is optional.',
				'  - All file/folder paths may include drive names.',
				'  - While specifying a folder, please add a / at the end of the folder name.',
				'  - Escape spaces in the file name by surrounding it in quotes.',
				'',
				'Commands:',
				`  - ${Chalk.keyword('orange')(
					'`pwd`',
				)} - Know your current drive and folder`,
				`  - ${Chalk.keyword('orange')(
					'`cd <drive name>:`',
				)} - Switch drives (Notice the colon at the end of the drive name)`,
				`  - ${Chalk.keyword('orange')(
					'`cd <relative path to folder>`',
				)} - Move into a folder`,
				`  - ${Chalk.keyword('orange')(
					'`list [relative path to folder]`',
				)} - List files in a folder (default is current folder)`,
				`  - ${Chalk.keyword('orange')(
					'`read <relative path to file>`',
				)} - Download and open a file`,
				`  - ${Chalk.keyword('orange')(
					'`copy <relative path to file> <relative path to place to copy to>`',
				)} - Copy a file from one place to another`,
				`  - ${Chalk.keyword('orange')(
					'`del <relative path to file>`',
				)} - Delete a file`,
				`  - ${Chalk.keyword('orange')(
					'`new-drive`',
				)} - Create a new drive`,
				`  - ${Chalk.keyword('orange')(
					'`config <get | set | del> <field path> [value to set]`',
				)} - View/set/delete a field in the config file`,
				`  - ${Chalk.keyword('orange')('`clear`')} - Clear the screen`,
				`  - ${Chalk.keyword('orange')('`CTRL+C OR exit`')} - Exit`,
				'',
				' Typing any of the above and then hitting enter will allow you to execute that command and get a result.',
			].join('\n'),
		),
	)
}
