// Command to list files and subfolders in a drive

// Use the axios library to make network requests
import axios, { AxiosRequestConfig } from 'axios'
// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Use the cli table library to draw a table of files
import Table from 'cli-table3'
// Use the terminal link library to hyperlink text
import hyperlink from 'terminal-link'

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
import * as ProviderUtils from '../utils/provider.util'
// Import the print statement
import { print, json } from '../utils/general.util'
// Import the spinner
import * as Spinner from '../ui/spinner.ui'
// Import the logger
import Logger from '../utils/logger.util'

// The list command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`command.list.run: ls called with args: ${args}`)
	// Parse the drive and folder path from the args
	const { drive, folderPath } = FsUtils.parseFolderPath(args[0])

	Logger.debug(`command.list.run: drive: ${drive}`)
	Logger.debug(`command.list.run: folderPath: ${folderPath}`)

	// Show a loading indicator
	Spinner.start(
		`Listing files in ${Chalk.keyword('orange')(
			`${drive}:${folderPath}`,
		)}`,
	)

	Logger.debug(
		`command.list.run: refreshing access token, retrieving request body and headers`,
	)

	// Refresh the access token, if any
	await ProviderUtils.refreshAccessToken(drive)
	// Get the provider ID, request body and request headers of the drive
	const requestMeta = ProviderUtils.getRequestMetadata(drive)

	Logger.debug(`command.list.run: retrieved meta: ${json(requestMeta)}`)

	// The list request requires pagination, which means results will be returned
	// 50 at a time. The server will return a `nextSetToken` if there are more
	// than 50 files in that folder. We need to make the same request and supply
	// the nextSetToken as well in the query parameters to get the next 50 files,
	// and so on, until the server does not return a nextSetToken.
	let nextSetToken: string | undefined = undefined
	do {
		// Define the options for the request
		const requestOptions: AxiosRequestConfig = {
			method: 'GET',
			baseURL: Config.get('serverUrl') as string,
			url: `/files-api/v3/data/${encodeURIComponent(folderPath)}`,
			params: {
				providerId: requestMeta.providerId,
				exportType: 'view',
				nextSetToken: nextSetToken,
			},
			data: requestMeta.requestBodyFields,
			headers: {
				...requestMeta.requestHeaderFields,
				'X-Credentials': Config.get('creds.token') as string,
			},
		}

		Logger.debug(
			`command.list.run: making list request: ${json(requestOptions)}`,
		)

		// Make the request using axios
		const { data } = await axios(requestOptions)

		Logger.debug(`command.list.run: response received: ${json(data)}`)

		// Stop loading once the results come
		const text = Spinner.stop()

		// Print out the files
		Logger.debug(`command.list.run: printing files`)

		// Create a table with the headers (headers should be shown only the first
		// time the operation is run, subsequently, only the files should be shown)
		const table = new Table(
			!nextSetToken
				? {
						head: [
							Chalk.green('Name'),
							Chalk.green('Size'),
							Chalk.green('Type'),
							Chalk.green('Last modified'),
							Chalk.green('Action(s)'),
						],
						colWidths: [null, null, null, null, null],
				  }
				: undefined,
		)
		for (let i = 0, length = data.content.length; i < length; i++) {
			const file = data.content[i]

			Logger.debug(`command.list.run: printing file: ${json(file)}`)

			// File name - blue if folder, magenta if file
			const name = file.name
			const fileName =
				file.kind === 'folder'
					? `${Chalk.blue(name)} (folder)`
					: Chalk.magenta(name)
			// File size in a human readable unit
			const fileSize =
				!file.size || file.kind === 'folder'
					? '-'
					: FsUtils.makeSizeReadable(file.size)
			// Mime type of file
			const fileType = file.mimeType
			// Last modified time
			let dateModified = new Date(
				file.lastModifiedTime,
			).toLocaleDateString()
			if (dateModified === 'Invalid Date') {
				dateModified = '-'
			}

			// Convert the download link to a hyper link and then display it (only
			// for files)
			let downloadLink
			if (file.contentUri && file.kind !== 'folder') {
				downloadLink = hyperlink('View file', file.contentUri, {
					fallback: (text: string, url: string) => `${text} (${url})`,
				})
			} else {
				downloadLink = 'Link unavailable'
			}

			table.push([
				fileName,
				fileSize,
				fileType,
				dateModified,
				downloadLink,
			])
		}

		// Print out the table
		if (table.length > 0) {
			if (!nextSetToken) print(`${table.length} files/folders`)
			print(table.toString())
		} else {
			Logger.debug(`command.list.run: folder is empty`)

			print(Chalk.yellow('Folder is empty'))
		}

		// Set the nextSetToken variable to the one returned by the server
		nextSetToken = data.nextSetToken

		// Start loading again
		Spinner.start(text)
	} while (nextSetToken)

	// Stop loading once all the results have arrived
	Spinner.stop()
}
