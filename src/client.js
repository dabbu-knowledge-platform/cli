/* Dabbu CLI - A CLI that leverages the Dabbu API and neatly retrieves your files and folders scattered online
 *
 * Copyright (C) 2021  gamemaker1
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const fs = require('fs-extra')
const axios = require('axios').default
const prompt = require('readcommand')
const express = require('express')
const open = require('open')

const FormData = require('form-data')

const { nanoid } = require('nanoid')

const {
	get,
	set,
	getAbsolutePath,
	generateBodyAndHeaders,
	getExtForMime,
	parseUserInputForPath,
	printInfo,
	printBright,
	printError,
	printFiles,
	highlight,
	startSpin,
	stopSpin,
	diskPath
} = require('./utils')

const listRequest = async (
	drive,
	folderPath,
	regex,
	printOnReceive = false
) => {
	// Get the server address, provider ID and URL encode the folder path
	const server = get('server')
	const provider = get(`drives.${drive}.provider`)
	const encodedFolderPath = encodeURIComponent(
		folderPath === '' ? '/' : folderPath
	)

	// The URL to send the request to
	let allFiles = []
	let nextSetToken = ''
	let firstRun = true
	do {
		const url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}?exportType=view&orderBy=kind&direction=desc&nextSetToken=${nextSetToken}`

		// Generate request body and headers
		// eslint-disable-next-line no-await-in-loop
		const [body, headers] = await generateBodyAndHeaders(drive)

		// Send a GET request
		// eslint-disable-next-line no-await-in-loop
		const result = await axios.get(url, {
			data: body, // The appropriate request body for this provider
			headers // The appropriate headers for this provider
		})

		// Get the next page token (incase the server returned incomplete
		// results)
		nextSetToken = result.data.nextSetToken

		// Add the files we got right now to the main list
		if (result.data.content) {
			if (printOnReceive) {
				const spinnerText = stopSpin()
				// Print the files
				printFiles(
					result.data.content,
					false /* Don't show full path */,
					firstRun /* Print the headers only on the first request */
				)
				startSpin(spinnerText)
			}

			allFiles = [...allFiles, ...result.data.content]
		}

		// Don't show headers after the first run
		firstRun = false
	} while (nextSetToken) // Keep doing the
	// above list request until there is no nextSetToken returned

	// Once we are done getting all files, print out the number of files (this is 
	// only if the no of files is > 50)
	if (allFiles.length > 50) {
		const spinnerText = stopSpin()
		printInfo(`${allFiles.length} files/folders`)
		startSpin(spinnerText)
	}

	// Check if there is a response
	if (allFiles.length > 0) {
		// Get the files from the response
		let files = allFiles
		if (regex) {
			// Filter using the regex (if any)
			files = files.filter((file) => {
				return new RegExp(regex).test(file.name)
			})
		}

		// Return the files
		return files
	}

	// Else return null if it is an empty folder
	return null
}

