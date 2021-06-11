// The main file

// Use the axios library to make network requests
import axios, { AxiosRequestConfig } from 'axios'
// Use the figlet library to draw the logo
import Figlet from 'figlet'
// Use the chalk library to write colourful text
import Chalk from 'chalk'

// Import all prompts from prompts.ts
import * as Prompts from './ui/prompts.ui'
// Import the NewDrive commands from commands.ts
import { run as runNewDriveCommand } from './commands/new-drive.command'
// Import the shell from shell.ts
import Shell from './shell'
// Import all methods from config and utils
import * as Config from './utils/config.util'
import * as ErrorUtils from './utils/errors.util'
// Import the print statement
import { print, json } from './utils/general.util'
// Import the logger
import Logger from './utils/logger.util'

// Draw 'Dabbu' in the Figlet font
const drawLogo = async (): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		Logger.debug(`startup.drawLogo: running`)
		Figlet('Dabbu', (error, data) => {
			if (error) {
				Logger.debug(`startup.drawLogo: error occurred: ${error}`)

				reject(error)
			}

			if (data) {
				Logger.debug(`startup.drawLogo: successfull`)

				print(Chalk.keyword('orange')(data))
				print(
					Chalk.keyword('orange')(
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						`Dabbu CLI v${require('../package.json').version}\n`,
					),
				)

				resolve()
			}
		})
	})
}

