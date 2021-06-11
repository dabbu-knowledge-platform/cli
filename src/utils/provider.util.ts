// Use axios to make network requests
import axios, { AxiosRequestConfig } from 'axios'

// Import all methods from config and utils
import * as Config from './config.util'
import { json } from './general.util'
// Import the logger
import Logger from './logger.util'

// A Provider is represented by the following class
export class Provider {
	id: string
	requestBodyFields: Field[]
	headerFields: Field[]
	authDetails: AuthDetails | undefined

	constructor(
		id: string,
		requestBodyFields: Field[],
		headerFields: Field[],
		authDetails: AuthDetails | undefined,
	) {
		this.id = id
		this.requestBodyFields = requestBodyFields
		this.headerFields = headerFields
		this.authDetails = authDetails
	}
}

// A request body/header field is represented as follows
export class Field {
	name: string
	type: 'string' | 'number'
	description: string
	prompt: string | undefined
	userInputNeeded: boolean
	path: string

	constructor(
		name: string,
		type: 'string' | 'number',
		description: string,
		prompt: string | undefined,
		userInputNeeded: boolean,
		path: string,
	) {
		this.name = name
		this.type = type
		this.description = description
		this.prompt = prompt
		this.userInputNeeded = userInputNeeded
		this.path = path
	}
}

// Auth related stuff for providers
export class AuthDetails {
	process: 'oauth2'
	authUri: string
	tokenUri: string
	scopes: string
	redirectUri: string
	sendAuthMetadataIn:
		| 'requestQueryParameters'
		| 'requestBody'
		| 'requestBodyString'
	instructions: string

	constructor(
		process: 'oauth2',
		authUri: string,
		tokenUri: string,
		scopes: string,
		redirectUri: string,
		sendAuthMetadataIn:
			| 'requestQueryParameters'
			| 'requestBody'
			| 'requestBodyString',
		instructions: string,
	) {
		this.process = process
		this.authUri = authUri
		this.tokenUri = tokenUri
		this.scopes = scopes
		this.redirectUri = redirectUri
		this.sendAuthMetadataIn = sendAuthMetadataIn
		this.instructions = instructions
	}
}

// A list of providers supported by the CLI
export const ProviderSpec: Provider[] = [
	new Provider(
		'harddrive',
		[
			new Field(
				'basePath',
				'string',
				'The path to treat as root for this drive, usually your home directory (on Windows, it is C:\\Users\\<user name>\\) (on Linux, it is /home/<user name>/) (on MacOS, it is /Users/<user name>/)',
				'The folder to treat as root for this drive',
				true,
				'basePath',
			),
		],
		[],
		undefined,
	),
	new Provider(
		'googledrive',
		[],
		[
			new Field(
				'X-Provider-Credentials',
				'string',
				"The access token retrieved from Google's OAuth servers upon user authorisation to access their Google Drive",
				undefined,
				false,
				'auth.accessToken',
			),
		],
		new AuthDetails(
			'oauth2',
			'https://accounts.google.com/o/oauth2/v2/auth',
			'https://oauth2.googleapis.com/token',
			'https://www.googleapis.com/auth/drive',
			'http://localhost:8081',
			'requestQueryParameters',
			'Follow the instructions given on this page - https://gist.github.com/gamemaker1/01eb0e7b7b1dd89ae536942c75896e60. Then copy the client ID and secret you get and paste them here.',
		),
	),
	new Provider(
		'gmail',
		[],
		[
			new Field(
				'X-Provider-Credentials',
				'string',
				"The access token retrieved from Google's OAuth servers upon user authorisation to access Gmail",
				undefined,
				false,
				'auth.accessToken',
			),
		],
		new AuthDetails(
			'oauth2',
			'https://accounts.google.com/o/oauth2/v2/auth',
			'https://oauth2.googleapis.com/token',
			'https://www.googleapis.com/auth/gmail.modify',
			'http://localhost:8081',
			'requestQueryParameters',
			'Follow the instructions given on this page - https://gist.github.com/gamemaker1/01eb0e7b7b1dd89ae536942c75896e60. Then copy the client ID and secret you get and paste them here.',
		),
	),
	new Provider(
		'onedrive',
		[],
		[
			new Field(
				'X-Provider-Credentials',
				'string',
				"The access token retrieved from Microsoft's OAuth servers upon user authorisation to access their OneDrive",
				undefined,
				false,
				'auth.accessToken',
			),
		],
		new AuthDetails(
			'oauth2',
			'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
			'https://login.microsoftonline.com/common/oauth2/v2.0/token',
			'offline_access https://graph.microsoft.com/Files.ReadWrite.All',
			'http://localhost:8081',
			'requestBodyString',
			'Follow the instructions given on this page - https://gist.github.com/gamemaker1/01eb0e7b7b1dd89ae536942c75896e60. Then copy the client ID and secret you get and paste them here.',
		),
	),
]

