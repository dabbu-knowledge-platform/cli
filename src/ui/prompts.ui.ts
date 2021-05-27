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
import { print } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// Ask which server they want to connect to
export const getServerUrl = (): Promise<{ serverUrl: string }> => {
	Logger.debug(
		`ui.prompts.getServerUrl: requesting user to enter serverUrl`,
	)
	return prompt<{ serverUrl: string }>({
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
	Logger.debug(
		`ui.prompts.getDriveProviderAndName: requesting user to enter provider ID and drive name`,
	)

	return prompt<{ selectedProvider: string; driveName: string }>([
		{
			type: 'select',
			name: 'selectedProvider',
			message: Chalk.keyword('orange')(
				'Which provider do you want to connect with this drive? (enter to select the drive, arrow keys to move)',
			),
			choices: providers,
		},
		{
			type: 'input',
			name: 'driveName',
			message: Chalk.keyword('orange')('Enter the name of the drive:'),
			initial: 'c:',
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
	defaultValue: string | undefined = undefined,
): Promise<{ fieldValue: string }> => {
	Logger.debug(
		`ui.prompts.getFieldValueFromUser: requesting user to enter field value: prompt: ${ps}; description: ${description}; type: ${type}; defaultValue: ${defaultValue}`,
	)

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

	return prompt<{ fieldValue: string }>({
		type: promptType,
		name: 'fieldValue',
		message: Chalk.keyword('orange')(ps),
		initial: defaultValue,
	})
}

// Ask the drives to index files from
export const getDrivesToIndex = (
	driveNames: string[],
): Promise<{
	drives: string[]
}> => {
	Logger.debug(
		`ui.prompts.getDrivesToIndex: requesting user to choose drives to index`,
	)

	print(
		Chalk.yellow(
			'The knowledge drive uses the Dabbu Intel API to extract topics, people and places from the information stored in your drives. It will then allow you to view all files regarding a certain topic or regarding a certain person. Pick the drives whose files we should extract topics, people and places from.',
		),
	)

	return prompt<{ drives: string[] }>({
		type: 'multiselect',
		name: 'drives',
		message: Chalk.keyword('orange')(
			'Which drives do you want to extract information from? (space to select the drive, arrow keys to move)',
		),
		choices: driveNames,
	})
}

// Ask the path within the drives to index files from
export const getPathToIndex = (
	driveName: string,
): Promise<{
	path: string
}> => {
	Logger.debug(
		`ui.prompts.getPathToIndex: requesting user to choose path to index`,
	)

	return prompt<{ path: string }>({
		type: 'input',
		name: 'path',
		message: Chalk.keyword('orange')(
			`Enter the absolute path within ${driveName}: to take files from (e.g.: \`/FolderWithDataToExtract\`)`,
		),
		initial: '/',
	})
}

// Read the user's command
export const getUserCommand = (): Promise<{ args: string[] }> => {
	Logger.debug(
		`ui.prompts.getUserCommand: requesting user to enter command`,
	)

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
				history: (Config.get('history') || []) as string[],
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

				Logger.debug(
					`ui.prompts.getUserCommand: received command: ${command}`,
				)

				if (command !== '') {
					Logger.debug(
						`ui.prompts.getUserCommand: adding command to history`,
					)

					// Get current history
					let history = (Config.get('history') as string[]) || []

					// Add the command if the last command is not the same
					if (history[history.length - 1] !== command) {
						history = [...history, command]
						// Set it in config
						Config.set('history', history)
					}
				}

				// If there is an error, throw it
				if (error) {
					Logger.debug(
						`ui.prompts.getUserCommand: error while getting command from user`,
					)

					reject(error)
				}

				// Else return the args wrapped in an object (just to keep in convention
				// with the other prompt functions)
				resolve({ args })
			},
		)
	})
}
