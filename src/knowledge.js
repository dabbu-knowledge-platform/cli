/* Dabbu CLI - A CLI that leverages the Dabbu API and neatly retrieves your files and folders scattered online
 *
 * Copyright (C) 2021  Dabbu Knowledge Platform <dabbuknowledgeplatform@gmail.com>
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
const chalk = require('chalk')
const axios = require('axios').default
const prompt = require('readcommand')

const FormData = require('form-data')

const {
	get,
	set,
	getAbsolutePath,
	generateBodyAndHeaders,
	getExtForMime,
	printInfo,
	printBright,
	printError,
	printFiles,
	highlight,
	startSpin,
	stopSpin
} = require('./utils')

// A helper function to list files in a folder
const listRequest = async (drive, folderPath) => {
	/// Get the server address, provider ID and URL encode the folder path
	const server = get('server')
	const provider = get(`drives.${drive}.provider`)
	const encodedFolderPath = encodeURIComponent(
		folderPath === '' ? '/' : folderPath
	)

	// The URL to send the request to
	let allFiles = []
	let nextSetToken = ''
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
			allFiles = [...allFiles, ...result.data.content]
		}
	} while (nextSetToken) // Keep doing the
	// above list request until there is no nextSetToken returned

	// Check if there is a response
	if (allFiles.length > 0) {
		// Return the files
		return allFiles
	}

	// Else return null if it is an empty folder
	return null
}

// A helper function to download a file based on its content URI
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

	return { localPath, fileMeta: file }
}

// A helper function to list files recursively
const listFilesRecursively = (drive, folder) => {
	// Tell the user which folder we are querying
	startSpin(`Fetching files in ${highlight(folder)}`)
	// An array to hold all the files whose names contain any
	// one of the search terms
	let matchingFiles = []
	// Wrap everything in a promise
	return new Promise((resolve, reject) => {
		// Call the module's list function
		listRequest(drive, folder)
			.then((list) => {
				if (list) {
					// First get all of the files not folders (we do !=== folder)
					// as we might have the "file" and "other" types
					const filesOnlyList = list.filter((item, pos) => {
						return item.kind !== 'folder'
					})

					// Add the matched ones to the final array
					matchingFiles = matchingFiles.concat(filesOnlyList)

					// Now recurse through the remaining folders
					let i = 0
					// Create a function that will walk through the directories
					const next = () => {
						// Current file
						const file = list[i++]
						// If there is no such file, return all the matching
						// files found so far (we've reached the end)
						if (!file) {
							return resolve(matchingFiles)
						}

						if (file.kind === 'folder') {
							// If it's a folder, then call the listFilesRecursively method again
							// with the folder path
							listFilesRecursively(drive, file.path)
								.then((files) => {
									// Add the matching files to the matching files array
									matchingFiles = matchingFiles.concat(files)
								})
								.then(() => next())
						} else {
							// We have already printed and added these files to the array,
							// so continue
							next()
						}
					}

					// Start the chain
					next()
				} else {
					resolve([])
				}
			})
			.catch(reject) // Pass the error back on
	})
}

// The Klient class (Knowledge + Client = Klient) (bad joke)
const Klient = class {
	constructor() {
		this.ops = {
			pwd: this.pwd,
			whereami: this.pwd,
			cd: this.cd,
			ct: this.cd,
			changedir: this.cd,
			changetopic: this.cd,
			l: this.list,
			ls: this.list,
			ll: this.list,
			dir: this.list,
			list: this.list,
			op: this.onepager,
			onepager: this.onepager
		}
	}

	async init(drive) {
		// Ask the user which providers we should index
		const requestDrivesToIndex = () => {
			return new Promise((resolve, reject) => {
				// Get the user's drives
				let drives = ''
				const driveJson = get('drives')
				for (const drive of Object.keys(driveJson)) {
					drives += `${drive} (${driveJson[drive].provider}), `
				}

				// Tell the user what they need to do
				printInfo(
					[
						'The knowledge drive uses the Dabbu Intel API to extract topics, people and places',
						'from the information stored in your drives. It will then allow you to view all files',
						'regarding a certain topic or regarding a certain person. Pick the drives whose',
						'files we should extract topics, people and places from.',
						'',
						`The current drives setup are => ${drives}`
					].join('\n')
				)

				prompt.read(
					{
						ps1: `Enter the names of the drives, separated by commas > `
					},
					(error, args) => {
						// If there is an error, handle it
						if (error) {
							reject(error)
						} else {
							// If there is no error, get the value
							let drivesToIndex = args.join('')
							// Check if they have entered a non null value
							if (drivesToIndex) {
								// Turn it into an array
								drivesToIndex = drivesToIndex
									.split(',')
									.map((value) => value.replace(/:/g, ''))
									.filter((value) => value && value !== '')
								// Store its value in the config file
								set(`drives.${drive}.vars.drives_to_index`, drivesToIndex)
								// Return successfully
								resolve(drivesToIndex)
							} else {
								// If they haven't entered anything, flag it and ask again
								printBright(`Please enter the names of the drives`)
								resolve(requestDrivesToIndex())
							}
						}
					}
				)
			})
		}

		// Ask the user which drives they want to index
		const drivesToIndex = await requestDrivesToIndex()

		// Tell the user what we are going to do
		printBright(
			'Hang on while we fetch and index your files, this might take a long time depending on the number of files...'
		)
		// Show a loading indicator
		startSpin('Loading...')

		// The file in which to store the index data
		const indexFilePath = `./_dabbu/dabbu_knowledge_index.json`
		// Create that file
		await fs.createFile(indexFilePath)
		// The json object to write to that file
		const indexJson = { files: [], keywords: {} }

		// For each drive, index all its files
		for (const driveToIndex of drivesToIndex) {
			// Tell the user what we are doing
			startSpin(`Fetching files from ${highlight(driveToIndex)}`)

			// Fetch the file's metadata recursively
			// eslint-disable-next-line no-await-in-loop
			const files = await listFilesRecursively(driveToIndex, '/')
			// Add the files to the JSON
			indexJson.files.push(...files)

			// Number of files skipped due to errors
			let skippedFiles = 0

			// Check if there are some files
			if (files && files.length > 0) {
				// If so, fetch the contents of each file using the content URI and index them
				for (const file of files) {
					if (file.kind === 'file') {
						// Tell the user what we are doing
						startSpin(
							`Indexing file ${highlight(driveToIndex + ':' + file.path)}`
						)
						// Get the file name and the folder path
						const fileName = file.name
						let folderPath = file.path.split('/')
						folderPath = folderPath.slice(0, -1).join('/')

						// Surround with a try-catch
						try {
							// Download the file based on its content URI
							// eslint-disable-next-line no-await-in-loop
							const { localPath, fileMeta } = await downloadRequest(
								driveToIndex,
								folderPath,
								fileName
							)

							// Now get the topics, people and places from the files

							// Make a form data object to upload the files
							const formData = new FormData()
							// Add the file's data as a readable stream to the content field
							formData.append('content', fs.createReadStream(localPath), {
								filename: fileName
							})

							// eslint-disable-next-line no-await-in-loop
							const extractedData = await axios.post(
								'http://dabbu-intel.herokuapp.com/intel-api/v2/extract-info',
								formData,
								{
									headers: formData.getHeaders(),
									maxContentLength: Number.POSITIVE_INFINITY,
									maxBodyLength: Number.POSITIVE_INFINITY
								}
							)

							// Check if data was returned
							if (extractedData.data && extractedData.data.content) {
								// Check if there were topics extracted
								if (
									extractedData.data.content.topics &&
									extractedData.data.content.topics.length > 0
								) {
									for (const topic of extractedData.data.content.topics) {
										if (!indexJson.keywords[topic.text]) {
											indexJson.keywords[topic.text] = []
										}

										indexJson.keywords[topic.text].push(file)
									}
								}

								// Check if there were people-related details extracted
								if (
									extractedData.data.content.people &&
									extractedData.data.content.people.length > 0
								) {
									for (const person of extractedData.data.content.people) {
										if (!indexJson.keywords[person.email]) {
											indexJson.keywords[person.email] = []
										}

										indexJson.keywords[person.email].push(file)
									}
								}

								// Check if there were places extracted
								if (
									extractedData.data.content.places &&
									extractedData.data.content.places.length > 0
								) {
									for (const place of extractedData.data.content.places) {
										if (!indexJson.keywords[place.name]) {
											indexJson.keywords[place.name] = []
										}

										indexJson.keywords[place.name].push(file)
									}
								}
							}
						} catch (error) {
							// Just print out the error if any one of the files fails and continue
							const spinnerText = stopSpin()
							printError(`Skipping ${fileName}, error encountered: ${error}`)
							skippedFiles++
							startSpin(spinnerText)
						}
					}
				}
			} else {
				// If there are no files, continue
				continue
			}

			// Write the data to the file (save progress)
			// eslint-disable-next-line no-await-in-loop
			await fs.writeFile(indexFilePath, JSON.stringify(indexJson, null, 2))

			// Tell the user we are finished with that drive
			stopSpin()
			printBright(
				`Successfully indexed all files in ${driveToIndex}: (${skippedFiles} skipped due to errors)`
			)
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

	// Change the topic the user is viewing
	async cd(args) {
		// The user given relative path
		const inputPath = args[1]
		// The current path in that drive
		const currentPath = get(`drives.${get('current-drive')}.path`) || ''

		// Parse the relative path and get an absolute one
		const finalPath = getAbsolutePath(inputPath, currentPath)
		// Set the path
		set(`drives.${get('current-drive')}.path`, finalPath)

		// Return
	}

	async list(args) {
		// The user given relative path
		const inputPath = args[1] || '.'
		// The current path in that drive
		const currentPath = get(`drives.${get('current-drive')}.path`) || ''

		// Parse the relative path and get an absolute one
		const keywords = getAbsolutePath(inputPath, currentPath)

		// Get the indexed files
		let indexJson
		try {
			indexJson = await fs.readJSON('./_dabbu/dabbu_knowledge_index.json')
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new Error(
					`Could not find the index file, ${chalk.yellow(
						'./_dabbu/dabbu_knowledge_index.json'
					)}. Try recreating the drive with the same settings again.`
				)
			}
		}

		if (indexJson) {
			// First check what the path is
			// For the root path, simply show them topics, places and people
			if (keywords === '/') {
				printInfo(Object.keys(indexJson.keywords).join('   '))
			} else {
				// Else find the files with the topic/person/place and show their info
				const path = keywords.split('/')

				// Each folder is a topic/place/person that the file must be
				// related to to get listed
				const allFiles = []
				let matchingFiles = []
				let numberOfTopics = path.slice(1).length

				// For AND queries between two or more topics, just keep `cd`ing into
				// the topics/people/places. For OR queries, `cd` into:
				// `cd "{topic1}|{topic2}"`
				// Quotes neccessary only if the topics contain spaces.
				for (let i = 1; i < path.length; i++) {
					// If there is a trailing slash, don't consider it a topic
					if (path[i] && path[i] !== '') {
						// Check if the path has an OR operator (|)
						if (path[i].includes('|')) {
							const orTopics = path[i].split('|')
							for (const orTopic of orTopics) {
								// Add all files matching each topic to the list
								const files = indexJson.keywords[orTopic]
								if (files) {
									allFiles.push(...files)
								} else {
									printBright(`Couldn't find topic ${orTopic}`)
								}
							}
						} else {
							const files = indexJson.keywords[path[i]]
							if (files) {
								allFiles.push(...files)
							} else {
								printBright(`Couldn't find topic ${path[i]}`)
							}
						}
					} else {
						// If there is a trailing slash, don't consider it a topic
						numberOfTopics -= 1
					}
				}

				// Check if the user has specified multiple topics
				if (path.length > 2) {
					// Make an array of provider+name of file
					const fileIds = allFiles.map((file) => {
						return `${file.provider}:${file.path}`
					})

					// Get the number of times each file appears
					const occurrences = {}
					for (const fileId of fileIds) {
						occurrences[fileId] = ++occurrences[fileId] || 1
					}

					// Get the ones that appear n number of times, where
					// n is the number of topics it should match
					for (const fileId of Object.keys(occurrences)) {
						if (occurrences[fileId] === numberOfTopics) {
							// Add it to the final array
							matchingFiles.push(allFiles[fileIds.indexOf(fileId)])
						}
					}
				} else {
					// Else just return the files for the topic we got
					matchingFiles = allFiles
				}

				// Print out the files
				printFiles(matchingFiles, true)
			}
		} else {
			throw new Error(
				`Could not read the index file, ${chalk.yellow(
					'./_dabbu/dabbu_knowledge_index.json'
				)}. Try recreating the drive with the same settings again.`
			)
		}
	}

	async onepager(args) {
		throw new Error('Not yet implemented')
	}
}

// Export the class
module.exports.Klient = Klient
