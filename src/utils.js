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
const link = require('terminal-link')
const chalk = require('chalk')
const figlet = require('figlet')
const axios = require('axios')

const Conf = require('conf')
const config = new Conf()

const Table = require('cli-table3')

// Return the fancy text that we can print out
exports.getDrawableText = (text) => {
  // Return it wrapped up as a promise
  return new Promise((resolve, reject) => {
    // Get the text
    figlet.text(text, (err, res) => {
      // In the callback, check for errors
      if (err) {
        // Error occurred, reject
        reject(err)
      } else {
        // Return the printable result
        resolve(res)
      }
    })
  })
}

// Handle an input error while reading user input
exports.handleInputError = (err) => {
  // Check if it is a Ctrl+C
  if (err.code === 'SIGINT') {
    // If so, exit without error
    this.exitDabbu()
    return
  }

  // Else print out the error
  this.printError(err)
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
  let body = {}
  let headers = {}
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
  let bodyVariables = Object.keys(providerConfig.request.body || {})
  let headerVariables = Object.keys(providerConfig.request.headers || {})

  // Loop through them and get their value
  for (let i = 0, length = bodyVariables.length; i < length; i++) {
    const variable = providerConfig.request.body[bodyVariables[i]]
    body[bodyVariables[i]] = this.get(`drives.${drive}.${[variable['path']]}`)
  }

  // Loop through them and get their value
  for (let i = 0, length = headerVariables.length; i < length; i++) {
    const variable = providerConfig.request.headers[headerVariables[i]]
    headers[headerVariables[i]] = this.get(
      `drives.${drive}.${[variable['path']]}`
    )
  }

  // Return successfully
  return [body, headers]
}

