// Import all commands
import { run as runPwdCommand } from './commands/pwd.command'
import { run as runCdCommand } from './commands/cd.command'
import { run as runListCommand } from './commands/list.command'
import { run as runIntelListCommand } from './intel/list.intel'
import { run as runReadCommand } from './commands/read.command'
import { run as runDeleteCommand } from './commands/delete.command'
import { run as runCopyCommand } from './commands/copy.command'
import { run as runNewDriveCommand } from './commands/new-drive.command'
import { run as runConfigCommand } from './commands/config.command'
import { run as runHelpCommand } from './commands/help.command'
import { run as runClearCommand } from './commands/clear.command'

// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Import all prompts from prompts.ts
import * as Prompts from './ui/prompts.ui'
// Import the spinner
import * as Spinner from './ui/spinner.ui'
// Import all methods from config and utils
import * as Config from './utils/config.util'
import * as ErrorUtils from './utils/errors.util'
// Import the print statement
import { print, json } from './utils/general.util'
// Import the logger
import Logger from './utils/logger.util'

export default class Shell {
	// Run the shell
	async run(): Promise<void> {
		// Surround the whole thing in try-catch so we can catch errors and print
		// them instead of exiting
		try {
			Logger.debug(`shell.run: showing prompt`)

			// Show the user the prompt and get their input
			const { args } = await Prompts.getUserCommand()

			Logger.debug(
				`shell.run: processing user input args: ${json(args)}`,
			)

			// Set PROCESSING_COMMAND to true
			process.env.PROCESSING_COMMAND = 'true'

			switch (args[0]) {
				case 'pwd':
				case 'whereami':
				case 'location':
				case 'loc':
					Logger.debug(`shell.run: running pwd: ${args.slice(1)}`)

					await runPwdCommand(args.slice(1))
					break
				case 'cd':
					Logger.debug(`shell.run: running cd: ${args.slice(1)}`)

					await runCdCommand(args.slice(1))
					break
				case 'ls':
				case 'll':
				case 'l':
				case 'la':
				case 'lf':
				case 'list':
					// Check if we are running ls for the knowledge drive or any
					// other drive
					const currentDrive = Config.get('currentDrive')
					if (currentDrive) {
						if (
							Config.get(`drives.${currentDrive}.provider`) ===
							'knowledge'
						) {
							Logger.debug(
								`shell.run: running intel ls: ${args.slice(1)}`,
							)

							await runIntelListCommand(args.slice(1))
						} else {
							Logger.debug(
								`shell.run: running normal ls: ${args.slice(1)}`,
							)

							await runListCommand(args.slice(1))
						}
					} else {
						Logger.debug(
							`shell.run: invalid current drive while running ls: ${args.slice(
								1,
							)}`,
						)

						throw new Error(
							`Invalid current drive. Use cd to switch to a new drive, like this: \`cd <drive name>:\``,
						)
					}

					break
				case 'cat':
				case 'dl':
				case 'read':
				case 'open':
					Logger.debug(`shell.run: running cat: ${args.slice(1)}`)

					await runReadCommand(args.slice(1))
					break
				case 'cp':
				case 'copy':
					Logger.debug(`shell.run: running cp: ${args.slice(1)}`)

					await runCopyCommand(args.slice(1))
					break
				case 'rm':
				case 'del':
				case 'delete':
				case 'remove':
				case 'trash':
					Logger.debug(`shell.run: running rm: ${args.slice(1)}`)

					await runDeleteCommand(args.slice(1))
					break
				case 'new-drive':
				case 'nd':
				case '::':
					Logger.debug(`shell.run: running new-drive: []`)

					await runNewDriveCommand()
					break
				case 'config':
				case 'cfg':
				case 'conf':
					Logger.debug(`shell.run: running config: ${args.slice(1)}`)

					await runConfigCommand(args.slice(1))
					break
				case 'help':
					Logger.debug(`shell.run: running help: []`)

					await runHelpCommand()
					break
				case 'clear':
				case 'cls':
				case 'clearl':
				case 'clea':
					Logger.debug(`shell.run: running clear: []`)

					await runClearCommand()
					break
				case 'exit':
				case 'q':
				case 'quit':
					Logger.debug(`shell.run: running exit: []`)

					process.exit(0)
				default:
					// If the command is blank, let it pass; else throw an error
					if (!new RegExp(/^\s*$/).test(args.join(' '))) throw new Error('Invalid command')
			}

			// If the command executed successfully, set PROCESSING_COMMAND to false
			process.env.PROCESSING_COMMAND = 'false'
		} catch (error) {
			Logger.debug(`shell.run: error ${error}`)

			// First stop the spinner
			if (Spinner.isActive()) {
				Spinner.stop()
			}

			// If the previous command errored, print the error unless it is a CTRL+C
			// If it is a CTRL+C, the user wants to exit.
			if (error.code === 'SIGINT') {
				// The user wants to exit the program
				process.exit(0)
			} else {
				// Else just print the error
				print(Chalk.red(ErrorUtils.getErrorMessage(error)))
			}
		} finally {
			// Keep running the shell
			await this.run()
		}
	}
}