const downloadRequest = async (drive, folderPath, fileName) => {
	// The file object (from Dabbu Server), the file data retrieved from its
	// contentURI and the path on the local disk where the file is downloaded
	let file
	let fileData
	let localPath
	// Generate request body and headers
	const [body, headers] = await generateBodyAndHeaders(drive)

	// Get the server address, provider ID and URL encode the folder path and file name
	const server = get('server')
	const provider = get(`drives.${drive}.provider`)
	const encodedFolderPath = encodeURIComponent(
		folderPath === '' ? '/' : folderPath
	)
	const encodedFileName = encodeURIComponent(fileName)
	// The URL to send the GET request to
	let url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}/${encodedFileName}?exportType=media`
	// Send a GET request
	let result = await axios.get(url, {
		data: body,
		headers
	})

	// Check if a file was returned
	if (result.data.content) {
		// If there is a file, download it
		file = result.data.content
		// If it is a folder, error out
		if (file.kind === 'folder') {
			throw new Error(`Cannot download folder ${file.name}`)
		}
	} else {
		// Else error out
		throw new Error(`${result.response.data.error.message}`)
	}

	// Download the file's data from the content URI
	url = file.contentURI
	if (file && file.contentURI) {
		// If a content URI is provided, download the file
		// Check if it is a file:// URI
		if (file.contentURI.startsWith('file://')) {
			// If so, parse the file path and fetch that using the get-uri library
			result = fs.createReadStream(
				unescape(file.contentURI).replace('file://', '')
			)
			// If there is data, return it
			if (result) {
				fileData = result
			} else {
				// Else error out
				throw new Error("No data received from file's contentURI")
			}
		} else {
			// Else it is a normal url, fetch it using axios
			// Add the headers and body only if they really are
			// needed, else risk getting a 400 Bad request
			const meta = {}
			if (Object.keys(body || {}).length > 0) {
				meta.data = body
			}

			if (Object.keys(headers || {}).length > 0) {
				meta.headers = headers
			}

			meta.responseType = 'stream'
			result = await axios.get(url, meta)
			// If there is data, return it
			if (result.data) {
				fileData = result.data
			} else if (result) {
				fileData = result
			} else {
				throw new Error("No data received from file's contentURI")
			}
		}
	} else {
		// Else return null
		throw new Error('No such file/folder was found.')
	}

	// Pipe the data to a local file
	if (fileData) {
		// Download the file
		// Get the file's extension based on its mime type first
		const ext = getExtForMime(file.mimeType)
		// Path to the file
		localPath = `./_dabbu/_cli/_${provider}/${file.name || file.fileName}`
		localPath = `${localPath}${localPath.includes(ext) ? '' : `.${ext}`}`
		// Create the file
		await fs.createFile(localPath)
		// Open a write stream so we can write the data we got to it
		const writer = fs.createWriteStream(localPath)
		// Pipe the bytes to the file
		fileData.pipe(writer)
		await new Promise((resolve, reject) => {
			writer.on('finish', () => {
				// Stop loading
				resolve()
			})
			writer.on('error', reject) // Pass the error back on, if any
		})
	} else {
		// Else return null
		throw new Error('No such file/folder was found.')
	}

	return localPath
}

const uploadRequest = async (drive, folderPath, fileName, localPath) => {
	// Generate request body and headers
	const [body, headers] = await generateBodyAndHeaders(drive)

	// Get the server address, provider ID and URL encode the folder path
	const server = get('server')
	const provider = get(`drives.${drive}.provider`)
	const encodedFolderPath = encodeURIComponent(
		folderPath === '' ? '/' : folderPath
	)
	const encodedFileName = encodeURIComponent(fileName)

	// Make a form data object to upload the file's contents
	const formData = new FormData()
	// Add the file's data as a readable stream to the content field
	formData.append('content', fs.createReadStream(localPath), {
		filename: fileName
	})

	// Add the fields from the body to the form data
	const bodyVariables = Object.keys(body || {})
	for (let i = 0, length = bodyVariables.length; i < length; i++) {
		// Get the name and value
		const variableName = bodyVariables[i]
		const variableValue = body[variableName]
		// Add it to the form data
		formData.append(variableName, variableValue)
	}

	// Use the headers that the form-data modules sets
	const formHeaders = formData.getHeaders()

	// The URL to send the request to
	const url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}/${encodedFileName}`
	// Send a POST request
	try {
		const result = await axios.post(url, formData, {
			headers: {
				...formHeaders, // The form headers
				...headers // The provider-specific headers
			}
		})
		if (result.status === 201) {
			// If there is no error, return
			return
		}

		// Else error out
		throw new Error(result.data.error.message)
	} catch (error) {
		if (error.code === 409 || error.status === 409) {
			printInfo(`\nOverwriting file ${diskPath(folderPath, fileName)}`)
			return updateRequest(drive, folderPath, fileName)
		}
	}
}

const updateRequest = async (
	drive,
	fromFolderPath,
	fromFileName,
	toFolderPath,
	toFileName
) => {
	// Generate request body and headers
	const [body, headers] = await generateBodyAndHeaders(drive)

	// Get the server address, provider ID and URL encode the folder path
	const server = get('server')
	const provider = get(`drives.${drive}.provider`)
	const encodedFolderPath = encodeURIComponent(
		fromFolderPath === '' ? '/' : fromFolderPath
	)
	const encodedFileName = encodeURIComponent(fromFileName)

	// Add the name and path to the body (only if we want to change it)
	if (toFileName !== fromFileName) {
		body.name = toFileName
	}

	if (toFolderPath !== fromFolderPath) {
		body.path = toFolderPath
	}

	// The URL to send the request to
	const url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}/${encodedFileName}`
	// Send a POST request
	const result = await axios.put(url, body, {
		headers
	})
	if (result.status === 200) {
		// If there is no error, return
	} else {
		// Else error out
		throw new Error(result.response.data.error.message)
	}
}

const deleteRequest = async (drive, folderPath, fileName, regex) => {
	// Generate request body and headers
	const [body, headers] = await generateBodyAndHeaders(drive)

	// Get the server address, provider ID and URL encode the folder path
	const server = get('server')
	const provider = get(`drives.${drive}.provider`)
	const encodedFolderPath = encodeURIComponent(
		folderPath === '' ? '/' : folderPath
	)

	if (!fileName) {
		if (regex) {
			// The URL to send the request to
			const url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}?exportType=view`
			// Send a GET request
			const result = await axios.get(url, {
				data: body, // The appropriate request body for this provider
				headers // The appropriate headers for this provider
			})

			// Check if there is a response
			if (result.data.content.length > 0) {
				// Get the files from the response
				let files = result.data.content
				if (regex) {
					// Filter using the regex (if any)
					files = files.filter((file) => {
						return new RegExp(regex).test(file.name)
					})
				}

				// Delete the files
				for (const file of files) {
					const encodedFileName = encodeURIComponent(file.name)
					// The URL to send the request to
					const url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}/${encodedFileName}`
					// Send a GET request
					// eslint-disable-next-line no-await-in-loop
					await axios.delete(url, {
						data: body, // The appropriate request body for this provider
						headers // The appropriate headers for this provider
					})
				}

				// Return the number of files deleted
				return files.length
			}

			// Else return if it is an empty folder
			return 0
		}

		// The URL to send the request to
		const url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}`
		// Send a GET request
		await axios.delete(url, {
			data: body, // The appropriate request body for this provider
			headers // The appropriate headers for this provider
		})
		// Return the number of files deleted
		return 1
	}

	const encodedFileName = encodeURIComponent(fileName)
	// The URL to send the request to
	const url = `${server}/files-api/v2/data/${provider}/${encodedFolderPath}/${encodedFileName}`
	// Send a GET request
	await axios.delete(url, {
		data: body, // The appropriate request body for this provider
		headers // The appropriate headers for this provider
	})
	// Return the number of files deleted
	return 1
}

