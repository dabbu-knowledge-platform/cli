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
const path = require('path')
const ora = require('ora')
const link = require('terminal-link')
const chalk = require('chalk')
const figlet = require('figlet')
const axios = require('axios').default

const Conf = require('conf')
const config = new Conf()

const Table = require('cli-table3')

// Return the fancy text that we can print out
exports.getDrawableText = (text) => {
	// Return it wrapped up as a promise
	return new Promise((resolve, reject) => {
		// Get the text
		figlet.text(text, (error, result) => {
			// In the callback, check for errors
			if (error) {
				// Error occurred, reject
				reject(error)
			} else {
				// Return the printable result
				resolve(result)
			}
		})
	})
}

// Handle an input error while reading user input
exports.handleInputError = (error) => {
	// Check if it is a Ctrl+C
	if (error.code === 'SIGINT') {
		// If so, exit without error
		this.exitDabbu()
		return
	}

	// Else print out the error
	this.printError(error)
}

// Get a variable's value from config
exports.get = (name) => {
	return config.get(name)
}

// Set the value of a variable in config
exports.set = (path, value) => {
	return config.set(path, value)
}

exports.deleteConfig = () => {
	return config.clear()
}

// A helper function to generate the body and headers of a request for
// a provider
exports.generateBodyAndHeaders = async (drive) => {
	const body = {}
	const headers = {}
	// The provider config
	let providerConfigJson = await axios.get(
		'https://dabbu-knowledge-platform.github.io/schema/provider-fields.json'
	)
	providerConfigJson = providerConfigJson.data.providers.v2
	// Get the config for the respective provider ID of the drive
	const providerConfig = providerConfigJson[
		this.get(`drives.${drive}.provider`)
	] || { request: {} }

	// First refresh the access token, if any
	await this.refreshAccessToken(drive)

	// Get a list of variables from the provider config
	const bodyVariables = Object.keys(providerConfig.request.body || {})
	const headerVariables = Object.keys(providerConfig.request.headers || {})

	// Loop through them and get their value
	for (let i = 0, length = bodyVariables.length; i < length; i++) {
		const variable = providerConfig.request.body[bodyVariables[i]]
		body[bodyVariables[i]] = this.get(`drives.${drive}.${[variable.path]}`)
	}

	// Loop through them and get their value
	for (let i = 0, length = headerVariables.length; i < length; i++) {
		const variable = providerConfig.request.headers[headerVariables[i]]
		headers[headerVariables[i]] = this.get(`drives.${drive}.${[variable.path]}`)
	}

	// Return successfully
	return [body, headers]
}

// A helper function to regenerate the access token in case
// it has expired
exports.refreshAccessToken = async (drive) => {
	// Stop loading
	const spinnerText = this.stopSpin()
	// The provider config
	let providerConfigJson = await axios.get(
		'https://dabbu-knowledge-platform.github.io/schema/provider-fields.json'
	)
	providerConfigJson = providerConfigJson.data.providers.v2
	// Get the config for the respective provider ID of the drive
	const providerConfig = providerConfigJson[
		this.get(`drives.${drive}.provider`)
	] || { request: {} }
	// Get a list of variables from the provider config
	const headerVariables = Object.keys(providerConfig.request.headers || {})

	// Check if the provider has a authorization field in its headers and auth is enabled
	const authHeaderIndex = headerVariables.includes('authorization')
		? headerVariables.indexOf('authorization')
		: headerVariables.indexOf('Authorization')
	if (
		authHeaderIndex > -1 &&
		providerConfig.auth &&
		providerConfig.auth.process === 'oauth2'
	) {
		// Refresh only if expired
		const date = Number(Date.now())
		const expiresAtDate = Number(
			this.get(`drives.${drive}.${providerConfig.auth.path}.expires-at`)
		)
		if (expiresAtDate < date) {
			// If it has expired, get the auth metadata and the refresh token first
			const refreshToken = this.get(
				`drives.${drive}.${providerConfig.auth.path}.refresh-token`
			)

			// Get the URL to make a POST request to refresh the access token
			const tokenURL = providerConfig.auth['token-uri']
			// Make a POST request with the required params
			// Put the params as query params in the URL and in the request
			// body too, Microsoft requires the params as a string in the body
			const result = await axios.post(
				tokenURL,
				// In the body
				providerConfig.auth['send-auth-metadata-in'] === 'request-body'
					? `refresh_token=${refreshToken}&client_id=${this.get(
							`drives.${drive}.auth-meta.client-id`
					  )}&client_secret=${this.get(
							`drives.${drive}.auth-meta.client-secret`
					  )}&redirect_uri=${this.get(
							`drives.${drive}.auth-meta.redirect-uri`
					  )}&grant_type=refresh_token`
					: null,
				// In the URL query parameters
				{
					params:
						providerConfig.auth['send-auth-metadata-in'] === 'query-param'
							? {
									// eslint-disable-next-line camelcase
									refresh_token: refreshToken,
									// eslint-disable-next-line camelcase
									client_id: this.get(`drives.${drive}.auth-meta.client-id`),
									// eslint-disable-next-line camelcase
									client_secret: this.get(
										`drives.${drive}.auth-meta.client-secret`
									),
									// eslint-disable-next-line camelcase
									redirect_uri: this.get(
										`drives.${drive}.auth-meta.redirect-uri`
									),
									// eslint-disable-next-line camelcase
									grant_type: 'refresh_token'
							  }
							: {}
				}
			)
			// Store the access token and update the expiry time
			const {
				token_type: tokenType,
				access_token: accessToken,
				expires_in: expiresIn
			} = result.data
			this.set(
				`drives.${drive}.${providerConfig.auth.path}.access-token`,
				`${tokenType || 'Bearer'} ${accessToken}`
			)
			this.set(
				`drives.${drive}.${providerConfig.auth.path}.expires-at`,
				Number(Date.now()) + expiresIn * 1000
			) // Multiply by thousands to keep milliseconds)
			// Tell the user
			this.printInfo(
				`\nRefreshed access token, expires at ${new Date(
					this.get(`drives.${drive}.${providerConfig.auth.path}.expires-at`)
				).toLocaleString()}`
			)
		}
		// If it is not expired, return successfully
	}

	// If there is no auth required for that provider, return successfully
	// Before returning, resume loading
	this.startSpin(spinnerText)
}

