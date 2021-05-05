// All the questions the user can be asked (related to configuration, the
// command prompt itself, etc.)

// Use the enquirer library to ask questions
import { prompt } from 'enquirer'
// Use the readcommand library to accept commands
import ReadCommand from 'readcommand'
// Use the chalk library to write colourful text
import Chalk from 'chalk'

// Import all methods from config and utils
import * as Config from '../utils/config.util'
// Import the print statement
import { print, json } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// Ask which server they want to connect to
export const getServerUrl = (): Promise<{ serverUrl: string }> => {
	return prompt({
		type: 'input',
		name: 'serverUrl',
		message: Chalk.keyword('orange')(
			'Which server do you want to connect to?',
		),
		initial: 'https://dabbu-server.herokuapp.com',
		// FIXME: Doesn't work for localhost URLs with the port number specified
		/*validate: (text: string): boolean => {
			return RegExp(
				/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/,
			).test(text)
		},*/
	})
}

// Ask which provider they want to connect to a new drive
export const getDriveProviderAndName = (
	providers: string[],
): Promise<{
	selectedProvider: string
	driveName: string
}> => {
	return prompt([
		{
			type: 'select',
			name: 'selectedProvider',
			message: Chalk.keyword('orange')(
				'Which provider do you want to connect with this drive?',
			),
			choices: providers,
		},
		{
			type: 'input',
			name: 'driveName',
			message: Chalk.keyword('orange')('Enter the name of the drive:'),
			initial: 'C:',
			validate: (text: string): boolean => {
				return RegExp(/[a-zA-Z0-9]/).test(text) && text.length < 10
			},
		},
	])
}

// Get the value of a field that is required to connect to a provider
export const getFieldValueFromUser = (
	ps: string,
	description: string | undefined,
	type: 'string' | 'number',
): Promise<{ fieldValue: string }> => {
	let promptType: string
	switch (type) {
		case 'string':
			promptType = 'input'
			break
		case 'number':
			promptType = 'number'
			break
	}

	if (description) print(Chalk.yellow(description))

	return prompt({
		type: promptType,
		name: 'fieldValue',
		message: Chalk.keyword('orange')(ps),
	})
}

// Read the user's command
export const getUserCommand = async (): Promise<{ args: string[] }> => {
	// Wrap it all in a promise, the readcommand module uses a callback
	return new Promise((resolve, reject) => {
		ReadCommand.read(
			{
				// The prompt you see before typing a command
				ps1: Chalk.cyan(
					`${Config.get('currentDrive')}:${
						Config.get(`drives.${Config.get('currentDrive')}.path`) ||
						''
					}$ `,
				),
				// Access previous commands by pressing the up arraw key
				history: (Config.get('history') || []) as Array<string>,
			},
			(error: Error, args: string[]) => {
				// First store the command in the config file
				// TODO: Store history separately?
				const command = args
					.map((arg) => {
						if (arg.includes(' ')) {
							return `"${arg}"`
						}
						return arg
					})
					.join(' ')
				if (command !== '') {
					// Get current history
					let history = (Config.get('history') as Array<string>) || []

					// Add the command
					history = [...history, command]
					// Set it in config
					Config.set('history', history)
				}

				// If there is an error, throw it
				if (error) {
					reject(error)
				}

				// Else return the args wrapped in an object (just to keep in convention
				// with the other prompt functions)
				resolve({ args })
			},
		)
	})
}