// The Client class
const Client = class {
	constructor() {
		this.ops = {
			pwd: this.pwd,
			whereami: this.pwd,
			cd: this.cd,
			changedir: this.cd,
			l: this.list,
			ls: this.list,
			ll: this.list,
			dir: this.list,
			list: this.list,
			cat: this.read,
			read: this.read,
			cp: this.copy,
			copy: this.copy,
			mv: this.move,
			rename: this.move,
			move: this.move,
			rm: this.delete,
			del: this.delete,
			delete: this.delete,
			sync: this.sync
		}
	}

	async init(drive) {
		// First get the provider, so we can get the related variables
		// from the provider_config.json file
		// The provider config
		let providerConfigJson = await axios.get(
			'https://dabbu-knowledge-platform.github.io/schema/provider-fields.json'
		)
		providerConfigJson = providerConfigJson.data.providers.v2

		const provider = get(`drives.${drive}.provider`)
		const providerConfig = providerConfigJson[provider]

		// Request a variable from the user
		const _requestVariable = (variable) => {
			return new Promise((resolve, reject) => {
				// Tell the user about the variable
				printInfo(variable.description)

				prompt.read(
					{
						ps1: `${variable.prompt} > `
					},
					(error, args) => {
						// If there is an error, handle it
						if (error) {
							reject(error)
						} else {
							// If there is no error, get the value
							const varValue = args[0]
							// Check if the value is non null
							if (varValue) {
								// Store its value in the config file
								set(`drives.${drive}.${variable.path}`, varValue)
								// Return successfully
								resolve()
							} else {
								// If they haven't entered anything, flag it and ask again
								printBright(`Please ${variable.prompt.toLowerCase()}`)
								resolve(_requestVariable(variable))
							}
						}
					}
				)
			})
		}

		// Get the values for all variables in the body and header
		const requestVariables = async () => {
			// Get a list of variables from the provider config
			const variablesFromBody = Object.keys(providerConfig.request.body || {})
			const variablesFromHeaders = Object.keys(
				providerConfig.request.headers || {}
			)

			// Loop through them and get their value
			for (const variableName of variablesFromBody) {
				const variable = providerConfig.request.body[variableName]
				// Ask the user for the value only if the user-input-needed flag is explicitly true
				if (variable['user-input-needed'] === true) {
					// eslint-disable-next-line no-await-in-loop
					await _requestVariable(variable)
				}
			}

			// Loop through them and get their value
			for (const variableName of variablesFromHeaders) {
				const variable = providerConfig.request.headers[variableName]
				// Ask the user for the value only if the user-input-needed flag is explicitly true
				if (variable['user-input-needed'] === true) {
					// eslint-disable-next-line no-await-in-loop
					await _requestVariable(variable)
				}
			}

			// Return successfully
		}

		// If the auth process is OAuth2, ask them to setup a project
		// and enter the client ID and secret
		const requestClientID = () => {
			return new Promise((resolve, reject) => {
				// Tell the user what they need to do to setup a project
				printInfo(providerConfig.auth.instructions)

				prompt.read(
					{
						ps1: `Enter the client ID you got: > `
					},
					(error, args) => {
						// If there is an error, handle it
						if (error) {
							reject(error)
						} else {
							// If there is no error, get the value
							const clientID = args.join(' ')
							// Check if they have entered something non null
							if (clientID) {
								// Store its value in the config file
								set(
									`drives.${drive}.auth-meta.redirect-uri`,
									'http://localhost:8081'
								)
								set(`drives.${drive}.auth-meta.client-id`, clientID)
								// Return successfully
								resolve()
							} else {
								// If they haven't entered anything, flag it and ask again
								printBright('Please enter the client ID.')
								resolve(requestClientID())
							}
						}
					}
				)
			})
		}

		// Ask for the client secret
		const requestClientSecret = () => {
			return new Promise((resolve, reject) => {
				prompt.read(
					{
						ps1: `Enter the client secret you got: > `
					},
					(error, args) => {
						// If there is an error, handle it
						if (error) {
							reject(error)
						} else {
							// If there is no error, get the value
							const clientSecret = args.join(' ')
							// Check that they have entered something non null
							if (clientSecret) {
								// Store its value in the config file
								set(`drives.${drive}.auth-meta.client-secret`, clientSecret)
								// Return successfully
								resolve()
							} else {
								// If they haven't entered anything, flag it and ask again
								printBright('Please enter the client secret.')
								resolve(requestClientSecret())
							}
						}
					}
				)
			})
		}

		// Get the user's consent to access their files/mail/etc (required
		// as part of OAuth2)
		const getAuthorization = () => {
			// Wrap everything in a promise
			return new Promise((resolve, reject) => {
				// Construct the URL to send the user to
				// A random state to prevent CORS attacks
				const randomNumber = nanoid(24)
				// The client ID and redirect URI (required in the URL)
				const clientId = get(`drives.${drive}.auth-meta.client-id`)
				const redirectUri = get(`drives.${drive}.auth-meta.redirect-uri`)
				// The URL
				const authUrl = `${
					providerConfig.auth['auth-uri']
				}?client_id=${encodeURIComponent(
					clientId
				)}&redirect_uri=${encodeURIComponent(
					redirectUri
				)}&scope=${encodeURIComponent(
					providerConfig.auth.scopes
				)}&state=${randomNumber}&include_granted_scopes=true&response_type=code&access_type=offline`
				// Ask the user to go there
				printInfo(
					`Authorize the app by visting this URL in a browser (if you see a warning "Unsafe site", press Advanced > Go to site (unsafe)) - ${authUrl}`
				)

				// Once the user finishes the auth process, they will be redirected to localhost:8081
				// We need to setup a server to parse the URL for the code and then get the token
				const app = express()

				// Start the server
				const server = app.listen(8081, null)

				// Once we get the code, return successfully
				// Listen for requests to localhost:8081/
				app.get('/', (request, result) => {
					// Return the code only if there is no error and the state variable matches
					if (request.query.error) {
						result.send(`The following error occurred: ${request.query.error}`)
						server.close()
						reject(request.query.error)
					} else {
						// Take into account that some providers (like microsoft) do not return state
						// eslint-disable-next-line no-lonely-if
						if (!request.query.state || request.query.state === randomNumber) {
							result.send(
								'Thank you for signing in to Dabbu CLI. You can now continue using it.'
							)
							resolve(request.query.code)
						} else {
							result.send(
								`The following error occurred: URL state does not match. Please try again.`
							)
							reject(
								new Error('Error: URL state does not match. Please try again.')
							)
						}
					}
				})
			})
		}

		// Get an access token and a refresh token from the provider
		const getToken = (code) => {
			// Wrap everything in a promise
			return new Promise((resolve, reject) => {
				// The URL to make a POST request to
				const tokenURL = providerConfig.auth['token-uri']
				// Make a POST request with the required params
				// Put the params as query params in the URL and in the request
				// body too, Microsoft requires the params as a string in the body
				axios
					.post(
						tokenURL,
						// In the body
						providerConfig.auth['send-auth-metadata-in'] === 'request-body'
							? `code=${code}&client_id=${get(
									`drives.${drive}.auth-meta.client-id`
							  )}&client_secret=${get(
									`drives.${drive}.auth-meta.client-secret`
							  )}&redirect_uri=${get(
									`drives.${drive}.auth-meta.redirect-uri`
							  )}&grant_type=${'authorization_code'}`
							: null,
						// In the URL query parameters
						{
							params:
								providerConfig.auth['send-auth-metadata-in'] === 'query-param'
									? {
											code,
											// eslint-disable-next-line camelcase
											client_id: get(`drives.${drive}.auth-meta.client-id`),
											// eslint-disable-next-line camelcase
											client_secret: get(
												`drives.${drive}.auth-meta.client-secret`
											),
											// eslint-disable-next-line camelcase
											redirect_uri: get(
												`drives.${drive}.auth-meta.redirect-uri`
											),
											// eslint-disable-next-line camelcase
											grant_type: 'authorization_code'
									  }
									: {}
						}
					)
					.then((result) => {
						// Get the access token, refresh token and expiry time
						const {
							access_token: accessToken,
							refresh_token: refreshToken,
							expires_in: expiresIn,
							token_type: tokenType
						} = result.data
						// Store it in config
						set(
							`drives.${drive}.${providerConfig.auth.path}.access-token`,
							`${tokenType || 'Bearer'} ${accessToken}`
						)
						set(
							`drives.${drive}.${providerConfig.auth.path}.refresh-token`,
							refreshToken
						)
						set(
							`drives.${drive}.${providerConfig.auth.path}.expires-at`,
							Number(Date.now()) + expiresIn * 1000
						) // Multiply by thousands to keep milliseconds)
						// Return successfully
						resolve()
					})
					.catch(reject) // Pass back the error, if any
			})
		}

		// First ask for all variables
		await requestVariables()
		// Check if there is an auth process
		// Currently only OAuth2 is supported
		if (providerConfig.auth && providerConfig.auth.process === 'oauth2') {
			// Ask user to create a project and get client ID
			await requestClientID()
			// Get client secret from the user
			await requestClientSecret()
			// Get user consent to access their files/mail
			await getAuthorization()
			// Get an access token and refresh token
			await getToken()
			// Return successfully
		}
	}

	// Show the user their current drive and path
	async pwd(args) {
		// Current drive
		const drive = (args[1] || get('current-drive')).replace(/:/g, '')
		// Print the drive name and path
		printInfo(
			`(${get(`drives.${drive}.provider`)}) ${drive}:${get(
				`drives.${drive}.path`
			)}`
		)
	}

	// Change the user's directory
	async cd(args) {
		// The user given relative path
		const inputPath = args[1]
		// The current path in that drive
		const currentPath = get(`drives.${get('current-drive')}.path`) || ''

		// Parse the relative path and get an absolute one
		const finalPath = getAbsolutePath(inputPath, currentPath)
		// Set the path
		set(`drives.${get('current-drive')}.path`, finalPath)
	}

	async list(args) {
		// Show a loading indicator
		startSpin(`Loading your ${highlight('files and folders')}`)

		// Get the path the user entered, default to current directory
		const { drive, folderPath, regex } = await parseUserInputForPath(
			args[1],
			true
		)

		startSpin(
			`Loading all files ${
				regex
					? `matching regex ${highlight(regex)}`
					: `in folder ${highlight(diskPath(folderPath))}`
			}`
		)

		// Fetch the files from the server and print them as you get them
		const files = await listRequest(drive, folderPath, regex, true)

		// Stop loading
		stopSpin()

		// If there were no files returned, the folder is empty
		if (!files) {
			printBright('Folder is empty')
		}
	}

	async read(args) {
		// Show a loading indicator
		startSpin(`Loading your ${highlight('files and folders')}`)

		// Get the path the user entered
		let { drive, folderPath } = await parseUserInputForPath(args[1], false)
		// Get the file name from the folder path
		let fileName = folderPath.split('/')
		fileName =
			// If the path ends with a /, it is a folder
			fileName[fileName.length - 1] === ''
				? null
				: fileName[fileName.length - 1]
		// If there is a file name, remove it from the folder path
		if (fileName) {
			folderPath = folderPath.split('/')
			folderPath = folderPath.slice(0, folderPath.length - 1).join('/')
		}

		startSpin(`Fetching file ${highlight(diskPath(folderPath, fileName))}`)

		// Fetch the files from the server
		const localPath = await downloadRequest(drive, folderPath, fileName)

		// Stop loading
		stopSpin()
		// Tell the user where the file is stored
		printInfo(
			`File downloaded ${highlight('temporarily')} to ${diskPath(localPath)}`
		)
		// Open it in the default app
		open(localPath, { wait: false })

		// Return successfully
	}

	async copy(args) {
		// Show a loading indicator
		startSpin(`Copying your ${highlight('files and folders')}`)

		// Get the path the user entered (the file(s) to copy)
		let {
			drive: fromDrive,
			folderPath: fromFolderPath,
			regex: fromRegex
		} = await parseUserInputForPath(args[1], true)
		// Get the file name from the folder path
		let fromFileName = fromFolderPath.split('/')
		fromFileName =
			// If the path ends with a /, it is a folder
			fromFileName[fromFileName.length - 1] === '' ||
			fromFileName[fromFileName.length - 1] === '.' ||
			fromFileName[fromFileName.length - 1] === '..'
				? null
				: fromFileName[fromFileName.length - 1]
		// If there is a file name, remove it from the folder path
		if (fromFileName) {
			fromFolderPath = fromFolderPath.split('/')
			fromFolderPath = fromFolderPath.slice(0, -1).join('/')
		}

		// Get the path the user entered (the target to copy to)
		let {
			drive: toDrive,
			folderPath: toFolderPath
		} = await parseUserInputForPath(args[2], false)
		// Get the file name from the folder path
		let toFileName = toFolderPath.split('/')
		toFileName =
			// If the path ends with a /, it is a folder
			toFileName[toFileName.length - 1] === '' ||
			toFileName[toFileName.length - 1] === '.' ||
			toFileName[toFileName.length - 1] === '..'
				? null
				: toFileName[toFileName.length - 1]
		// If there is a file name, remove it from the folder path
		if (toFileName) {
			toFolderPath = toFolderPath.split('/')
			toFolderPath = toFolderPath.slice(0, -1).join('/')
		}

		// Check if the user has given some regex and matching files are to
		// be copied
		if (fromRegex) {
			const files = await listRequest(fromDrive, fromFolderPath, fromRegex)
			if (files && files.length > 0) {
				// Keep a count of copied files and errored files
				let copiedFilesCount = 0
				let erroredFilesCount = 0
				// Loop through the files, download then upload each one
				for (let i = 0, length = files.length; i < length; i++) {
					// The file obj
					const file = files[i]

					// Update the spinner
					startSpin(
						`Copying file ${highlight(
							diskPath(fromFolderPath, file.name)
						)} to ${highlight(diskPath(toFolderPath, file.name))}`
					)

					// Surround in try-catch to stop spinner in case
					// an error is thrown
					try {
						// Skip if its a folder
						if (file.kind === 'folder') {
							throw new Error(
								'Copying/moving/downloading folders is not yet supported, only deleting is'
							)
						}

						// Fetch the file
						// eslint-disable-next-line no-await-in-loop
						const localPath = await downloadRequest(
							fromDrive,
							fromFolderPath,
							file.name
						)
						// Upload the file
						// eslint-disable-next-line no-await-in-loop
						await uploadRequest(toDrive, toFolderPath, file.name, localPath)

						// Increase the number of files copied
						copiedFilesCount++

						// Tell the user
						const spinnerText = stopSpin()
						printInfo(
							`Copied file ${highlight(
								diskPath(fromFolderPath, file.name)
							)} to ${highlight(diskPath(toFolderPath, file.name))}`
						)
						startSpin(spinnerText)
					} catch (error) {
						// Increase the error count
						erroredFilesCount++
						// Print the error, but continue
						const spinnerText = stopSpin()
						printError(error, false)
						startSpin(spinnerText)
					}
				}

				// Stop loading, we are done
				stopSpin()
				// Tell the user the number of files we copied and skipped
				printInfo(
					`Copied ${highlight(
						copiedFilesCount
					)} files successfully, ${highlight(
						erroredFilesCount
					)} skipped due to errors`
				)
				// Return succesfully
			} else {
				// Stop loading, error out
				throw new Error('No files matched that regex')
			}
		} else {
			// Surround in a try catch to stop spinner when an error is thrown
			try {
				// Update the spinner
				startSpin(
					`Copying file ${highlight(
						diskPath(fromFolderPath, fromFileName)
					)} to ${highlight(
						diskPath(toFolderPath, toFileName || fromFileName)
					)}`
				)

				// Fetch the file
				const localPath = await downloadRequest(
					fromDrive,
					fromFolderPath,
					fromFileName
				)
				// Upload the file
				const result = await uploadRequest(
					toDrive,
					toFolderPath,
					toFileName || fromFileName,
					localPath
				)
				// Tell the user
				stopSpin()
				printInfo(
					`Copied file ${highlight(
						diskPath(fromFolderPath, fromFileName)
					)} to ${highlight(
						diskPath(toFolderPath, toFileName || fromFileName)
					)}`
				)
			} catch (error) {
				throw error
			}
		}

		// Return successfully
	}

	async move(args) {
		// Show a loading indicator
		startSpin(`Moving your ${highlight('files and folders')}`)

		// Get the path the user entered (the file(s) to move)
		let {
			drive: fromDrive,
			folderPath: fromFolderPath,
			regex: fromRegex
		} = await parseUserInputForPath(args[1], true)
		// Get the file name from the folder path
		let fromFileName = fromFolderPath.split('/')
		fromFileName =
			// If the path ends with a /, it is a folder
			fromFileName[fromFileName.length - 1] === '' ||
			fromFileName[fromFileName.length - 1] === '.' ||
			fromFileName[fromFileName.length - 1] === '..'
				? null
				: fromFileName[fromFileName.length - 1]
		// If there is a file name, remove it from the folder path
		if (fromFileName) {
			fromFolderPath = fromFolderPath.split('/')
			fromFolderPath = fromFolderPath.slice(0, -1).join('/')
		}

		// Get the path the user entered (the target to move to)
		let {
			drive: toDrive,
			folderPath: toFolderPath
		} = await parseUserInputForPath(args[2], false)
		// Get the file name from the folder path
		let toFileName = toFolderPath.split('/')
		toFileName =
			// If the path ends with a /, it is a folder
			toFileName[toFileName.length - 1] === '' ||
			toFileName[toFileName.length - 1] === '.' ||
			toFileName[toFileName.length - 1] === '..'
				? null
				: toFileName[toFileName.length - 1]
		// If there is a file name, remove it from the folder path
		if (toFileName) {
			toFolderPath = toFolderPath.split('/')
			toFolderPath = toFolderPath.slice(0, -1).join('/')
		}

		// Check if the user has given some regex and matching files are to
		// be copied
		if (fromRegex) {
			const files = await listRequest(fromDrive, fromFolderPath, fromRegex)
			if (files && files.length > 0) {
				// Keep a count of number of files moved and skipped due to errors
				let movedFilesCount = 0
				let erroredFilesCount = 0
				// Else loop through the files, download then upload and then delete
				// each one
				for (let i = 0, length = files.length; i < length; i++) {
					// The file obj
					const file = files[i]

					// Update the spinner
					startSpin(
						`Moving file ${highlight(
							diskPath(toFolderPath, file.name)
						)} to ${highlight(diskPath(toFolderPath, file.name))}`
					)

					// If the drive is the same, then simply update the file
					if (fromDrive === toDrive) {
						// Surround in try-catch to stop spinner in case
						// an error is thrown
						try {
							// Skip if its a folder
							if (file.kind === 'folder') {
								throw new Error(
									'Copying/moving/downloading folders is not yet supported, only deleting is'
								)
							}

							// Update the file
							// eslint-disable-next-line no-await-in-loop
							await updateRequest(
								fromDrive,
								fromFolderPath,
								file.name,
								toFolderPath,
								file.name
							)
							// Increase the moved files count
							movedFilesCount++
							// Tell the user
							const spinnerText = stopSpin()
							printInfo(
								`Moved file ${highlight(
									diskPath(fromFolderPath, file.name)
								)} to ${highlight(diskPath(toFolderPath, file.name))}`
							)
							startSpin(spinnerText)
						} catch (error) {
							// Increase the error count
							erroredFilesCount++
							// Print the error, but continue
							const spinnerText = stopSpin()
							printError(error, false)
							startSpin(spinnerText)
						}
					} else {
						// Surround in try-catch to stop spinner in case
						// an error is thrown
						try {
							// Skip if its a folder
							if (file.kind === 'folder') {
								throw new Error(
									'Copying/moving/downloading folders is not yet supported, only deleting is'
								)
							}

							// Fetch the file
							// eslint-disable-next-line no-await-in-loop
							const localPath = await downloadRequest(
								fromDrive,
								fromFolderPath,
								file.name
							)
							// Upload the file
							// eslint-disable-next-line no-await-in-loop
							await uploadRequest(toDrive, toFolderPath, file.name, localPath)
							// Delete the original file
							// eslint-disable-next-line no-await-in-loop
							await deleteRequest(fromDrive, fromFolderPath, file.name)
							// Increase the moved files count
							movedFilesCount++
							// Tell the user
							const spinnerText = stopSpin()
							printInfo(
								`Moved file ${highlight(
									diskPath(fromFolderPath, file.name)
								)} to ${highlight(diskPath(toFolderPath, file.name))}`
							)
							startSpin(spinnerText)
						} catch (error) {
							// Increase the error count
							erroredFilesCount++
							// Print the error, but continue
							const spinnerText = stopSpin()
							printError(error, false)
							startSpin(spinnerText)
						}
					}
				}

				// Stop loading, we are done
				stopSpin()
				// Tell the user the number of files we copied and skipped
				printInfo(
					`Moved ${highlight(movedFilesCount)} files successfully, ${highlight(
						erroredFilesCount
					)} skipped due to errors`
				)
				// Return succesfully
			} else {
				// Stop loading, error out
				throw new Error('No files matched that regex')
			}
		} else {
			// Surround in a try catch to stop spinner when an error is thrown
			try {
				// If the drive is the same, then simply update the file
				if (fromDrive === toDrive) {
					// Update the file
					await updateRequest(
						fromDrive,
						fromFolderPath,
						fromFileName,
						toFolderPath,
						toFileName || fromFileName
					)
					// Tell the user
					stopSpin()
					printInfo(
						`Moved file ${highlight(
							diskPath(fromFolderPath, fromFileName)
						)} to ${toFolderPath}/${toFileName || fromFileName}`
					)
				} else {
					// Fetch the file
					const localPath = await downloadRequest(
						fromDrive,
						fromFolderPath,
						fromFileName
					)
					// Upload the file
					await uploadRequest(
						toDrive,
						toFolderPath,
						toFileName || fromFileName,
						localPath
					)
					// Tell the user
					stopSpin()
					printInfo(
						`Moved file ${highlight(
							diskPath(fromFolderPath, fromFileName)
						)} to ${toFolderPath}/${toFileName || fromFileName}`
					)
				}
			} catch (error) {
				throw error
			}
		}

		// Return successfully
	}

	async delete(args) {
		// Show a loading indicator
		startSpin(`Loading your ${highlight('files and folders')}`)

		// Get the path the user entered, default to current directory
		let { drive, folderPath, regex } = await parseUserInputForPath(
			args[1],
			true
		)
		let fileName = null
		if (!regex) {
			fileName = folderPath.split('/')
			fileName =
				// If the path ends with a /, it is a folder
				fileName[fileName.length - 1] === '' ||
				fileName[fileName.length - 1] === '.' ||
				fileName[fileName.length - 1] === '..'
					? null
					: fileName[fileName.length - 1]
			// If there is a file name, remove it from the folder path
			if (fileName) {
				folderPath = folderPath.split('/')
				folderPath = folderPath.slice(0, -1).join('/')
			}
		}

		startSpin(
			`Deleting ${
				regex
					? `all files matching regex ${highlight(regex)}`
					: highlight(diskPath(folderPath, fileName || ''))
			}`
		)

		// List the files matching that regex so we can count how many we deleted
		let deletedFilesCount = 0

		// Delete the files
		try {
			deletedFilesCount = await deleteRequest(
				drive,
				folderPath,
				fileName,
				regex
			)
		} catch (error) {
			// Throw the error
			throw error
		}

		// Stop loading
		stopSpin()
		// Tell the user
		printInfo(
			`Deleted ${
				regex
					? `${highlight(deletedFilesCount)} files matching regex ${highlight(
							regex
					  )}`
					: highlight(diskPath(folderPath, fileName ? fileName : ''))
			}`
		)
		// Return successfully
	}

	async sync(args) {
		// Show a loading indicator
		startSpin(`Listing files in the ${highlight('source and target folders')}`)

		// Get the path the user entered, default to current directory (to sync from)
		const {
			drive: fromDrive,
			folderPath: fromFolderPath
		} = await parseUserInputForPath(args[1], false, true)

		// Get the path the user entered, default to current directory (to sync to)
		const {
			drive: toDrive,
			folderPath: toFolderPath
		} = await parseUserInputForPath(args[2], false, get('current-drive'))

		startSpin(
			`Listing all files in source folder ${highlight(
				`${fromDrive}:${fromFolderPath}`
			)}`
		)

		// Fetch the files from the server
		let fromFiles = (await listRequest(fromDrive, fromFolderPath)) || []

		startSpin(
			`Listing existing files in target folder ${highlight(
				`${toDrive}:${toFolderPath}`
			)}`
		)

		// Now list all those that exist in the target folder already
		let toFiles
		try {
			toFiles = (await listRequest(toDrive, toFolderPath)) || []
		} catch {
			// If the user wants to sync to a new folder, catch the 404
			toFiles = []
		}

		// Now compare the two lists and create a list of files to update
		// First get all files only
		fromFiles = fromFiles.filter((file) => file.kind === 'file')
		toFiles = toFiles.filter((file) => file.kind === 'file')

		// Get duplicates first, those will need to be checked and replaced if the
		// last modified time is greater
		let filesToUpdate = []

		// Get the number of times each file appears
		const occurrences = {}

		for (const fromFile of fromFiles) {
			occurrences[fromFile.name] = ++occurrences[fromFile.name] || 1
		}

		for (const toFile of toFiles) {
			occurrences[toFile.name] = ++occurrences[toFile.name] || 1
		}

		// Get the ones that appear 2 or more times
		for (const fileName of Object.keys(occurrences)) {
			if (occurrences[fileName] >= 2) {
				// Add it to the final array
				filesToUpdate.push(fromFiles.find((file) => file.name === fileName))
			}
		}

		// Update the files only if needed
		filesToUpdate =
			filesToUpdate.length > 0
				? filesToUpdate
						.map((key) => {
							const existingFile = toFiles.find(
								(file) => file.name === key.name
							)
							if (existingFile) {
								const existingDate = new Date(existingFile.lastModifiedTime)
								const newDate = new Date(key.lastModifiedTime)
								if (newDate > existingDate) {
									return key
								}
							}

							return null
						})
						.filter((file) => file !== null)
				: []

		// Now get those that need to be added
		const filesToAdd = fromFiles.filter((file) => {
			return occurrences[file.name] < 2
		})

		// Keep a count of files updated, created and skipped due to errors
		let updatedFilesCount = 0
		let createdFilesCount = 0
		let erroredFilesCount = 0

		// Function to update files, called individually for the filesToAdd and
		// filesToUpdate arrays so we can keep count of files updated and created
		const processFile = async (fileToSync, updateWhichCount) => {
			startSpin(
				`Syncing file ${highlight(
					`${fromDrive}:${diskPath(fromFolderPath, fileToSync.name)}`
				)} to ${highlight(
					`${toDrive}:${diskPath(toFolderPath, fileToSync.name)}`
				)}`
			)

			try {
				// Fetch the file
				const localPath = await downloadRequest(
					fromDrive,
					fromFolderPath,
					fileToSync.name
				)
				// Upload the file
				await uploadRequest(toDrive, toFolderPath, fileToSync.name, localPath)

				// Increase the number of files updated/created
				if (updateWhichCount === 'update') {
					updatedFilesCount++
				} else if (updateWhichCount === 'create') {
					createdFilesCount++
				}

				// Tell the user
				const spinnerText = stopSpin()
				printInfo(
					`Synced file ${highlight(
						`${fromDrive}:${diskPath(fromFolderPath, fileToSync.name)}`
					)} to ${highlight(
						`${toDrive}:${diskPath(toFolderPath, fileToSync.name)}`
					)}`
				)
				startSpin(spinnerText)
			} catch (error) {
				// Increase the number of files updated/created
				erroredFilesCount++
				// Print the error and skip the file
				const spinnerText = stopSpin()
				printError(error, false)
				startSpin(spinnerText)
			}
		}

		// Update/create all the files needed
		for (const fileToSync of filesToAdd) {
			// eslint-disable-next-line no-await-in-loop
			await processFile(fileToSync, 'create')
		}

		for (const fileToSync of filesToUpdate) {
			// eslint-disable-next-line no-await-in-loop
			await processFile(fileToSync, 'update')
		}

		// Stop loading
		stopSpin()

		printInfo(
			`${highlight(updatedFilesCount)} files updated, ${highlight(
				createdFilesCount
			)} files created and ${highlight(
				fromFiles.length -
					updatedFilesCount -
					createdFilesCount -
					erroredFilesCount
			)} were already up-to-date. ${highlight(
				erroredFilesCount
			)} files were skipped due to errors encountered.`
		)
	}
}

// Export the class
module.exports.Client = Client