// A helper function to regenerate the access token in case
// it has expired
exports.refreshAccessToken = async (drive) => {
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
  let headerVariables = Object.keys(providerConfig.request.headers || {})

  // Check if the provider has a authorization field in its headers and auth is enabled
  const authHeaderIndex =
    headerVariables.indexOf('authorization') === -1
      ? headerVariables.indexOf('Authorization')
      : headerVariables.indexOf('authorization')
  if (
    authHeaderIndex > -1 &&
    providerConfig.auth &&
    providerConfig.auth.process === 'oauth2'
  ) {
    // Refresh only if expired
    let date = parseInt(Date.now())
    let expiresAtDate = parseInt(
      this.get(`drives.${drive}.${providerConfig.auth.path}.expires_at`)
    )
    if (expiresAtDate < date) {
      // If it has expired, get the auth metadata and the refresh token first
      let refreshToken = this.get(
        `drives.${drive}.${providerConfig.auth.path}.refresh_token`
      )

      // Get the URL to make a POST request to refresh the access token
      const tokenURL = providerConfig.auth.token_uri
      // Make a POST request with the required params
      // Put the params as query params in the URL and in the request
      // body too, Microsoft requires the params as a string in the body
      const res = await axios.post(
        tokenURL,
        // In the body
        `refresh_token=${refreshToken}&client_id=${this.get(
          `drives.${drive}.auth_meta.client_id`
        )}&client_secret=${this.get(
          `drives.${drive}.auth_meta.client_secret`
        )}&redirect_uri=${this.get(
          `drives.${drive}.auth_meta.redirect_uri`
        )}&grant_type=${'refresh_token'}`,
        // In the URL query parameters
        {
          params: {
            refresh_token: refreshToken,
            client_id: this.get(`drives.${drive}.auth_meta.client_id`),
            client_secret: this.get(`drives.${drive}.auth_meta.client_secret`),
            redirect_uri: this.get(`drives.${drive}.auth_meta.redirect_uri`),
            grant_type: 'refresh_token',
          },
        }
      )
      // Store the access token and update the expiry time
      const { token_type, access_token, expires_in } = res.data
      this.set(
        `drives.${drive}.${providerConfig.auth.path}.access_token`,
        `${token_type || 'Bearer'} ${access_token}`
      )
      this.set(
        `drives.${drive}.${providerConfig.auth.path}.expires_at`,
        parseInt(Date.now()) + expires_in * 1000
      ) // Multiply by thousands to keep milliseconds)
      // Tell the user
      this.printInfo(
        `\nRefreshed access token, expires at ${new Date(
          this.get(`drives.${drive}.${providerConfig.auth.path}.expires_at`)
        ).toLocaleString()}`
      )
      // Return successfully
      return
    } else {
      // If it is not expired, return successfully
      return
    }
  } else {
    // If there is no auth required for that provider, return successfully
    return
  }
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
  let finalPath = inputPath.startsWith('/')
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
    .replace(/\/\/\/\//g, '/')
    .replace(/\/\/\//g, '/')
    .replace(/\/\//g, '/')
}

exports.parseUserInputForPath = async (
  input,
  allowRegex,
  fallbackDriveName,
  fallbackFileName
) => {
  // Assume the input to be "." if there is none
  // Don't throw an error as there might be a fallback
  // file name
  let inputPath = input || '.'
  // Split it to check if there is a drive specified there
  let splitPath = inputPath.split(':')
  // Get the drive name
  let drive =
    splitPath.length === 1
      ? fallbackDriveName
        ? fallbackDriveName
        : this.get('current_drive')
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
    const baseFolderPath = paths[0].substring(0, paths[0].lastIndexOf('/'))
    // Get an absolute path
    let folderPath = this.getAbsolutePath(
      baseFolderPath,
      this.get(`drives.${drive}.path`)
    )
    // Add the part with the asterix at the end of the folder path so we
    // can filter the list later
    regexPart = `${paths[0].substring(
      paths[0].lastIndexOf('/') + 1
    )}*${paths.slice(1).join('*')}`

    // Return successfully
    return {
      drive: drive,
      folderPath: folderPath,
      regex: '^' + regexPart.split('*').map(this.escapeRegex).join('.*') + '$',
    }
  } else {
    // Get the folder names and file names separately
    let foldersArray = originalPath.split('/')

    // Parse the relative path and get an absolute one
    let folderPath = this.getAbsolutePath(
      `${
        originalPath.startsWith('./') ||
        originalPath.startsWith('../') ||
        originalPath === '.' ||
        originalPath === '..'
          ? ''
          : '/'
      }${foldersArray.join('/')}`,
      this.get(`drives.${drive}.path`)
    )
    folderPath = folderPath === '' ? '/' : folderPath

    // Return the file name and path
    return {
      drive: drive,
      folderPath: folderPath,
      regex: null,
    }
  }
}

// Remove any duplicates (and the original too) from an array
exports.removeOriginalAndDuplicates = (array) => {
  return array.filter((item, pos) => {
    return array.lastIndexOf(item) == array.indexOf(item)
  })
}

exports.escapeRegex = (str) => {
  return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')
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
          chalk.green('Action(s)'),
        ],
        colWidths: [null, null, null, null, null],
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
      if (!contentURI) {
        downloadLink = 'Link unavailable'
      } else {
        downloadLink = link('View folder', contentURI, {
          fallback: (text, url) => `${text} (${url})`,
        })
      }
    } else {
      if (!contentURI) {
        downloadLink = 'Link unavailable'
      } else {
        downloadLink = link('View file', contentURI, {
          fallback: (text, url) => `${text} (${url})`,
        })
      }
    }

    table.push([fileName, fileSize, fileType, dateModified, downloadLink])
  }
  // Print out the table
  if (table.length > 0) {
    this.printInfo(`${table.length} files/folders`)
    console.log(table.toString())
  }
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
exports.printError = (err) => {
  if (err.isAxiosError) {
    if (err.code === 'ECONNRESET') {
      this.print(
        chalk.red.bold(
          'The server abruptly closed the connection. Check your wifi connection. Also check if the server has shut down or try again in a few seconds.'
        )
      )
    }
    if (
      err.response &&
      err.response.data &&
      err.response.data.error &&
      err.response.data.error.message
    ) {
      this.print(chalk.red.bold(err.response.data.error.message))
    } else if (err.status) {
      this.print(chalk.red.bold(`${err.status}: ${err.statusText}`))
    } else {
      this.print(chalk.red.bold(err))
    }
  } else if (err.message) {
    this.print(chalk.red.bold(err.message))
  } else {
    this.print(chalk.red.bold(err))
  }
}

// Exit Dabbu and delete the _dabbu directory
exports.exitDabbu = () => {
  return fs
    .remove(`./_dabbu/_cli/`)
    .then(() => this.printInfo('Removed cache. Exiting..'))
    .finally(() => process.exit(0))
}
