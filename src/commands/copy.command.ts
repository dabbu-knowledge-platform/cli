// Command to copy files and/or folders

// Use the axios library to make network requests
import axios, { AxiosRequestConfig } from 'axios'
// Use the chalk library to write colourful text
import Chalk from 'chalk'
// Use the fs-extra library to perform disk operations
import * as Fs from 'fs-extra'
// Use the file-type library to recognise the mime type of the file
import * as FileType from 'file-type'
// Use the form-data library to upload file data
import FormData from 'form-data'
// Use the env paths library to get the local cache path
import EnvPaths from 'env-paths'
const cachePath = EnvPaths('Dabbu CLI', { suffix: '' }).cache
// Use the nanoid library to generate random strings for downloaded files
import { nanoid as Nanoid } from 'nanoid'

// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as FsUtils from '../utils/fs.util'
import * as ProviderUtils from '../utils/provider.util'
import * as ErrorUtils from '../utils/errors.util'
// Import the print statement
import { print, json, path as diskPath } from '../utils/general.util'
// Import the spinner
import * as Spinner from '../ui/spinner.ui'
// Import the logger
import Logger from '../utils/logger.util'

// Helper function to write the contents of a file to a temporary file
// on the local hard disk
async function downloadFile(
	drive: string,
	folderPath: string,
	fileName: string,
): Promise<string> {
	// If the provider is harddrive, then manually read the file from
	// the hard drive
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

		// Check if the file exists
		// NOTE: This might actually note work, as the file might be deleted
		// right after we check if it exists
		if (
			!(await Fs.pathExists(diskPath(basePath, folderPath, fileName)))
		) {
			print(
				Chalk.red(
					`File ${diskPath(
						basePath,
						folderPath,
						fileName,
					)} was not found`,
				),
			)
		}

		// Return the path to the file
		return diskPath(basePath, folderPath, fileName)
	}

	Logger.debug(
		`command.copy.downloadFile: refreshing access token, retrieving request body and headers`,
	)

	// Refresh the access token, if any
	await ProviderUtils.refreshAccessToken(drive)
	// Get the provider ID, request body and request headers of the drive
	const requestMeta = ProviderUtils.getRequestMetadata(drive)

	Logger.debug(
		`command.copy.downloadFile: retrieved meta: ${json(requestMeta)}`,
	)

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
		headers: {
			...requestMeta.requestHeaderFields,
			'X-Credentials': Config.get('creds.token') as string,
		},
	}

	Logger.debug(
		`command.copy.downloadFile: making read request: ${json(
			requestOptions,
		)}`,
	)

	// Make the request using axios
	const { data } = await axios(requestOptions)

	Logger.debug(
		`command.copy.downloadFile: response received: ${json(data)}`,
	)

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
		// Add the provider credentials under the authorization header if auth is needed
		headers: {
			Authorization:
				requestMeta.requestHeaderFields['X-Provider-Credentials'] || '',
			'X-Credentials': Config.get('creds.token') as string,
		},
		// Return the response as a stream
		responseType: 'stream',
	}

	Logger.debug(
		`command.copy.downloadFile: making get request on content uri: ${json(
			requestOptions,
		)}`,
	)

	const response = await axios(requestOptions)

	Logger.debug(`command.copy.downloadFile: response stream receieved`)

	// The path where the file will be temporarily downloaded
	const cacheFilePath = `${cachePath}/${Nanoid()}-${fileName}`

	// Create the file
	await Fs.createFile(cacheFilePath)
	// Open a write stream so we can write the data we got to it
	const writer = Fs.createWriteStream(cacheFilePath)

	Logger.debug(
		`command.copy.downloadFile: writing stream to ${cacheFilePath}`,
	)

	// Pipe the bytes to the file
	response.data.pipe(writer)
	// Wait for it to finish
	await new Promise<void>((resolve, reject) => {
		writer.on('finish', () => {
			// Stop loading
			resolve()
		})
		// Pass the error back on, if any
		writer.on('error', reject)
	})

	// Return the path to the downloaded file
	return cacheFilePath
}

