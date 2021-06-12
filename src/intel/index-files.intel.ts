// Command to start indexing the specified files

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
// Use the env paths library to get the local cache and config path
import EnvPaths from 'env-paths'
const cachePath = EnvPaths('Dabbu CLI', { suffix: '' }).cache
const configPath = EnvPaths('Dabbu CLI', { suffix: '' }).config
// Use the nanoid library to generate random strings for downloaded files
import { nanoid as Nanoid } from 'nanoid'

// Import prompts
import * as Prompts from '../ui/prompts.ui'
// Import all methods from config and utils
import * as Config from '../utils/config.util'
import * as ProviderUtils from '../utils/provider.util'
// Import the print statement
import { print, json, path as diskPath } from '../utils/general.util'
// Import the spinner
import * as Spinner from '../ui/spinner.ui'
// Import the logger
import Logger from '../utils/logger.util'

// Helper function to list files/sub folders in a folder
async function listFiles(
	drive: string,
	folderPath: string,
	callback: (
		files: Record<string, any>[] | undefined,
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
			`intel.index-files.listFiles: refreshing access token, retrieving request body and headers`,
		)

		// Refresh the access token, if any
		await ProviderUtils.refreshAccessToken(drive)
		// Get the provider ID, request body and request headers of the drive
		const requestMeta = ProviderUtils.getRequestMetadata(drive)

		Logger.debug(
			`intel.index-files.listFiles: retrieved meta: ${json(
				requestMeta,
			)}`,
		)

		// Define the options for the request
		const requestOptions: AxiosRequestConfig = {
			method: 'GET',
			baseURL:
				Config.get('defaults.filesApiServerUrl') ||
				('https://dabbu-server.herokuapp.com' as string),
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
			`intel.index-files.listFiles: making list request: ${json(
				requestOptions,
			)}`,
		)

		// Make the request using axios
		const { data } = await axios(requestOptions)

		Logger.debug(
			`intel.index-files.listFiles: response received: ${json(data)}`,
		)

		// Run the callback
		Logger.debug(
			`intel.index-files.listFiles: passing files to callback`,
		)
		await callback(data.content)

		// Set the nextSetToken variable to the one returned by the server
		nextSetToken = data.nextSetToken
	} while (nextSetToken)
}

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
		`intel.index-files.downloadFile: refreshing access token, retrieving request body and headers`,
	)

	// Refresh the access token, if any
	await ProviderUtils.refreshAccessToken(drive)
	// Get the provider ID, request body and request headers of the drive
	const requestMeta = ProviderUtils.getRequestMetadata(drive)

	Logger.debug(
		`intel.index-files.downloadFile: retrieved meta: ${json(
			requestMeta,
		)}`,
	)

	// Define the options for the request
	let requestOptions: AxiosRequestConfig = {
		method: 'GET',
		baseURL:
			Config.get('defaults.filesApiServerUrl') ||
			'https://dabbu-server.herokuapp.com',
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
			'X-Credentials': Config.get(
				'creds.filesApiServer.token',
			) as string,
		},
	}

	Logger.debug(
		`intel.index-files.downloadFile: making read request: ${json(
			requestOptions,
		)}`,
	)

	// Make the request using axios
	const { data } = await axios(requestOptions)

	Logger.debug(
		`intel.index-files.downloadFile: response received: ${json(data)}`,
	)

	// Download the file from the content URI (and send along the headers just in case Authorization is required)
	// First check that the resource returned - exists, is not a folder, and has a content URI
	if (!data.content || !data.content.contentUri || !data.content.name) {
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
			'X-Credentials': Config.get(
				'creds.filesApiServer.token',
			) as string,
		},
		// Return the response as a stream
		responseType: 'stream',
	}

	Logger.debug(
		`intel.index-files.downloadFile: making get request on content uri: ${json(
			requestOptions,
		)}`,
	)

	const response = await axios(requestOptions)

	Logger.debug(
		`intel.index-files.downloadFile: response stream receieved`,
	)

	// The path where the file will be temporarily downloaded
	const cacheFilePath = `${cachePath}/${Nanoid()}::${data.content.name}`

	// Create the file
	await Fs.createFile(cacheFilePath)
	// Open a write stream so we can write the data we got to it
	const writer = Fs.createWriteStream(cacheFilePath)

	Logger.debug(
		`intel.index-files.downloadFile: writing stream to ${cacheFilePath}`,
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

// Helper function to upload the file to the Intel API and extract
// information from the file
async function extractInfo(
	pathToLocalFile: string,
	drive: string,
	fullPath: string,
): Promise<void> {
	// The server to use
	const intelApiServerUrl =
		Config.get('defaults.intelApiServerUrl') ||
		'https://dabbu-intel.herokuapp.com'

	// Define the options for the request
	// First define the form data (the file data will be sent as
	// url-encoded form data)
	const formData = new FormData()
	// Add the file's data as a readable stream to the content field
	formData.append('content', Fs.createReadStream(pathToLocalFile), {
		filename: fullPath.replace(/\//g, '%2F'),
	})

	// The final request payload
	const requestOptions: AxiosRequestConfig = {
		method: 'POST',
		baseURL: intelApiServerUrl,
		url: '/intel-api/v1/data/extract-info',
		data: formData,
		headers: {
			...formData.getHeaders(),
			'X-Credentials': Config.get(
				'creds.intelApiServer.token',
			) as string,
		},
	}

	Logger.debug(
		`intel.index-files.extractInfo: making extractInfo request: ${json(
			requestOptions,
		)}`,
	)

	const { data } = await axios(requestOptions)

	Logger.debug(
		`intel.index-files.extractInfo: received response: ${json(data)}`,
	)

	// Write it to the knowledge file
	let knowledgeJson: Record<string, any> = {
		topics: {},
		people: {},
		files: {},
	}
	// First read the data
	try {
		// In case the file is empty, make sure the topics, people and files
		// fields exist to avoid 'Cannot read property ... of undefined'.
		knowledgeJson = {
			topics: {},
			people: {},
			files: {},
			...(await Fs.readJson(`${configPath}/knowledge/${drive}.json`)),
		}

		Logger.debug(
			`intel.index-files.extractInfo: existing knowledge json: ${json(
				knowledgeJson,
			)}`,
		)
	} catch (error) {
		Logger.debug(
			`intel.index-files.extractInfo: error while opening knowledge file: ${error}`,
		)

		if (error.code === 'ENOENT') {
			Logger.debug(
				`intel.index-files.extractInfo: file not found, creating file`,
			)
			await Fs.createFile(`${configPath}/knowledge/${drive}.json`)
		} else {
			throw error
		}
	}

	// Store the topics in the knowledge files
	const topics: Record<string, any> = {}
	for (const topic of Object.keys(data.content.topics)) {
		topics[topic] = (data.content.topics[topic] as string[]).map(
			(fileName) => fileName.replace(/%2F/g, '/'),
		)
	}
	knowledgeJson.topics = {
		...knowledgeJson.topics,
		...topics,
	}

	// Store the people in the knowledge files
	const people: Record<string, any> = {}
	for (const person of Object.keys(data.content.people)) {
		people[person] = (data.content.people[person] as string[]).map(
			(fileName) => fileName.replace(/%2F/g, '/'),
		)
	}
	knowledgeJson.people = {
		...knowledgeJson.people,
		...people,
	}

	// For each file, get a list of topics and people and put it in the
	// knowledge file. This way, we can find all the topics related to
	// one file without having to compute it every time
	for (const topic of Object.keys(knowledgeJson.topics)) {
		// Get a list of files
		for (const file of knowledgeJson.topics[topic]) {
			// For each file, add that topic to the list
			knowledgeJson.files[file] = Array.from(
				new Set([...(knowledgeJson.files[file] || []), topic]),
			)
		}
	}

	// Do the same for people
	for (const person of Object.keys(knowledgeJson.people)) {
		// Get a list of files
		for (const file of knowledgeJson.people[person]) {
			// For each file, add that person to the list
			knowledgeJson.files[file] = Array.from(
				new Set([...(knowledgeJson.files[file] || []), person]),
			)
		}
	}

	Logger.debug(
		`intel.index-files.extractInfo: appended received topics and people: ${json(
			knowledgeJson,
		)}`,
	)

	await Fs.writeJson(
		`${configPath}/knowledge/${drive}.json`,
		knowledgeJson,
	)
}

// The new intel drive command
export const run = async (args: string[]): Promise<void> => {
	Logger.debug(`intel.index-files.run: called with args: ${json(args)}`)

	// First get the drive name
	const driveName = args[0] || Config.get('currentDrive')

	Logger.debug(
		`intel.index-files.run: name of drive: ${json(driveName)}`,
	)

	// Then get the drives the user can choose to index (all except any knowledge drives)
	const indexableDrives: string[] = Object.keys(
		Config.get('drives') as Record<string, any>,
	).filter(function (drive) {
		return (
			(Config.get(`drives.${drive}.provider`) as string) !== 'knowledge'
		)
	})

	Logger.debug(
		`intel.index-files.run: indexableDrives: ${json(indexableDrives)}`,
	)

	// Then get the drives to index files from
	const { drives: drivesToIndex } = await Prompts.getDrivesToIndex(
		indexableDrives,
	)
	Logger.debug(
		`intel.index-files.run: drivesToIndex: ${json(drivesToIndex)}`,
	)

	// Then ask for the path from each drive to index files from
	const pathsToIndex: { drive: string; path: string }[] = []
	for (const drive of drivesToIndex) {
		const { path } = await Prompts.getPathToIndex(drive)
		pathsToIndex.push({ drive, path })
	}
	Logger.debug(
		`intel.index-files.run: pathsToIndex: ${json(pathsToIndex)}`,
	)

	// Index the files at those paths
	for (const { drive, path } of pathsToIndex) {
		Logger.debug(
			`intel.index-files.run: indexing files at: ${diskPath(
				`${drive}:/`,
				path,
			)}`,
		)

		// Define the callback to be run every fifty files
		const copyFilesCallback = async (
			files: Record<string, any>[] | undefined,
		) => {
			Logger.debug(
				`intel.index-files.run.listFilesCallback: received files: ${json(
					files,
				)}`,
			)
			if (files && files.length > 0) {
				Logger.debug(
					`intel.index-files.run.listFilesCallback: looping through files`,
				)
				// Loop through all the files
				for (const file of files) {
					Logger.debug(
						`intel.index-files.run.listFilesCallback: copying file ${json(
							file,
						)}`,
					)

					// If it is a folder, go in recursively and copy those files too
					if (file.kind === 'folder') {
						Logger.debug(
							`intel.index-files.run.listFilesCallback: resource is folder, recursively copying files`,
						)

						await listFiles(drive, file.path, copyFilesCallback)
						continue
					}

					// Else it is a file, download it
					Spinner.start(
						Chalk.yellow(
							`Extracting information from file ${Chalk.keyword(
								'orange',
							)(drive + ':' + file.path)}`,
						),
					)

					// Surround it in try-catch so one error does not stop the whole operation
					try {
						// First figure out the correct folder path from `file.path`
						const filePathArray = file.path
							? file.path.split('/')
							: undefined
						let folderPath = path
						if (filePathArray) {
							// Set the folder path accordingly
							filePathArray.pop()
							folderPath =
								filePathArray.length > 1 ? filePathArray.join('/') : '/'
						} else {
							throw new Error('Invalid file path received from server')
						}

						// Download the file and upload it to the Intel API server
						// for extracting topics and people
						await extractInfo(
							await downloadFile(drive, folderPath, file.name),
							driveName,
							drive + ':' + file.path,
						)

						Logger.debug(
							`intel.index-files.run: extracted info from file`,
						)

						// Stop loading
						Spinner.stop()

						// Tell the user
						print(
							Chalk.yellow(
								`Extracting information from file ${Chalk.keyword(
									'orange',
								)(drive + ':' + file.path)}`,
							),
						)
					} catch (error) {
						Logger.debug(
							`intel.index-files.run: error extracting information from file: error: ${error}`,
						)

						// Stop loading
						Spinner.stop()

						// Tell the user about the error
						print(
							Chalk.red(
								`Error extracting information from file ${Chalk.keyword(
									'orange',
								)(drive + ':' + file.path)}: ${
									error?.response?.data?.error?.message ||
									'unknown error'
								}`,
							),
						)
					}
				}
			} else {
				Logger.debug(
					`intel.index-files.run.listFilesCallback: no files`,
				)
			}
		}

		// Run the list function and supply the callback to it
		await listFiles(drive, path, copyFilesCallback)
	}
}
