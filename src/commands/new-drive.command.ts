// Command to create a new drive

// Use the axios library to make network requests
import axios, { AxiosRequestConfig } from 'axios'
// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Use the nanoid library to generate secure random strings
import { nanoid as Nanoid } from 'nanoid'
// Use the HTTP library to create a tiny web server to listen to requests
import * as Http from 'http'
import * as UrlLib from 'url'

// Import all prompts from prompts.ts
import * as Prompts from '../ui/prompts.ui'
// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as ProviderUtils from '../utils/provider.util'
// Import the print statement
import { print, json } from '../utils/general.util'
// Import the logger
import Logger from '../utils/logger.util'

// Get all possible providers we can set up
const getAvailableProviders = async (): Promise<Array<string>> => {
	const availableProviders = [
		'harddrive',
		'googledrive',
		'gmail',
		'onedrive',
	]

	Logger.debug(
		`command.new-drive.getAvailableProviders: available providers: ${availableProviders}`,
	)

	return availableProviders
}

// Check if the drive has any special setup required. If so, show the
// required prompts to the user
const setupDrive = async (
	providerId: string,
	driveName: string,
): Promise<void> => {
	Logger.debug(
		`command.new-drive.setupDrives: drive: ${driveName}; providerId: ${providerId}`,
	)

	// Get the stuff to send in the request body and headers for the given
	// provider
	const providerDetails: ProviderUtils.Provider =
		ProviderUtils.ProviderSpec.filter(
			(providerDetails: ProviderUtils.Provider) =>
				providerDetails.id === providerId,
		)[0]

	Logger.debug(
		`command.new-drive.setupDrives: fetched providerDetails: ${json(
			providerDetails,
		)}`,
	)

	// Check if there are any fields in the request body or header that require
	// user input
	const fields: Array<ProviderUtils.Field> = [
		...providerDetails.requestBodyFields,
		...providerDetails.headerFields,
	]

	Logger.debug(
		`command.new-drive.setupDrives: request fields: ${json(fields)}`,
	)

	// Check that the array is not empty
	if (fields && fields.length > 0) {
		// Loop through all fields
		for (const field of fields) {
			Logger.debug(
				`command.new-drive.setupDrives: processing field ${json(
					field,
				)}`,
			)

			// Check that the value for this field is to be provided by the user
			if (field.userInputNeeded) {
				Logger.debug(
					`command.new-drive.setupDrives: requesting value of field ${field.path} from user`,
				)

				// Get the value of the field from the user
				const { fieldValue } = await Prompts.getFieldValueFromUser(
					field.prompt!,
					field.description,
					field.type,
				)

				Logger.debug(
					`command.new-drive.setupDrives: storing value ${fieldValue} for field ${field.path}`,
				)

				// Store it in the configuration file
				Config.set(`drives.${driveName}.${field.path}`, fieldValue)

				Logger.debug(
					`command.new-drive.setupDrives: set value ${Config.get(
						`drives.${driveName}.${field.path}`,
					)}`,
				)
			} else {
				Logger.debug(
					`command.new-drive.setupDrives: field ${field.path} does not need user input`,
				)
			}
		}
	} else {
		Logger.debug(`command.new-drive.setupDrives: no request fields`)
	}

	// Check for authentication procedures, if any
	if (providerDetails.authDetails) {
		Logger.debug(
			`command.new-drive.setupDrives: provider has auth details: ${json(
				providerDetails.authDetails,
			)}`,
		)

		// Check the process. Currently only OAuth2 is supported
		if (providerDetails.authDetails.process === 'oauth2') {
			Logger.debug(
				`command.new-drive.setupDrives: oauth2 process detected`,
			)
			Logger.debug(
				`command.new-drive.setupDrives: requesting client ID and secret from user`,
			)

			// For OAuth2, we require a client ID and client secret. Get them from
			// the user
			const { fieldValue: clientId } =
				await Prompts.getFieldValueFromUser(
					'Enter the client ID:',
					providerDetails.authDetails.instructions,
					'string',
				)
			const { fieldValue: clientSecret } =
				await Prompts.getFieldValueFromUser(
					'Enter the client secret:',
					undefined,
					'string',
				)

			Logger.debug(
				`command.new-drive.setupDrives: storing client ID: ${clientId}; client secret: ${clientSecret}; redirect URI: ${providerDetails.authDetails.redirectUri}`,
			)

			// Store these values in the configuration file
			Config.set(`drives.${driveName}.authMeta.clientId`, clientId)
			Config.set(
				`drives.${driveName}.authMeta.clientSecret`,
				clientSecret,
			)
			Config.set(
				`drives.${driveName}.authMeta.redirectUri`,
				providerDetails.authDetails.redirectUri,
			)

			Logger.debug(
				`command.new-drive.setupDrives: requesting user authorization`,
			)

			// Now ask the user to authorise the app
			// Construct the URL for authorisation
			// Generate a random string to prevent CORS attacks
			const state = Nanoid()
			const authorisationUrl =
				providerDetails.authDetails.authUri +
				'?client_id=' +
				encodeURIComponent(clientId) +
				'&redirect_uri=' +
				encodeURIComponent(providerDetails.authDetails.redirectUri) +
				'&scope=' +
				encodeURIComponent(providerDetails.authDetails.scopes) +
				'&state=' +
				state +
				'&include_granted_scopes=true' +
				'&response_type=code' +
				'&access_type=offline' +
				'&prompt=consent'

			Logger.debug(
				`command.new-drive.setupDrives: generated auth URL: ${authorisationUrl}`,
			)

			print(
				Chalk.yellow(
					'Please visit this URL to authorise Dabbu (if it shows you an Unsafe site warning, click Advanced > Go to site) - ',
				) + Chalk.keyword('orange')(authorisationUrl),
			)

			// Once the user finishes the auth process, they will be redirected to
			// the mentioned authentication URI. We need to setup a server to parse
			// the URL for the code and then get the token
			// First ensure the URI is a localhost URI
			if (
				providerDetails.authDetails.redirectUri.startsWith(
					'http://localhost:',
				) &&
				providerDetails.authDetails.redirectUri.split(':').length === 3
			) {
				Logger.debug(
					`command.new-drive.setupDrive: localhost redirect uri`,
				)

				const port =
					providerDetails.authDetails.redirectUri.split(':')[2]
				Logger.debug(
					`command.new-drive.setupDrive: starting server on port ${port}`,
				)

				// Start a server and return the authorisation code when the user
				// authorises the CLI
				const code = await new Promise((resolve, reject) => {
					const server = Http.createServer((request, result) => {
						// Return the code only if there is no error and the state variable matches
						const queryParams = UrlLib.parse(
							request.url || '',
							true,
						).query
						Logger.debug(
							`command.new-drive.setupDrive: server received request with params: ${json(
								queryParams,
							)}`,
						)

						if (queryParams.error) {
							Logger.debug(
								`command.new-drive.setupDrive: error occurred, aborting: ${queryParams.error}`,
							)

							result.writeHead(500)
							result.end(
								`The following error occurred: ${queryParams.error}`,
							)
							server.close()
							reject(queryParams.error)
						} else {
							Logger.debug(
								`command.new-drive.setupDrive: authorisation successfull`,
							)

							// Check that the state sent with the request matches the state received
							// eslint-disable-next-line no-lonely-if
							if (queryParams.state === state) {
								Logger.debug(
									`command.new-drive.setupDrive: state verification successfull: ${queryParams.state} === ${state}`,
								)
								result.writeHead(200)
								result.end(
									'Thank you for authorising Dabbu CLI. Please close this window and go back to the CLI to complete the new drive setup.',
								)
								resolve(queryParams.code)
							} else {
								Logger.debug(
									`command.new-drive.setupDrive: state verification failed: ${queryParams.state} !== ${state}`,
								)

								result.writeHead(400)
								result.end(
									'Error: URL state does not match. Please try again.',
								)
								reject(
									new Error(
										'Error: URL state does not match. Please try again.',
									),
								)
							}
						}
					})
					server.listen(port)
				})

				// Make a POST request with the required params
				Logger.debug(
					`command.new-drive.setupDrive: sending access token request`,
				)

				// Put the params as query params or in the request body depending on
				// the provider
				let tokenUrl = providerDetails.authDetails.tokenUri
				Logger.debug(
					`command.new-drive.setupDrive: tokenUri: ${tokenUrl}`,
				)

				tokenUrl +=
					providerDetails.authDetails.sendAuthMetadataIn ===
					'requestQueryParameters'
						? `?code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${providerDetails.authDetails.redirectUri}&grant_type=authorization_code`
						: ''

				const requestOptions: AxiosRequestConfig = {
					method: 'POST',
					url: tokenUrl,
					data:
						providerDetails.authDetails.sendAuthMetadataIn ===
						'requestBodyString'
							? `code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${providerDetails.authDetails.redirectUri}&grant_type=authorization_code`
							: providerDetails.authDetails.sendAuthMetadataIn ===
							  'requestBody'
							? {
									code: code,
									client_id: clientId,
									client_secret: clientSecret,
									redirect_uri: providerDetails.authDetails.redirectUri,
									grant_type: 'authorization_code',
							  }
							: {},
				}
				Logger.debug(
					`command.new-drive.setupDrive: making post request for access token: ${json(
						requestOptions,
					)}`,
				)

				const { data } = await axios(requestOptions)
				Logger.debug(
					`command.new-drive.setupDrive: received response from provider: ${json(
						data,
					)}`,
				)

				// Get the access token, refresh token and expiry time
				const {
					access_token: accessToken,
					refresh_token: refreshToken,
					expires_in: expiresIn,
					token_type: tokenType,
				} = data

				Logger.debug(
					`command.new-drive.setupDrive: storing accessToken: ${
						(tokenType || 'Bearer') + ' ' + accessToken
					}; refreshToken: ${
						refreshToken ||
						Config.get(`drives.${driveName}.auth.refreshToken`)
					} and expiresAt: ${Number(Date.now()) + expiresIn * 1000}`,
				)

				// Store it in config
				Config.set(
					`drives.${driveName}.auth.accessToken`,
					(tokenType || 'Bearer') + ' ' + accessToken,
				)
				Config.set(
					`drives.${driveName}.auth.refreshToken`,
					refreshToken ||
						Config.get(`drives.${driveName}.auth.refreshToken`),
				)
				Config.set(
					`drives.${driveName}.auth.expiresAt`,
					Number(Date.now()) + expiresIn * 1000,
				) // Multiply by thousands to keep milliseconds
			}
		}
	}
}