// Check the configuration. If the user has not gone through setup, redirect
// them to it. If there is no drive but setup has been done, redirect the user
// to create a new drive. If the current drive is invalid, set the drive to the
// next valid drive
const checkConfig = async (): Promise<void> => {
	Logger.debug(`startup.checkConfig: checking serverUrl`)

	// Check if the server url exists
	const serverUrl =
		Config.get('defaults.filesApiServerUrl') ||
		'https://dabbu-server.herokuapp.com'

	Logger.debug(`startup.checkConfig: serverUrl: ${serverUrl}`)

	// If it is not there, ask the user for it
	if (!serverUrl) {
		Logger.debug(`startup.checkConfig: requesting serverUrl from user`)

		// Ask the user for the Files API Server url
		const { serverUrl } = await Prompts.getServerUrl()

		Logger.debug(
			`startup.checkConfig: setting serverUrl to ${serverUrl}`,
		)

		// Once we get it, set it
		Config.set('defaults.filesApiServerUrl', serverUrl)

		Logger.debug(
			`startup.checkConfig: set serverUrl to ${Config.get(
				'defaults.filesApiServerUrl',
			)}`,
		)
	}

	Logger.debug(`startup.checkConfig: checking drives`)

	// Now check if there are any drives
	const drives = Config.get('drives') as Record<string, any>

	Logger.debug(`startup.checkConfig: drives: ${json(drives)}`)

	// If none exist, create a new one
	if (!drives) {
		Logger.debug(
			`startup.checkConfig: drives is undefined; running new-drive`,
		)

		// Run the new drive command
		await runNewDriveCommand()

		Logger.debug(
			`startup.checkConfig: drive created - ${json(
				Config.get('drives'),
			)}`,
		)
	}

	const checkCreds = async () => {
		Logger.debug(
			`startup.checkConfig: checking client ID - API key pair`,
		)

		// Check if the credentials exist for the Intel API server
		// The creds.intelApiServer object will be of the following format: {
		//	 clientId: '...',
		//   apiKey: '...',
		//   token: '...'
		// }
		let creds = Config.get('creds.intelApiServer')

		Logger.debug(`startup.checkConfig: creds: ${json(creds)}`)

		// Make a request to the server to check the creds
		// If they are invalid, set this variable to true to force a refresh
		// in the next step
		let invalidCreds = false
		if (creds && creds.intelApiServer && creds.intelApiServer.token) {
			Logger.debug(
				`startup.checkConfig: making test request for creds validity`,
			)

			// Define the request options
			const requestOptions: AxiosRequestConfig = {
				method: 'POST',
				baseURL:
					Config.get('defaults.intelApiServerUrl') ||
					'https://dabbu-intel.herokuapp.com',
				url: '/intel-api/v1/extract-info/',
				headers: {
					'X-Credentials': creds.intelApiServer.token as string,
				},
			}

			Logger.debug(
				`startup.checkConfig: making get request for creds check: ${json(
					requestOptions,
				)}`,
			)

			// Make the request using axios
			try {
				const { data } = await axios(requestOptions)

				Logger.debug(
					`startup.checkConfig: creds valid; response received: ${json(
						data,
					)}`,
				)
			} catch (error) {
				if (
					error.response &&
					error.response.data &&
					error.response.data.error &&
					error.response.data.error.reason === 'invalidCredentials'
				) {
					Logger.debug(
						`startup.checkConfig: creds invalid; error received: ${json(
							error.response.data,
						)}`,
					)

					invalidCreds = true
				}
			}
		}

		// If they are undefined or invalid, get the credentials
		if (
			!creds ||
			!creds.intelApiServer ||
			!creds.intelApiServer.clientId ||
			!creds.intelApiServer.apiKey ||
			invalidCreds
		) {
			Logger.debug(
				`startup.checkConfig: missing or invalid creds; registering new client with server`,
			)

			// Make a request to the server to register a client
			// Define the request options
			const requestOptions: AxiosRequestConfig = {
				method: 'POST',
				baseURL: Config.get('defaults.intelApiServerUrl') as string,
				url: '/intel-api/v1/clients/',
			}

			Logger.debug(
				`startup.checkConfig: making post request: ${json(
					requestOptions,
				)}`,
			)

			// Make the request using axios
			try {
				let { data } = await axios(requestOptions)

				Logger.debug(
					`startup.checkConfig: response received: ${json(data)}`,
				)

				// Store the received client ID and API key
				Config.set('creds.intelApiServer.clientId', data.content.id)
				Config.set('creds.intelApiServer.apiKey', data.content.apiKey)
				// Compute the token [base64('<CLIENT ID>' + ':' + '<API KEY>')]
				Config.set(
					'creds.intelApiServer.token',
					Buffer.from(
						`${data.content.id}:${data.content.apiKey}`,
					).toString('base64'),
				)

				Logger.debug(
					`startup.checkConfig: credentials obtained - ${json(
						Config.get('creds'),
					)}`,
				)
			} catch (error) {
				Logger.error(
					`startup.checkConfig: error while registering client with intel-api-server, skipping: ${error}`,
				)
			}
		}

		// Check if the credentials exist for the Files API server
		// The creds.filesApiServer object will be of the following format: {
		//	 clientId: '...',
		//   apiKey: '...',
		//   token: '...'
		// }
		creds = Config.get('creds.filesApiServer')

		Logger.debug(`startup.checkConfig: creds: ${json(creds)}`)

		// Make a request to the server to check the creds
		// If they are invalid, set this variable to true to force a refresh
		// in the next step
		invalidCreds = false
		if (creds && creds.filesApiServer && creds.filesApiServer.token) {
			Logger.debug(
				`startup.checkConfig: making test request for creds validity`,
			)

			// Define the request options
			const requestOptions: AxiosRequestConfig = {
				method: 'GET',
				baseURL:
					Config.get('defaults.filesApiServerUrl') ||
					('https://dabbu-server.herokuapp.com' as string),
				url: '/files-api/v3/providers/',
				headers: {
					'X-Credentials': creds.filesApiServer.token as string,
				},
			}

			Logger.debug(
				`startup.checkConfig: making get request for creds check: ${json(
					requestOptions,
				)}`,
			)

			// Make the request using axios
			try {
				const { data } = await axios(requestOptions)

				Logger.debug(
					`startup.checkConfig: creds valid; response received: ${json(
						data,
					)}`,
				)
			} catch (error) {
				if (
					error.response &&
					error.response.data &&
					error.response.data.error &&
					error.response.data.error.reason === 'invalidCredentials'
				) {
					Logger.debug(
						`startup.checkConfig: creds invalid; error received: ${json(
							error.response.data,
						)}`,
					)

					invalidCreds = true
				}
			}
		}

		// If they are undefined or invalid, get the credentials
		if (
			!creds ||
			!creds.filesApiServer ||
			!creds.filesApiServer.clientId ||
			!creds.filesApiServer.apiKey ||
			invalidCreds
		) {
			Logger.debug(
				`startup.checkConfig: missing or invalid creds; registering new client with server`,
			)

			// Make a request to the server to register a client
			// Define the request options
			const requestOptions: AxiosRequestConfig = {
				method: 'POST',
				baseURL:
					Config.get('defaults.filesApiServerUrl') ||
					('https://dabbu-server.herokuapp.com' as string),
				url: '/files-api/v3/clients/',
			}

			Logger.debug(
				`startup.checkConfig: making post request: ${json(
					requestOptions,
				)}`,
			)

			// Make the request using axios
			try {
				const { data } = await axios(requestOptions)

				Logger.debug(
					`startup.checkConfig: response received: ${json(data)}`,
				)

				// Store the received client ID and API key
				Config.set('creds.filesApiServer.clientId', data.content.id)
				Config.set('creds.filesApiServer.apiKey', data.content.apiKey)
				// Compute the token [base64('<CLIENT ID>' + ':' + '<API KEY>')]
				Config.set(
					'creds.filesApiServer.token',
					Buffer.from(
						`${data.content.id}:${data.content.apiKey}`,
					).toString('base64'),
				)

				Logger.debug(
					`startup.checkConfig: credentials obtained - ${json(
						Config.get('creds'),
					)}`,
				)
			} catch (error) {
				Logger.error(
					`startup.checkConfig: error while registering client with files-api-server, skipping: ${error}`,
				)
			}
		}
	}

	// Check creds in the background, don't block the CLI on this
	checkCreds()
}

// Start the Dabbu shell
const startShell = async (): Promise<void> => {
	Logger.debug(`startup.startShell: starting shell`)

	// Instantiate the shell
	const shell = new Shell()
	// Run the shell
	await shell.run()
}

// The main function
const main = async (): Promise<void> => {
	// Surround the entire thing in a try-catch block to print the error if any
	try {
		// Draw the logo
		await drawLogo()
		// Check up on config
		await checkConfig()
	} catch (error) {
		Logger.error(
			`main: error while drawing logo or checking config: ${json(
				error,
			)}`,
		)

		print(Chalk.red(ErrorUtils.getErrorMessage(error)))
	}

	// Once the initial setup is done, run the shell
	await startShell()
}

// Log the fact that we are runnning the CLI
Logger.debug(`main: starting cli`)
// Run the main function to start the CLI
main()