// Helper function to upload the contents of a local file at a given
// path to the specified location in a drive
async function uploadFile(
	pathToLocalFile: string,
	drive: string,
	folderPath: string,
	fileName: string,
): Promise<void> {
	// If the provider is harddrive, then manually read the file from
	// the hard drive
	if (Config.get(`drives.${drive}.provider`) === 'harddrive') {
		const basePath =
			(Config.get(`drives.${drive}.basePath`) as string | undefined) ||
			'/'

		// Ensure if the folder exists
		await Fs.ensureDir(diskPath(basePath, folderPath))

		// Copy the file's contents over
		await Fs.copyFile(
			pathToLocalFile,
			diskPath(basePath, folderPath, fileName),
		)

		// Return
		return
	}

	Logger.debug(
		`command.copy.uploadFile: refreshing access token, retrieving request body and headers`,
	)

	// Refresh the access token, if any
	await ProviderUtils.refreshAccessToken(drive)
	// Get the provider ID, request body and request headers of the drive
	const requestMeta = ProviderUtils.getRequestMetadata(drive)

	Logger.debug(
		`command.copy.uploadFile: retrieved meta: ${json(requestMeta)}`,
	)

	// Define the options for the request
	// First define the form data (the file data will be sent as
	// url-encoded form data)
	const formData = new FormData()
	// Add the file's data as a readable stream to the content field
	formData.append('content', Fs.createReadStream(pathToLocalFile), {
		filename: fileName,
	})

	// Add the fields from the request body to the form data instead
	const bodyVariables = Object.keys(requestMeta.requestBodyFields || {})
	for (let i = 0, length = bodyVariables.length; i < length; i++) {
		// Get the name and value
		const variableName = bodyVariables[i]
		const variableValue = requestMeta.requestBodyFields[variableName]
		// Add it to the form data
		formData.append(variableName, variableValue)
	}

	// The final request payload
	let requestOptions: AxiosRequestConfig = {
		method: 'POST',
		baseURL: Config.get('serverUrl') as string,
		url: `/files-api/v3/data/${encodeURIComponent(
			folderPath,
		)}/${encodeURIComponent(fileName)}`,
		params: {
			providerId: requestMeta.providerId,
		},
		data: formData,
		headers: {
			...requestMeta.requestHeaderFields,
			...formData.getHeaders(),
			'X-Credentials': Config.get('creds.token') as string,
		},
	}

	Logger.debug(
		`command.copy.uploadFile: making upload request: ${json(
			requestOptions,
		)}`,
	)

	// Make the request using axios
	try {
		const { data } = await axios(requestOptions)

		Logger.debug(
			`command.copy.uploadFile: response received: ${json(data)}`,
		)
	} catch (error) {
		// If it fails becuase the file already exists (409 Conflict), then
		// update the file silently
		if (error.response.data && error.response.data.code === 409) {
			Logger.debug(
				`command.copy.uploadFile: error 409 while uploading file, updating content instead`,
			)

			// Recreate the form data
			const updateFormData = new FormData()
			// Add the file's data as a readable stream to the content field
			updateFormData.append(
				'content',
				Fs.createReadStream(pathToLocalFile),
				{
					filename: fileName,
				},
			)

			// Add the fields from the request body to the form data instead
			const bodyVariables = Object.keys(
				requestMeta.requestBodyFields || {},
			)
			for (let i = 0, length = bodyVariables.length; i < length; i++) {
				// Get the name and value
				const variableName = bodyVariables[i]
				const variableValue =
					requestMeta.requestBodyFields[variableName]
				// Add it to the form data
				updateFormData.append(variableName, variableValue)
			}
			// Replace the POST with PUT, else make an identical request
			requestOptions = {
				method: 'PUT',
				baseURL: Config.get('serverUrl') as string,
				url: `/files-api/v3/data/${encodeURIComponent(
					folderPath,
				)}/${encodeURIComponent(fileName)}`,
				params: {
					providerId: requestMeta.providerId,
				},
				data: updateFormData,
				headers: {
					...updateFormData.getHeaders(),
					...requestMeta.requestHeaderFields,
					'X-Credentials': Config.get('creds.token') as string,
				},
			}

			Logger.debug(
				`command.copy.uploadFile: making update request instead: ${json(
					requestOptions,
				)}`,
			)

			// Make the request
			const response = await axios(requestOptions)

			Logger.debug(
				`command.copy.uploadFile: updated file; response received: ${json(
					response.data,
				)}`,
			)

			// Stop loading
			Spinner.stop()

			// And then return
			return
		}

		// Else throw the error
		throw error
	}

	// Return
	return
}

