// Command to download and open a file

// Use the axios library to make network requests
import axios, { AxiosRequestConfig } from 'axios'
// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Use the open library to open downloaded files
import Open from 'open'
// Use the fs-extra library to write data to files
import * as Fs from 'fs-extra'
// Use the env paths library to get the local cache path
import EnvPaths from 'env-paths'
const cachePath = EnvPaths('Dabbu CLI', { suffix: '' }).cache
// Use the nanoid library to generate random strings for downloaded files
import { nanoid as Nanoid } from 'nanoid'

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
import * as ProviderUtils from '../utils/provider.util'
// Import the print statement
import { print, json, path } from '../utils/general.util'
// Import the spinner
import * as Spinner from '../ui/spinner.ui'
// Import the logger
import Logger from '../utils/logger.util'

// The list command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`command.read.run: read called with args: ${args}`)
	// Parse the drive and folder path from the args
	const { drive, folderPath, fileName } = FsUtils.parseFilePath(args[0])

	Logger.debug(`command.read.run: drive: ${drive}`)
	Logger.debug(`command.read.run: folderPath: ${folderPath}`)

	// Show a loading indicator
	Spinner.start(
		`Downloading file ${Chalk.keyword('orange')(
			`${drive}:${path(folderPath, fileName)}`,
		)}`,
	)

	Logger.debug(
		`command.read.run: refreshing access token, retrieving request body and headers`,
	)

	// Refresh the access token, if any
	await ProviderUtils.refreshAccessToken(drive)
	// Get the provider ID, request body and request headers of the drive
	const requestMeta = ProviderUtils.getRequestMetadata(drive)

	Logger.debug(`command.read.run: retrieved meta: ${json(requestMeta)}`)

	// Define the options for the request
	let requestOptions: AxiosRequestConfig = {
		method: 'GET',
		baseURL: Config.get('serverUrl') as string,
		url: `/files-api/v3/data/${encodeURIComponent(
			folderPath,
		)}/${encodeURIComponent(fileName)}`,
		params: {
			providerId: requestMeta.providerId,
			exportType: 'media',
		},
		data: requestMeta.requestBodyFields,
		headers: requestMeta.requestHeaderFields,
	}

	Logger.debug(
		`command.read.run: making read request: ${json(requestOptions)}`,
	)

	// Make the request using axios
	const { data } = await axios(requestOptions)

	Logger.debug(`command.read.run: response received: ${json(data)}`)

	// Download the file from the content URI (and send along the headers just in case Authorization is required)
	// First check that the resource returned - exists, is not a folder, and has a content URI
	if (!data.content || !data.content.contentUri) {
		throw new Error('Invalid response from Files API Server')
	}
	if (data.content.kind === 'folder') {
		throw new Error('Cannot download folder')
	}

	// Define the list options to make a request for the file contents
	requestOptions = {
		method: 'GET',
		url: data.content.contentUri,
		// Add the provider header fields, in case authentication is needed
		headers: requestMeta.requestHeaderFields,
		// Return the response as a stream
		responseType: 'stream',
	}

	Logger.debug(
		`command.read.run: making get request on content uri: ${json(
			requestOptions,
		)}`,
	)

	const { data: stream } = await axios(requestOptions)

	Logger.debug(`command.read.run: response stream receieved`)

	// The path where the file will be temporarily downloaded
	const cacheFilePath = `${cachePath}/${Nanoid()}`

	// Create the file
	await Fs.createFile(cacheFilePath)
	// Open a write stream so we can write the data we got to it
	const writer = Fs.createWriteStream(cacheFilePath)

	Logger.debug(`command.read.run: writing stream to ${cacheFilePath}`)

	// Pipe the bytes to the file
	stream.pipe(writer)
	// Wait for it to finish
	await new Promise<void>((resolve, reject) => {
		writer.on('finish', () => {
			// Stop loading
			resolve()
		})
		// Pass the error back on, if any
		writer.on('error', reject)
	})

	// Stop loading
	Spinner.stop()

	// Now tell the user the file has been downloaded
	print(
		Chalk.yellow(
			`File ${drive}:${path(
				folderPath,
				fileName,
			)} downloaded ${Chalk.keyword('orange')(
				'temporarily',
			)} to ${cacheFilePath}. To download it permanently, use the \`cp\` command.`,
		),
	)
	// Open the file using the user's default app
	Open(cacheFilePath, { wait: false })
}