// Return an absolute path based on the current path in
// the drive and the user-entered path
exports.getAbsolutePath = (inputPath, currentPath) => {
	// If there is no path given, or the path is /, return
	// nothing (which means /)
	if (!inputPath || inputPath === '/') {
		return ''
	}

	// Split the path by / and get an array of folders
	const folders = inputPath.split('/')
	// The final path should begin with the current path
	// only if the user hasn't mentioned an absolute path
	const finalPath = inputPath.startsWith('/')
		? ['/']
		: currentPath
		? currentPath.split('/')
		: ['/']

	// Loop through the input path
	for (let i = 0, length = folders.length; i < length; i++) {
		// Get the folder
		const folder = folders[i]
		if (folder === '.') {
			// Do nothing if the folder is . (meaning current directory)
			continue
		} else if (folder === '..') {
			// Go back one folder if the path is ..
			finalPath.pop()
		} else {
			// Else add the folder to the path
			finalPath.push(folder)
		}
	}

	// Return the path, joined by /s and replace any duplicate slash
	return finalPath
		.join('/')
		.replace(/\/{4}/g, '/')
		.replace(/\/{3}/g, '/')
		.replace(/\/\//g, '/')
}

exports.parseUserInputForPath = async (
	input,
	allowRegex,
	fallbackDriveName
) => {
	// Assume the input to be "." if there is none
	// Don't throw an error as there might be a fallback
	// file name
	const inputPath = input || '.'
	// Split it to check if there is a drive specified there
	const splitPath = inputPath.split(':')
	// Get the drive name
	const drive =
		splitPath.length === 1
			? fallbackDriveName
				? fallbackDriveName
				: this.get('current-drive')
			: splitPath[0]

	// Get the file/folder path
	let originalPath = splitPath.length === 1 ? splitPath[0] : splitPath[1]

	// First (before parsing further) refresh the access token
	await this.refreshAccessToken(drive)

	// Check if there is some regex (only asterix for now) included
	if (originalPath.includes('*')) {
		if (!allowRegex) throw new Error('Regex not allowed for this command')
		if (!originalPath.startsWith('/')) originalPath = `./${originalPath}`
		// If so, parse it to get a base folder to search in
		const paths = originalPath.split('*')
		// Get the last folder without the regex part
		const baseFolderPath = paths[0].slice(
			0,
			Math.max(0, paths[0].lastIndexOf('/') + 1)
		)
		// Get an absolute path
		const folderPath = this.getAbsolutePath(
			baseFolderPath,
			this.get(`drives.${drive}.path`)
		)
		// Add the part with the asterix at the end of the folder path so we
		// can filter the list later
		const regexPart = `${paths[0].slice(
			Math.max(0, paths[0].lastIndexOf('/') + 1)
		)}*${paths.slice(1).join('*')}`

		// Return successfully
		return {
			drive,
			folderPath,
			regex:
				'^' +
				regexPart
					.split('*')
					.map((string) => string.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1'))
					.join('.*') +
				'$'
		}
	}

	// Get the folder names and file names separately
	const foldersArray = originalPath.split('/')

	// Parse the relative path and get an absolute one
	let folderPath = this.getAbsolutePath(
		`${originalPath.startsWith('/') ? '/' : ''}${foldersArray.join('/')}`,
		this.get(`drives.${drive}.path`)
	)
	folderPath = folderPath === '' ? '/' : folderPath

	// Return the file name and path
	return {
		drive,
		folderPath,
		regex: null
	}
}

// Remove any duplicates (and the original too) from an array
exports.removeOriginalAndDuplicates = (array) => {
	return array.filter((item, pos) => {
		return array.lastIndexOf(item) === array.indexOf(item)
	})
}

// Convert a file size in bytes to a human readable format (with units)
// Copied from here - https://stackoverflow.com/a/20732091
exports.getHumanReadableFileSize = (fileSize) => {
	const thresh = 1024

	if (Math.abs(fileSize) < thresh) {
		return fileSize + ' B'
	}

	const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
	let unitIndex = -1
	const decimalsToKeep = 2

	do {
		fileSize /= thresh
		++unitIndex
	} while (
		Math.round(Math.abs(fileSize) * 10 ** decimalsToKeep) /
			10 ** decimalsToKeep >=
			thresh &&
		unitIndex < units.length - 1
	)

	return fileSize.toFixed(decimalsToKeep) + ' ' + units[unitIndex]
}

// Get a human readable mime name
// Taken from the npm module name2mime, but made the index
// the mime type instead of file extension
exports.getNameForMime = (mime) => {
	const types = require('./mimes.json')
	const value = (types[mime] || {}).name
	return value || mime || 'Unknown'
}

// Get a file extension from the mime type
exports.getExtForMime = (mime) => {
	const types = require('./mimes.json')
	const value = (types[mime] || {}).ext
	return value || ''
}

// Display a set of files in a tabular format
exports.printFiles = (files, printFullPath = false, showHeaders = true) => {
	// If there are no files, print out empty folder and return
	if (!files) {
		this.printBright('Folder is empty')
		return
	}

	// Append the files to a table and then display them
	const meta = showHeaders
		? {
				head: [
					chalk.green('Name'),
					chalk.green('Size'),
					chalk.green('Type'),
					chalk.green('Last modified'),
					chalk.green('Action(s)')
				],
				colWidths: [null, null, null, null, null]
		  }
		: null
	const table = new Table(meta)
	for (let i = 0, length = files.length; i < length; i++) {
		const file = files[i]

		// File name - blue if folder, magenta if file
		const name = printFullPath ? `${file.provider}:${file.path}` : file.name
		const fileName =
			file.kind === 'folder'
				? `${chalk.blue(name)} (folder)`
				: chalk.magenta(name)
		// File size in a human readable unit
		const fileSize =
			!file.size || file.kind === 'folder'
				? '-'
				: this.getHumanReadableFileSize(file.size)
		// Mime type of file
		const fileType = this.getNameForMime(file.mimeType)
		// Last modified time
		let dateModified = new Date(
			file.lastModifiedTime
		).toLocaleDateString('en-in', { hour: 'numeric', minute: 'numeric' })
		if (dateModified === 'Invalid Date') {
			dateModified = '-'
		}

		// Download link
		const contentURI = file.contentURI
		// Convert to hyper link and then display it
		let downloadLink
		if (file.kind === 'folder') {
			if (contentURI) {
				downloadLink = link('View folder', contentURI, {
					fallback: (text, url) => `${text} (${url})`
				})
			} else {
				downloadLink = 'Link unavailable'
			}
		} else if (contentURI) {
			downloadLink = link('View file', contentURI, {
				fallback: (text, url) => `${text} (${url})`
			})
		} else {
			downloadLink = 'Link unavailable'
		}

		table.push([fileName, fileSize, fileType, dateModified, downloadLink])
	}

	// Print out the table
	if (table.length > 0) {
		this.printInfo(`${table.length} files/folders`)
		console.log(table.toString())
	}
}

// The universal spinner
const spinner = ora('Loading...')
exports.startSpin = (text) => {
	spinner.text = text
	spinner.start()
}

exports.stopSpin = () => {
	const stoppedSpinner = spinner.stop()
	return stoppedSpinner.text
}

exports.diskPath = (...folderPaths) => {
	return path.normalize(folderPaths.join('/'))
}

// Wrap the console.log in a print function
exports.print = console.log

// Highlight something in orange
exports.highlight = chalk.keyword('orange')

// Print out information in yellow
exports.printInfo = (anything) => {
	this.print(chalk.yellow(anything))
}

// Print out something important in orange
exports.printBright = (anything) => {
	this.print(this.highlight.bold(anything))
}

// Print out an error in red
exports.printError = (error, stopSpinner = true) => {
	if (stopSpinner) this.stopSpin()
	if (process.env.PRINT_ERRORS) console.error(error)
	if (error.isAxiosError) {
		if (error.code === 'ECONNRESET') {
			this.print(
				chalk.red.bold(
					'The server abruptly closed the connection. Check your wifi connection. Also check if the server has shut down or try again in a few seconds.'
				)
			)
		}

		if (
			error.response &&
			error.response.data &&
			error.response.data.error &&
			error.response.data.error.message
		) {
			this.print(chalk.red.bold(error.response.data.error.message))
		} else if (error.status) {
			this.print(chalk.red.bold(`${error.status}: ${error.statusText}`))
		} else {
			this.print(chalk.red.bold(error))
		}
	} else if (error.message) {
		this.print(chalk.red.bold(error.message))
	} else {
		this.print(chalk.red.bold(error))
	}
}

// Exit Dabbu and delete the _dabbu directory
exports.exitDabbu = () => {
	return fs
		.remove(`./_dabbu/_cli/`)
		.then(() => this.printInfo('Removed cache. Exiting..'))
		.finally(() => process.exit(0)) // eslint-disable-line unicorn/no-process-exit
}