// Helper function to list files/sub folders in a folder
async function listFiles(
	drive: string,
	folderPath: string,
	callback: (
		files: Array<Record<string, any>> | undefined,
	) => void | Promise<void>,
): Promise<void> {
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

		const parsedFiles: Array<Record<string, any>> = []

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

		// Now sort the files (dirs first) and call the callback with them
		await callback(
			parsedFiles.sort((a, b) =>
				a.kind === 'folder' && b.kind !== 'folder' ? -1 : 1,
			),
		)

		// Return
		return
	}

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
			`command.copy.listFiles: making list request: ${json(
				requestOptions,
			)}`,
		)

		// Make the request using axios
		const { data } = await axios(requestOptions)

		Logger.debug(
			`command.copy.listFiles: response received: ${json(data)}`,
		)

		// Run the callback
		Logger.debug(`command.copy.listFiles: passing files to callback`)
		await callback(data.content)

		// Set the nextSetToken variable to the one returned by the server
		nextSetToken = data.nextSetToken
	} while (nextSetToken)
}

// The copy command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`command.copy.run: copy called with args: ${args}`)

	// Check if the user has provided a from and to file/folder name
	if (!args[0] || !args[1]) {
		// Else throw an error
		throw new Error(
			'Please enter the path to the file/folder you want to copy and where you want to copy it, like this: `copy ./Presentation.pptx ./Work/`',
		)
	}

	// Parse the drive and file/folder path from the args
	let {
		// eslint-disable-next-line prefer-const
		drive: fromDrive,
		folderPath: fromFolderPath,
		fileName: fromFileName,
	} = FsUtils.parseFilePath(args[0])
	let {
		// eslint-disable-next-line prefer-const
		drive: toDrive,
		folderPath: toFolderPath,
		fileName: toFileName,
	} = FsUtils.parseFilePath(args[1])

	// Check if the path provided is a folder path by checking if there is a '/' at the end
	if (args[0].endsWith('/')) {
		fromFolderPath = diskPath(fromFolderPath, fromFileName)
		fromFileName = ''
	}
	if (args[1].endsWith('/')) {
		toFolderPath = diskPath(toFolderPath, toFileName)
		toFileName = ''
	}

	Logger.debug(`command.copy.run: fromDrive: ${fromDrive}`)
	Logger.debug(`command.copy.run: fromFolderPath: ${fromFolderPath}`)
	Logger.debug(`command.copy.run: fromFileName: ${fromFileName}`)
	Logger.debug(`command.copy.run: toDrive: ${toDrive}`)
	Logger.debug(`command.copy.run: toFolderPath: ${toFolderPath}`)
	Logger.debug(`command.copy.run: toFileName: ${toFileName}`)

	// Check if we have to copy a file or a folder
	if (!fromFileName) {
		// A folder
		// Copy this folder's contents to a folder with a different name
		Logger.debug(
			`command.copy.run: copying folder ${fromFolderPath}'s contents to ${toFolderPath}`,
		)

		// Show a loading indicator
		Spinner.start(
			`Copying all files from folder ${diskPath(
				fromFolderPath,
			)} to ${diskPath(toFolderPath)}`,
		)

		// Define the callback to be run every fifty files
		const copyFilesCallback = async (
			files: Array<Record<string, any>> | undefined,
		) => {
			Logger.debug(
				`command.copy.run.listFilesCallback: received files: ${json(
					files,
				)}`,
			)
			if (files && files.length > 0) {
				Logger.debug(
					`command.copy.run.listFilesCallback: looping through files`,
				)
				// Loop through all the files
				for (const file of files) {
					Logger.debug(
						`command.copy.run.listFilesCallback: copying file ${json(
							file,
						)}`,
					)

					// If it is a folder, go in recursively and copy those files too
					if (file.kind === 'folder') {
						Logger.debug(
							`command.copy.run.listFilesCallback: resource is folder, recursively copying files`,
						)

						await listFiles(fromDrive, file.path, copyFilesCallback)
						continue
					}

					// Else it is a file, copy it to the destination
					// First keep a temp copy of the original fromFolderPath and toFolderPath
					const oldFromFolderPath = fromFolderPath
					const oldToFolderPath = toFolderPath
					// First figure out the correct from path from `file.path`
					const fromFilePathArray = file.path
						? file.path.split('/')
						: undefined
					if (fromFilePathArray) {
						// Set the file path and name accordingly
						fromFileName = fromFilePathArray.pop()
						fromFolderPath = fromFilePathArray.length > 1 ? fromFilePathArray.join('/') : '/'
					} else {
						throw new Error('Invalid file path received from server')
					}

					// Next, add the subfolders to the `toFolderPath` if the file is nested
					toFolderPath = diskPath(
						toFolderPath,
						fromFolderPath.replace(oldFromFolderPath, ''),
					)

					Spinner.start(
						Chalk.yellow(
							`Copying file ${Chalk.keyword('orange')(
								diskPath(fromFolderPath, fromFileName),
							)} to ${Chalk.keyword('orange')(
								diskPath(toFolderPath, fromFileName),
							)}`,
						),
					)

					// Surround it in try-catch so one error does not stop the whole operation
					try {
						await uploadFile(
							await downloadFile(
								fromDrive,
								fromFolderPath,
								fromFileName,
							),
							toDrive,
							toFolderPath,
							fromFileName,
						)

						Logger.debug(
							`command.copy.run: copied file ${diskPath(
								fromFolderPath,
								fromFileName,
							)} to ${diskPath(toFolderPath, fromFileName)}`,
						)

						// Stop loading
						Spinner.stop()

						// Tell the user
						print(
							Chalk.yellow(
								`Copied file ${Chalk.keyword('orange')(
									diskPath(fromFolderPath, fromFileName),
								)} to ${Chalk.keyword('orange')(
									diskPath(toFolderPath, fromFileName),
								)}`,
							),
						)
					} catch (error) {
						Logger.debug(
							`command.copy.run: error copying file ${diskPath(
								fromFolderPath,
								fromFileName,
							)} to ${diskPath(toFolderPath, fromFileName)}: ${json(
								error,
							)}`,
						)

						// Stop loading
						Spinner.stop()

						// Tell the user about the error
						print(
							Chalk.red(
								`Error copying file ${Chalk.keyword('orange')(
									diskPath(fromFolderPath, fromFileName),
								)} to ${Chalk.keyword('orange')(
									diskPath(toFolderPath, fromFileName),
								)}: ${ErrorUtils.getErrorMessage(error)}`,
							),
						)
					}

					// Reset the fromFolderPath and toFolderPath
					fromFolderPath = oldFromFolderPath
					toFolderPath = oldToFolderPath
				}
			} else {
				Logger.debug(`command.copy.run.listFilesCallback: no files`)
			}
		}

		// Run the list function and supply the callback to it
		await listFiles(fromDrive, fromFolderPath, copyFilesCallback)

		// Return
		return
	}

	// Else it is a file we have to copy
	// Check if we have to copy it to a file with the same name in a
	// different folder, or to a file with a different name in a
	// different/same folder
	if (!toFileName) {
		// Same name, different folder
		Logger.debug(
			`command.copy.run: copying file ${diskPath(
				fromFolderPath,
				fromFileName,
			)} to ${diskPath(toFolderPath, fromFileName)}`,
		)

		// Show a loading indicator
		Spinner.start(
			`Copying file ${diskPath(
				fromFolderPath,
				fromFileName,
			)} to ${diskPath(toFolderPath, fromFileName)}`,
		)

		// Copy the file
		await uploadFile(
			await downloadFile(fromDrive, fromFolderPath, fromFileName),
			toDrive,
			toFolderPath,
			fromFileName,
		)

		Logger.debug(
			`command.copy.run: copied file ${diskPath(
				fromFolderPath,
				fromFileName,
			)} to ${diskPath(toFolderPath, fromFileName)}`,
		)

		// Stop loading
		Spinner.stop()

		// Tell the user
		print(
			Chalk.yellow(
				`Copied file ${Chalk.keyword('orange')(
					diskPath(fromFolderPath, fromFileName),
				)} to ${Chalk.keyword('orange')(
					diskPath(toFolderPath, fromFileName),
				)}`,
			),
		)
	} else {
		// Different name, different/same folder
		Logger.debug(
			`command.copy.run: copying file ${diskPath(
				fromFolderPath,
				fromFileName,
			)} to ${diskPath(toFolderPath, toFileName)}`,
		)

		// Show a loading indicator
		Spinner.start(
			`Copying file ${diskPath(
				fromFolderPath,
				toFileName,
			)} to ${diskPath(toFolderPath, toFileName)}`,
		)

		// Copy the file
		await uploadFile(
			await downloadFile(fromDrive, fromFolderPath, fromFileName),
			toDrive,
			toFolderPath,
			toFileName,
		)

		Logger.debug(
			`command.copy.run: copied file ${diskPath(
				fromFolderPath,
				fromFileName,
			)} to ${diskPath(toFolderPath, toFileName)}`,
		)

		// Stop loading
		Spinner.stop()

		// Tell the user
		print(
			Chalk.yellow(
				`Copied file ${Chalk.keyword('orange')(
					diskPath(fromFolderPath, fromFileName),
				)} to ${Chalk.keyword('orange')(
					diskPath(toFolderPath, toFileName),
				)}`,
			),
		)
	}
}