// A function to return the provider ID, request body and request header for a
// particular drive
export function getRequestMetadata(driveName: string): {
	providerId: string
	requestBodyFields: Record<string, any>
	requestHeaderFields: Record<string, any>
} {
	// Get the provider ID of the drive
	const providerId = Config.get(
		`drives.${driveName}.provider`,
	) as string

	Logger.debug(
		`util.provider.getRequestMetadata: getting request headers and body provider ID ${providerId}`,
	)

	// Get the stuff to send in the request body and headers for the given
	// provider
	const providerDetails: Provider = ProviderSpec.filter(
		(providerDetails: Provider) => providerDetails.id === providerId,
	)[0]

	Logger.debug(
		`util.provider.getRequestMetadata: providerDetails: ${json(
			providerDetails,
		)}`,
	)

	// Get the request body and headers
	const requestBodyFields: Record<string, any> = {}
	for (const field of providerDetails.requestBodyFields) {
		requestBodyFields[field.name] = Config.get(
			`drives.${driveName}.${field.path}`,
		)
	}
	Logger.debug(
		`util.provider.getRequestMetadata: generated request body: ${json(
			requestBodyFields,
		)}`,
	)

	const requestHeaderFields: Record<string, any> = {}
	for (const field of providerDetails.headerFields) {
		requestHeaderFields[field.name] = Config.get(
			`drives.${driveName}.${field.path}`,
		)
	}
	Logger.debug(
		`util.provider.getRequestMetadata: generated request headers: ${json(
			requestHeaderFields,
		)}`,
	)

	// Return everything
	return { providerId, requestBodyFields, requestHeaderFields }
}

// A function to refresh the access token of a particular drive
export async function refreshAccessToken(
	driveName: string,
): Promise<void> {
	// Get the provider ID of the drive
	const providerId = Config.get(
		`drives.${driveName}.provider`,
	) as string

	Logger.debug(
		`util.provider.refreshAccessToken: refreshing access token: drive: ${driveName}; provider ID: ${providerId}`,
	)

	// Get the stuff to send in the request body and headers for the given
	// provider
	const providerDetails: Provider = ProviderSpec.filter(
		(providerDetails: Provider) => providerDetails.id === providerId,
	)[0]
	Logger.debug(
		`util.provider.refreshAccessToken: providerDetails: ${json(
			providerDetails,
		)}`,
	)

	// Get the auth details
	const authDetails = providerDetails.authDetails
	Logger.debug(
		`util.provider.refreshAccessToken: authDetails: ${json(
			authDetails,
		)}`,
	)

	// Get the refresh token
	const refreshToken = Config.get(
		`drives.${driveName}.auth.refreshToken`,
	) as string | undefined
	Logger.debug(
		`util.provider.refreshAccessToken: refresh token: ${refreshToken}`,
	)

	// Make sure there is a refresh token and auth details and the auth process
	// is OAuth2
	if (authDetails && authDetails.process === 'oauth2' && refreshToken) {
		Logger.debug(
			`util.provider.refreshAccessToken: making request to server`,
		)

		// Define the request options
		const requestOptions: AxiosRequestConfig = {
			method: 'post',
			url:
				authDetails?.sendAuthMetadataIn === 'requestQueryParameters'
					? authDetails.tokenUri +
					  `?client_id=${encodeURIComponent(
							Config.get(
								`drives.${driveName}.authMeta.clientId`,
							) as string,
					  )}&client_secret=${encodeURIComponent(
							Config.get(
								`drives.${driveName}.authMeta.clientSecret`,
							) as string,
					  )}&redirect_uri=${encodeURIComponent(
							authDetails.redirectUri,
					  )}&refresh_token=${encodeURIComponent(
							refreshToken,
					  )}&grant_type=refresh_token`
					: authDetails.tokenUri,
			data:
				authDetails?.sendAuthMetadataIn === 'requestBodyString'
					? `client_id=${encodeURIComponent(
							Config.get(
								`drives.${driveName}.authMeta.clientId`,
							) as string,
					  )}&client_secret=${encodeURIComponent(
							Config.get(
								`drives.${driveName}.authMeta.clientSecret`,
							) as string,
					  )}&redirect_uri=${encodeURIComponent(
							authDetails.redirectUri,
					  )}&refresh_token=${encodeURIComponent(
							refreshToken,
					  )}&grant_type=refresh_token`
					: authDetails?.sendAuthMetadataIn === 'requestBody'
					? {
							client_id: encodeURIComponent(
								Config.get(
									`drives.${driveName}.authMeta.clientId`,
								) as string,
							),
							client_secret: encodeURIComponent(
								Config.get(
									`drives.${driveName}.authMeta.clientSecret`,
								) as string,
							),
							redirect_uri: encodeURIComponent(authDetails.redirectUri),
							refresh_token: encodeURIComponent(refreshToken),
							grant_type: 'refresh_token',
					  }
					: {},
		}

		Logger.debug(
			`util.provider.refreshAccessToken: request options: ${json(
				requestOptions,
			)}`,
		)

		// Make a request to refresh the token
		const serverResponse = await axios(requestOptions)

		Logger.debug(
			`util.provider.refreshAccessToken: received server response: ${json(
				serverResponse,
			)}`,
		)

		// Store the result in the config
		const result = {
			accessToken: `${serverResponse.data.token_type || 'Bearer'} ${
				serverResponse.data.access_token
			}`,
			refreshToken: refreshToken,
			expiresAt:
				Number(Date.now()) + serverResponse.data.expires_in * 1000,
		}

		Logger.debug(
			`util.provider.refreshAccessToken: storing creds: ${json(
				result,
			)}`,
		)

		Config.set(`drives.${driveName}.auth`, result)
	}
}
