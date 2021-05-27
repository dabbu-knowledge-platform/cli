// Command to list files and subfolders in a drive

// Use the axios library to make network requests
import axios, { AxiosRequestConfig } from 'axios'
// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Use the cli table library to draw a table of files
import Table from 'cli-table3'
// Use the terminal link library to hyperlink text
import hyperlink from 'terminal-link'
// Use the fs-extra library to perform disk operations
import * as Fs from 'fs-extra'
// Use the file-type library to recognise the mime type of the file
import * as FileType from 'file-type'

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
import * as ProviderUtils from '../utils/provider.util'
// Import the print statement
import { print, json, path as diskPath } from '../utils/general.util'
// Import the spinner
import * as Spinner from '../ui/spinner.ui'
// Import the logger
import Logger from '../utils/logger.util'

// A function to print out the files received as a table
function printFiles(
	files: Record<string, any>[],
	printHeaders = true,
): void {
	// Create a table with the headers (headers should be shown only the first
	// time the operation is run, subsequently, only the files should be shown)
	const table = new Table(
		printHeaders
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
	for (let i = 0, length = files.length; i < length; i++) {
		const file = files[i]

		Logger.debug(
			`command.list.printFiles: printing file: ${json(file)}`,
		)

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
		if (printHeaders) print(`${table.length} files/folders`)
		print(table.toString())
	} else {
		Logger.debug(`command.list.printFiles: folder is empty`)

		print(Chalk.yellow('Folder is empty'))
	}
}

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

	// If the provider is harddrive, then manually list files from the hard drive
	if (Config.get(`drives.${drive}.provider`) === 'harddrive') {
		const basePath =
			(Config.get(`drives.${drive}.basePath`) as string | undefined) ||
			'/'

		// Check if the folder exists
		if (!(await Fs.pathExists(diskPath(basePath, folderPath)))) {
			print(
				Chalk.red(
					`Folder ${diskPath(basePath, folderPath)} was not found`,
				),
			)
		}

		// List the files and folders at that location
		const files = await Fs.readdir(diskPath(basePath, folderPath))

		const parsedFiles: Record<string, any>[] = []

		// Then loop through the list of files
		for (let i = 0, { length } = files; i < length; i++) {
			const fileName = files[i]

			// Get the statistics related to that file, `Fs.readdir` only gives the
			// name
			// NOTE: Change to lstat if you want to support sym links
			// eslint-disable-next-line no-await-in-loop
			const statistics = await Fs.stat(
				diskPath(basePath, folderPath, fileName),
			)

			// Name of the file
			const name = fileName
			// Whether it's a file or folder
			const kind = statistics.isDirectory() ? 'folder' : 'file'
			// Path to that file locally
			const path = diskPath(folderPath, fileName)
			// The mime type of the file
			let mimeType: string
			if (statistics.isDirectory()) {
				mimeType = 'inode/directory'
			} else {
				mimeType =
					// eslint-disable-next-line no-await-in-loop
					(
						(await FileType.fromFile(
							diskPath(basePath, folderPath, fileName),
						)) || {}
					).mime || ''
			}

			// Size in bytes, let clients convert to whatever unit they want
			const { size } = statistics
			// When it was created
			const createdAtTime = new Date(statistics.birthtime).getUTCDate()
			// Last time the file or its metadata was changed
			const lastModifiedTime = new Date(statistics.mtime).getUTCDate()
			// Content URI, allows the file to be downloaded
			const contentUri =
				'file://' +
				diskPath(basePath, folderPath, fileName).replace(/ /g, '%20')

			// Append to a final array that will be returned
			parsedFiles.push({
				name,
				kind,
				provider: 'harddrive',
				path,
				mimeType,
				size,
				createdAtTime,
				lastModifiedTime,
				contentUri,
			})
		}

		// Stop loading once all the files have been parsed and listed
		Spinner.stop()
		// Now sort the files (dirs first) and print them out
		printFiles(
			parsedFiles.sort((a, b) =>
				a.kind === 'folder' && b.kind !== 'folder' ? -1 : 1,
			),
		)

		// Return
		return
	}

	Logger.debug(
		`command.list.run: refreshing access token, retrieving request body and headers`,
	)

	// The list request requires pagination, which means results will be returned
	// 50 at a time. The server will return a `nextSetToken` if there are more
	// than 50 files in that folder. We need to make the same request and supply
	// the nextSetToken as well in the query parameters to get the next 50 files,
	// and so on, until the server does not return a nextSetToken.
	let nextSetToken: string | undefined = undefined
	do {
		Logger.debug(
			`command.copy.listFiles: refreshing access token, retrieving request body and headers`,
		)

		// Refresh the access token, if any
		await ProviderUtils.refreshAccessToken(drive)
		// Get the provider ID, request body and request headers of the drive
		const requestMeta = ProviderUtils.getRequestMetadata(drive)

		Logger.debug(
			`command.copy.listFiles: retrieved meta: ${json(requestMeta)}`,
		)

		// Define the options for the request
		const requestOptions: AxiosRequestConfig = {
			method: 'GET',
			baseURL: Config.get('defaults.filesApiServerUrl') as string,
			url: `/files-api/v3/data/${encodeURIComponent(folderPath)}`,
			params: {
				providerId: requestMeta.providerId,
				exportType: 'view',
				nextSetToken: nextSetToken,
			},
			data: requestMeta.requestBodyFields,
			headers: {
				...requestMeta.requestHeaderFields,
				'X-Credentials': Config.get(
					'creds.filesApiServer.token',
				) as string,
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
		printFiles(data.content, !nextSetToken)

		// Set the nextSetToken variable to the one returned by the server
		nextSetToken = data.nextSetToken

		// Start loading again
		Spinner.start(text)
	} while (nextSetToken)

	// Stop loading once all the results have arrived
	Spinner.stop()
}
