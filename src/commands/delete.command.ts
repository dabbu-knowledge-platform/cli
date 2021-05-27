// Command to delete a file/folder

// Use the axios library to make network requests
import axios, { AxiosRequestConfig } from 'axios'
// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Use the fs-extra library to delete files
import * as Fs from 'fs-extra'

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

// The delete command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`command.delete.run: delete called with args: ${args}`)

	// Check if the user has provided a file/folder path
	if (!args[0]) {
		throw new Error(
			'Please enter the path to the file/folder you want to delete, like this: `del ./Presentation.pptx` OR `del "./Work Files/"`',
		)
	}

	// If the path is a folder path, it will have a trailing '/', else consider it to be a file
	let drive, folderPath, fileName
	if (args[0].endsWith('/')) {
		const parsedPath = FsUtils.parseFolderPath(args[0])
		drive = parsedPath.drive
		folderPath = parsedPath.folderPath
		fileName = undefined
	} else {
		const parsedPath = FsUtils.parseFilePath(args[0])
		drive = parsedPath.drive
		folderPath = parsedPath.folderPath
		fileName = parsedPath.fileName
	}

	Logger.debug(`command.delete.run: drive: ${drive}`)
	Logger.debug(`command.delete.run: folderPath: ${folderPath}`)
	Logger.debug(`command.delete.run: fileName: ${fileName}`)

	// Show a loading indicator
	Spinner.start(
		`Deleting ${Chalk.keyword('orange')(
			`${drive}:${diskPath(folderPath, fileName)}`,
		)}`,
	)

	// If the provider is harddrive, then manually read the file from the hard drive
	if (Config.get(`drives.${drive}.provider`) === 'harddrive') {
		const basePath =
			(Config.get(`drives.${drive}.basePath`) as string | undefined) ||
			'/'

		// Check if the file/folder exists
		// If there is no fileName, the diskPath function will ignore it,
		// effectively checking for only the folder
		if (
			!(await Fs.pathExists(diskPath(basePath, folderPath, fileName)))
		) {
			print(
				Chalk.red(
					`File/Folder ${diskPath(
						basePath,
						folderPath,
						fileName,
					)} was not found`,
				),
			)
		}

		// Delete the file/folder using Fs.rm()
		await Fs.rm(diskPath(basePath, folderPath, fileName), {
			recursive: true,
		})

		// Stop loading
		Spinner.stop()

		// Now tell the user the file has been deleted
		print(
			Chalk.yellow(
				`Deleted ${drive}:${diskPath(folderPath, fileName)}`,
			),
		)

		// Return
		return
	}

	Logger.debug(
		`command.delete.run: refreshing access token, retrieving request body and headers`,
	)

	// Refresh the access token, if any
	await ProviderUtils.refreshAccessToken(drive)
	// Get the provider ID, request body and request headers of the drive
	const requestMeta = ProviderUtils.getRequestMetadata(drive)

	Logger.debug(
		`command.delete.run: retrieved meta: ${json(requestMeta)}`,
	)

	// Define the options for the request
	const requestOptions: AxiosRequestConfig = {
		method: 'DELETE',
		baseURL: Config.get('defaults.filesApiServerUrl') as string,
		url: `/files-api/v3/data/${encodeURIComponent(folderPath)}/${
			fileName ? encodeURIComponent(fileName) : ''
		}`,
		params: {
			providerId: requestMeta.providerId,
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
		`command.delete.run: making delete request: ${json(
			requestOptions,
		)}`,
	)

	// Make the request using axios
	const { data } = await axios(requestOptions)

	Logger.debug(`command.delete.run: response received: ${json(data)}`)

	// Stop loading
	Spinner.stop()
	// Tell the user the file/folder was deleted
	print(
		Chalk.yellow(
			`Deleted ${Chalk.keyword('orange')(
				`${drive}:${diskPath(folderPath, fileName)}`,
			)}`,
		),
	)
}