// The new drive command
export const run = async (): Promise<void> => {
	Logger.debug(`command.new-drive.run: fetching available providers`)

	// List the available
	const providers = await getAvailableProviders()

	Logger.debug(`command.new-drive.run: providers: ${providers}`)

	Logger.debug(
		`command.new-drive.run: requesting provider, drive name from user`,
	)
	// Ask the user to select the provider to connect to this drive and the
	// name of the drive
	let {
		// eslint-disable-next-line prefer-const
		selectedProvider,
		driveName,
	} = await Prompts.getDriveProviderAndName(providers)
	Logger.debug(`command.new-drive.run: raw drive name: ${driveName}`)

	// Remove the colon from the drive name, if any
	driveName = driveName.replace(/:/g, '')
	Logger.debug(`command.new-drive.run: drive name: ${driveName}`)

	Logger.debug(
		`command.new-drive.run: storing drive name: ${driveName}; provider ID: ${selectedProvider}`,
	)
	// Add the drive to the configuration file
	Config.set(`drives.${driveName}.provider`, selectedProvider)

	Logger.debug(
		`command.new-drive.run: checking for provider-specific fields`,
	)
	// Now check if the drive requires any special setup
	await setupDrive(selectedProvider, driveName)

	Logger.debug(
		`command.new-drive.run: setting ${driveName} as current drive`,
	)
	// Set the drive as the current drive
	Config.set('currentDrive', driveName)

	// We're done!
	print(Chalk.green(`Drive ${driveName} was successfully created!`))
}
