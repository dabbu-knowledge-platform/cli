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
const ora = require('ora')
const chalk = require('chalk')
const axios = require('axios')
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
} = require('./utils')

const listRequest = async (drive, folderPath, regex) => {
  // Generate request body and headers
  let [body, headers] = await generateBodyAndHeaders(drive)

  // Get the server address, provider ID and URL encode the folder path
  let server = get('server')
  let provider = get(`drives.${drive}.provider`)
  let encodedFolderPath = encodeURIComponent(
    folderPath === '' ? '/' : folderPath
  )

  // The URL to send the request to
  let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}?exportType=view`
  // Send a GET request
  let res = await axios.get(url, {
    data: body, // The appropriate request body for this provider
    headers: headers, // The appropriate headers for this provider
  })

  // Check if there is a response
  if (res.data.content.length > 0) {
    // Get the files from the response
    let files = res.data.content
    if (regex) {
      // Filter using the regex (if any)
      files = files.filter((file) => {
        return new RegExp(regex).test(file.name)
      })
    }
    // Return the files
    return files
  } else {
    // Else return null if it is an empty folder
    return null
  }
}

const downloadRequest = async (drive, folderPath, fileName) => {
  // The file object (from Dabbu Server), the file data retrieved from its
  // contentURI and the path on the local disk where the file is downloaded
  let file, fileData, localPath
  // Generate request body and headers
  let [body, headers] = await generateBodyAndHeaders(drive)

  // Get the server address, provider ID and URL encode the folder path and file name
  let server = get('server')
  let provider = get(`drives.${drive}.provider`)
  let encodedFolderPath = encodeURIComponent(
    folderPath === '' ? '/' : folderPath
  )
  let encodedFileName = encodeURIComponent(fileName)
  // The URL to send the GET request to
  let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}/${encodedFileName}?exportType=media`
  // Send a GET request
  let res = await axios.get(url, {
    data: body,
    headers: headers,
  })

  // Check if a file was returned
  if (res.data.content) {
    // If there is a file, download it
    file = res.data.content
    // If it is a folder, error out
    if (file.kind === 'folder') {
      throw new Error(`Cannot download folder ${file.name}`)
    }
  } else {
    // Else error out
    throw new Error(`${res.response.data.error.message}`)
  }

  // Download the file's data from the content URI
  url = file.contentURI
  if (file && file.contentURI) {
    // If a content URI is provided, download the file
    // Check if it is a file:// URI
    if (file.contentURI.startsWith('file://')) {
      // If so, parse the file path and fetch that using the get-uri library
      res = fs.createReadStream(
        unescape(file.contentURI).replace('file://', '')
      )
      // If there is data, return it
      if (res) {
        fileData = res
      } else {
        // Else error out
        throw new Error("No data received from file's contentURI")
      }
    } else {
      // Else it is a normal url, fetch it using axios
      // Add the headers and body only if they really are
      // needed, else risk getting a 400 Bad request
      let meta = {}
      if (Object.keys(body || {}).length > 0) {
        meta['data'] = body
      }
      if (Object.keys(headers || {}).length > 0) {
        meta['headers'] = headers
      }
      meta['responseType'] = 'stream'
      res = await axios.get(url, meta)
      // If there is data, return it
      if (res.data) {
        fileData = res.data
      } else if (res) {
        fileData = res
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
    let ext = getExtForMime(file.mimeType)
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
  let [body, headers] = await generateBodyAndHeaders(drive)

  // Get the server address, provider ID and URL encode the folder path
  let server = get('server')
  let provider = get(`drives.${drive}.provider`)
  let encodedFolderPath = encodeURIComponent(
    folderPath === '' ? '/' : folderPath
  )
  let encodedFileName = encodeURIComponent(fileName)

  // Make a form data object to upload the file's contents
  const formData = new FormData()
  // Add the file's data as a readable stream to the content field
  formData.append('content', fs.createReadStream(localPath), {
    filename: fileName,
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
  let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}/${encodedFileName}`
  // Send a POST request
  try {
    let res = await axios.post(url, formData, {
      headers: {
        ...formHeaders, // The form headers
        ...headers, // The provider-specific headers
      },
    })
    if (res.status === 201) {
      // If there is no error, return
      return
    } else {
      // Else error out
      throw new Error(res.data.error.message)
    }
  } catch (err) {
    if (err.code === 409 || err.status === 409) {
      printInfo(`\nOverwriting file ${folderPath}/${fileName}`)
      return await updateRequest(drive, folderPath, fileName)
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
  let [body, headers] = await generateBodyAndHeaders(drive)

  // Get the server address, provider ID and URL encode the folder path
  let server = get('server')
  let provider = get(`drives.${drive}.provider`)
  let encodedFolderPath = encodeURIComponent(
    fromFolderPath === '' ? '/' : fromFolderPath
  )
  let encodedFileName = encodeURIComponent(fromFileName)

  // Add the name and path to the body (only if we want to change it)
  if (toFileName !== fromFileName) {
    body['name'] = toFileName
  }
  if (toFolderPath !== fromFolderPath) {
    body['path'] = toFolderPath
  }

  // The URL to send the request to
  let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}/${encodedFileName}`
  // Send a POST request
  let res = await axios.put(url, body, {
    headers: headers,
  })
  if (res.status === 200) {
    // If there is no error, return
    return
  } else {
    // Else error out
    throw new Error(res.response.data.error.message)
  }
}

const deleteRequest = async (drive, folderPath, fileName, regex) => {
  // Generate request body and headers
  let [body, headers] = await generateBodyAndHeaders(drive)

  // Get the server address, provider ID and URL encode the folder path
  let server = get('server')
  let provider = get(`drives.${drive}.provider`)
  let encodedFolderPath = encodeURIComponent(
    folderPath === '' ? '/' : folderPath
  )

  if (!fileName) {
    if (regex) {
      // The URL to send the request to
      let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}?exportType=view`
      // Send a GET request
      let res = await axios.get(url, {
        data: body, // The appropriate request body for this provider
        headers: headers, // The appropriate headers for this provider
      })

      // Check if there is a response
      if (res.data.content.length > 0) {
        // Get the files from the response
        let files = res.data.content
        if (regex) {
          // Filter using the regex (if any)
          files = files.filter((file) => {
            return new RegExp(regex).test(file.name)
          })
        }

        // Delete the files
        for (let file of files) {
          let encodedFileName = encodeURIComponent(file.name)
          // The URL to send the request to
          let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}/${encodedFileName}`
          // Send a GET request
          let res = await axios.delete(url, {
            data: body, // The appropriate request body for this provider
            headers: headers, // The appropriate headers for this provider
          })
        }

        // Return the number of files deleted
        return files.length
      } else {
        // Else return if it is an empty folder
        return 0
      }
    } else {
      // The URL to send the request to
      let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}`
      // Send a GET request
      let res = await axios.delete(url, {
        data: body, // The appropriate request body for this provider
        headers: headers, // The appropriate headers for this provider
      })
      // Return the number of files deleted
      return files.length
    }
  } else {
    let encodedFileName = encodeURIComponent(fileName)
    // The URL to send the request to
    let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}/${encodedFileName}`
    // Send a GET request
    let res = await axios.delete(url, {
      data: body, // The appropriate request body for this provider
      headers: headers, // The appropriate headers for this provider
    })
    // Return the number of files deleted
    return 1
  }
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
      sync: this.sync,
    }
  }

  async init(drive) {
    // First get the provider, so we can get the related variables
    // from the provider_config.json file
    // The provider config
    let providerConfigJson = await axios.get(
      'https://dabbu-knowledge-platform.github.io/schema/provider_fields.json'
    )
    providerConfigJson = providerConfigJson.data.providers

    const provider = get(`drives.${drive}.provider`)
    const providerConfig = providerConfigJson[provider]

    // Request a variable from the user
    const _reqVariable = (variable) => {
      return new Promise((resolve, reject) => {
        // Get the description, type and path to store the variable
        const varInfo = providerConfig.request.body[variable]
        // Tell the user about the variable
        printInfo(varInfo.description)

        prompt.read(
          {
            ps1: `${varInfo.prompt} > `,
          },
          (err, args) => {
            // If there is an error, handle it
            if (err) {
              reject(err)
            } else {
              // If there is no error, get the value
              const varVal = args[0]
              // If they haven't entered anything, flag it and ask again
              if (!varVal) {
                printBright(`Please ${varInfo.prompt.toLowerCase()}`)
                resolve(_reqVariable(variable))
              } else {
                // Store its value in the config file
                set(`drives.${drive}.${varInfo.path}`, varVal)
                // Return successfully
                resolve()
              }
            }
          }
        )
      })
    }

    // Get the values for all variables in the body and header
    const reqVariables = async () => {
      // Get a list of variables from the provider config
      let variablesFromBody = Object.keys(providerConfig.request.body || {})
      let variablesFromHeaders = Object.keys(
        providerConfig.request.headers || {}
      )

      // Loop through them and get their value
      for (let i = 0, length = variablesFromBody.length; i < length; i++) {
        const variable = providerConfig.request.body[variablesFromBody[i]]
        // Ask the user for the value only if the user_input_needed flag is explicitly true
        if (variable['user_input_needed'] === true) {
          await _reqVariable(variablesFromBody[i])
        }
      }

      // Loop through them and get their value
      for (let i = 0, length = variablesFromHeaders.length; i < length; i++) {
        const variable = providerConfig.request.headers[variablesFromHeaders[i]]
        // Ask the user for the value only if the user_input_needed flag is explicitly true
        if (variable['user_input_needed'] === true) {
          await _reqVariable(variablesFromHeaders[i])
        }
      }

      // Return successfully
      return
    }

    // If the auth process is OAuth2, ask them to setup a project
    // and enter the client ID and secret
    const reqClientID = () => {
      return new Promise((resolve, reject) => {
        // Tell the user what they need to do to setup a project
        printInfo(providerConfig.auth.instructions)

        prompt.read(
          {
            ps1: `Enter the client ID you got: > `,
          },
          (err, args) => {
            // If there is an error, handle it
            if (err) {
              reject(err)
            } else {
              // If there is no error, get the value
              const clientID = args.join(' ')
              // If they haven't entered anything, flag it and ask again
              if (!clientID) {
                printBright('Please enter the client ID.')
                resolve(reqClientID())
              } else {
                // Store its value in the config file
                set(
                  `drives.${drive}.auth_meta.redirect_uri`,
                  'http://localhost:8081'
                )
                set(`drives.${drive}.auth_meta.client_id`, clientID)
                // Return successfully
                resolve()
              }
            }
          }
        )
      })
    }

    // Ask for the client secret
    const reqClientSecret = () => {
      return new Promise((resolve, reject) => {
        prompt.read(
          {
            ps1: `Enter the client secret you got: > `,
          },
          (err, args) => {
            // If there is an error, handle it
            if (err) {
              reject(err)
            } else {
              // If there is no error, get the value
              const clientSecret = args.join(' ')
              // If they haven't entered anything, flag it and ask again
              if (!clientSecret) {
                printBright('Please enter the client secret.')
                resolve(reqClientSecret())
              } else {
                // Store its value in the config file
                set(`drives.${drive}.auth_meta.client_secret`, clientSecret)
                // Return successfully
                resolve()
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
        const clientId = get(`drives.${drive}.auth_meta.client_id`)
        const redirectUri = get(`drives.${drive}.auth_meta.redirect_uri`)
        // The URL
        const authUrl = `${
          providerConfig.auth.auth_uri
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
        app.get('/', (req, res) => {
          // Return the code only if there is no error and the state variable matches
          if (req.query.error) {
            res.send(`The following error occurred: ${req.query.error}`)
            server.close()
            reject(req.query.error)
          } else {
            // Take into account that some providers (like microsoft) do not return state
            if (!req.query.state || req.query.state === randomNumber) {
              res.send(
                'Thank you for signing in to Dabbu CLI. You can now continue using it.'
              )
              resolve(req.query.code)
            } else {
              res.send(
                `The following error occurred: URL state does not match. Please try again.`
              )
              reject('Error: URL state does not match. Please try again.')
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
        const tokenURL = providerConfig.auth.token_uri
        // Make a POST request with the required params
        // Put the params as query params in the URL and in the request
        // body too, Microsoft requires the params as a string in the body
        axios
          .post(
            tokenURL,
            // In the body
            `code=${code}&client_id=${get(
              `drives.${drive}.auth_meta.client_id`
            )}&client_secret=${get(
              `drives.${drive}.auth_meta.client_secret`
            )}&redirect_uri=${get(
              `drives.${drive}.auth_meta.redirect_uri`
            )}&grant_type=${'authorization_code'}`,
            // In the URL query parameters
            {
              params: {
                code: code,
                client_id: get(`drives.${drive}.auth_meta.client_id`),
                client_secret: get(`drives.${drive}.auth_meta.client_secret`),
                redirect_uri: get(`drives.${drive}.auth_meta.redirect_uri`),
                grant_type: 'authorization_code',
              },
            }
          )
          .then((res) => {
            // Get the access token, refresh token and expiry time
            const {
              access_token,
              refresh_token,
              expires_in,
              token_type,
            } = res.data
            // Store it in config
            set(
              `drives.${drive}.${providerConfig.auth.path}.access_token`,
              `${token_type || 'Bearer'} ${access_token}`
            )
            set(
              `drives.${drive}.${providerConfig.auth.path}.refresh_token`,
              refresh_token
            )
            set(
              `drives.${drive}.${providerConfig.auth.path}.expires_at`,
              parseInt(Date.now()) + expires_in * 1000
            ) // Multiply by thousands to keep milliseconds)
            // Return successfully
            resolve()
          })
          .catch(reject) // Pass back the error, if any
      })
    }

    // First ask for all variables
    await reqVariables()
    // Check if there is an auth process
    // Currently only OAuth2 is supported
    if (providerConfig.auth && providerConfig.auth.process === 'oauth2') {
      // Ask user to create a project and get client ID
      await reqClientID()
      // Get client secret from the user
      await reqClientSecret()
      // Get user consent to access their files/mail
      await getAuthorization()
      // Get an access token and refresh token
      await getToken()
      // Return successfully
      return
    } else {
      // Else resolve successfully
      return
    }
  }

  // Show the user their current drive and path
  async pwd(args) {
    // Current drive
    const drive = (args[1] || get('current_drive')).replace(/:/g, '')
    // Print the drive name and path
    printInfo(
      `(${get(`drives.${drive}.provider`)}) ${drive}:${get(
        `drives.${drive}.path`
      )}`
    )

    // Return
    return
  }

  // Change the user's directory
  async cd(args) {
    // The user given relative path
    const inputPath = args[1]
    // The current path in that drive
    const currentPath = get(`drives.${get('current_drive')}.path`) || ''

    // Parse the relative path and get an absolute one
    const finalPath = getAbsolutePath(inputPath, currentPath)
    // Set the path
    set(`drives.${get('current_drive')}.path`, finalPath)

    // Return
    return
  }

  async list(args) {
    // Show a loading indicator
    const spinner = ora(
      `Loading your ${highlight('files and folders')}`
    ).start()

    // Get the path the user entered, default to current directory
    let { drive, folderPath, regex } = await parseUserInputForPath(
      args[1],
      true
    )

    spinner.text = `Loading all files ${highlight(
      regex ? `matching regex ${regex}` : `in folder ${folderPath}`
    )}`

    // Fetch the files from the server
    let files = await listRequest(drive, folderPath, regex)

    // Stop loading
    spinner.stop()
    // Print them out
    if (files) {
      printFiles(files)
    } else {
      printBright('Folder is empty')
    }

    // Return successfully
    return
  }

  async read(args) {
    // Show a loading indicator
    const spinner = ora(
      `Loading your ${highlight('files and folders')}`
    ).start()

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
      folderPath = folderPath.slice(0, folderPath - 1).join('/')
    }

    spinner.text = `Fetching file ${highlight(fileName)}`

    // Fetch the files from the server
    let localPath = await downloadRequest(drive, folderPath, fileName)

    // Stop loading
    spinner.stop()
    // Tell the user where the file is stored
    printInfo(`File downloaded ${highlight('temporarily')} to ${localPath}`)
    // Open it in the default app
    open(localPath, { wait: false })

    // Return successfully
    return
  }

  async copy(args) {
    // Show a loading indicator
    const spinner = ora(
      `Copying your ${highlight('files and folders')}`
    ).start()

    // Get the path the user entered (the file(s) to copy)
    let {
      drive: fromDrive,
      folderPath: fromFolderPath,
      regex: fromRegex,
    } = await parseUserInputForPath(args[1], true)
    // Get the file name from the folder path
    let fromFileName = fromFolderPath.split('/')
    fromFileName =
      // If the path ends with a /, it is a folder
      fromFileName[fromFileName.length - 1] === ''
        ? null
        : fromFileName[fromFileName.length - 1]
    // If there is a file name, remove it from the folder path
    if (fromFileName) {
      fromFolderPath = fromFolderPath.split('/')
      fromFolderPath = fromFolderPath.slice(0, fromFolderPath - 1).join('/')
    }
    // Get the path the user entered (the target to copy to)
    let {
      drive: toDrive,
      folderPath: toFolderPath,
    } = await parseUserInputForPath(args[2], false)
    // Get the file name from the folder path
    let toFileName = toFolderPath.split('/')
    toFileName =
      // If the path ends with a /, it is a folder
      toFileName[toFileName.length - 1] === ''
        ? null
        : toFileName[toFileName.length - 1]
    // If there is a file name, remove it from the folder path
    if (toFileName) {
      toFolderPath = toFolderPath.split('/')
      toFolderPath = toFolderPath.slice(0, toFolderPath - 1).join('/')
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
          let file = files[i]

          // Update the spinner
          spinner.text = `Copying file ${fromFolderPath}/${file.name} to ${toFolderPath}/${file.name}`

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
            let localPath = await downloadRequest(
              fromDrive,
              fromFolderPath,
              file.name
            )
            // Upload the file
            let res = await uploadRequest(
              toDrive,
              toFolderPath,
              file.name,
              localPath
            )

            // Increase the number of files copied
            copiedFilesCount++

            // Tell the user
            spinner.stop()
            printInfo(
              `Copied file ${fromFolderPath}/${file.name} to ${toFolderPath}/${file.name}`
            )
            spinner.start()
          } catch (err) {
            // Increase the error count
            erroredFilesCount++
            // Print the error, but continue
            spinner.stop()
            printError(err)
            spinner.start()
          }
        }
        // Stop loading, we are done
        spinner.stop()
        // Tell the user the number of files we copied and skipped
        printInfo(
          `Copied ${highlight(
            copiedFilesCount
          )} files successfully, ${highlight(
            erroredFilesCount
          )} skipped due to errors`
        )
        // Return succesfully
        return
      } else {
        // Stop loading, error out
        spinner.stop()
        throw new Error('No files matched that regex')
      }
    } else {
      // Surround in a try catch to stop spinner when an error is thrown
      try {
        // Update the spinner
        spinner.text = `Copying file ${fromFolderPath}/${fromFileName} to ${toFolderPath}/${
          toFileName || fromFileName
        }`

        // Fetch the file
        let localPath = await downloadRequest(
          fromDrive,
          fromFolderPath,
          fromFileName
        )
        // Upload the file
        let res = await uploadRequest(
          toDrive,
          toFolderPath,
          toFileName || fromFileName,
          localPath
        )
        // Tell the user
        spinner.stop()
        printInfo(
          `Copied file ${fromFolderPath}/${fromFileName} to ${toFolderPath}/${
            toFileName || fromFileName
          }`
        )
      } catch (err) {
        spinner.stop()
        throw err
      }
    }

    // Return successfully
    return
  }

  async move(args) {
    // Show a loading indicator
    const spinner = ora(`Moving your ${highlight('files and folders')}`).start()

    // Get the path the user entered (the file(s) to move)
    let {
      drive: fromDrive,
      folderPath: fromFolderPath,
      regex: fromRegex,
    } = await parseUserInputForPath(args[1], true)
    // Get the file name from the folder path
    let fromFileName = fromFolderPath.split('/')
    fromFileName =
      // If the path ends with a /, it is a folder
      fromFileName[fromFileName.length - 1] === ''
        ? null
        : fromFileName[fromFileName.length - 1]
    // If there is a file name, remove it from the folder path
    if (fromFileName) {
      fromFolderPath = fromFolderPath.split('/')
      fromFolderPath = fromFolderPath.slice(0, fromFolderPath - 1).join('/')
    }
    // Get the path the user entered (the target to move to)
    let {
      drive: toDrive,
      folderPath: toFolderPath,
    } = await parseUserInputForPath(args[2], false)
    // Get the file name from the folder path
    let toFileName = toFolderPath.split('/')
    toFileName =
      // If the path ends with a /, it is a folder
      toFileName[toFileName.length - 1] === ''
        ? null
        : toFileName[toFileName.length - 1]
    // If there is a file name, remove it from the folder path
    if (toFileName) {
      toFolderPath = toFolderPath.split('/')
      toFolderPath = toFolderPath.slice(0, toFolderPath - 1).join('/')
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
          let file = files[i]

          // Update the spinner
          spinner.text = `Moving file ${fromFolderPath}/${
            fromFileName || file.name
          } to ${toFolderPath}/${fromFileName || file.name}`

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
              let res = await updateRequest(
                fromDrive,
                fromFolderPath,
                file.name,
                toFolderPath,
                file.name
              )
              // Increase the moved files count
              movedFilesCount++
              // Tell the user
              spinner.stop()
              printInfo(
                `Moved file ${fromFolderPath}/${file.name} to ${toFolderPath}/${file.name}`
              )
              spinner.start()
            } catch (err) {
              // Increase the error count
              erroredFilesCount++
              // Print the error, but continue
              spinner.stop()
              printError(err)
              spinner.start()
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
              let localPath = await downloadRequest(
                fromDrive,
                fromFolderPath,
                file.name
              )
              // Upload the file
              let res = await uploadRequest(
                toDrive,
                toFolderPath,
                file.name,
                localPath
              )
              // Delete the original file
              res = await deleteRequest(fromDrive, fromFolderPath, file.name)
              // Increase the moved files count
              movedFilesCount++
              // Tell the user
              spinner.stop()
              printInfo(
                `Moved file ${fromFolderPath}/${file.name} to ${toFolderPath}/${file.name}`
              )
              spinner.start()
            } catch (err) {
              // Increase the error count
              erroredFilesCount++
              // Print the error, but continue
              spinner.stop()
              printError(err)
              spinner.start()
            }
          }
        }
        // Stop loading, we are done
        spinner.stop()
        // Tell the user the number of files we copied and skipped
        printInfo(
          `Moved ${highlight(movedFilesCount)} files successfully, ${highlight(
            erroredFilesCount
          )} skipped due to errors`
        )
        // Return succesfully
        return
      } else {
        // Stop loading, error out
        spinner.stop()
        throw new Error('No files matched that regex')
      }
    } else {
      // Surround in a try catch to stop spinner when an error is thrown
      try {
        // If the drive is the same, then simply update the file
        if (fromDrive === toDrive) {
          // Update the file
          let res = await updateRequest(
            fromDrive,
            fromFolderPath,
            fromFileName,
            toFolderPath,
            toFileName || fromFileName
          )
          // Tell the user
          spinner.stop()
          printInfo(
            `Moved file ${fromFolderPath}/${fromFileName} to ${toFolderPath}/${
              toFileName || fromFileName
            }`
          )
        } else {
          // Fetch the file
          let localPath = await downloadRequest(
            fromDrive,
            fromFolderPath,
            fromFileName
          )
          // Upload the file
          let res = await uploadRequest(
            toDrive,
            toFolderPath,
            toFileName || fromFileName,
            localPath
          )
          // Tell the user
          spinner.stop()
          printInfo(
            `Moved file ${fromFolderPath}/${fromFileName} to ${toFolderPath}/${
              toFileName || fromFileName
            }`
          )
        }
      } catch (err) {
        spinner.stop()
        throw err
      }
    }

    // Return successfully
    return
  }

  async delete(args) {
    // Show a loading indicator
    const spinner = ora(
      `Loading your ${highlight('files and folders')}`
    ).start()

    // Get the path the user entered, default to current directory
    let { drive, folderPath, regex } = await parseUserInputForPath(
      args[1],
      true
    )
    let fileName = null
    if (!regex) {
      fileName = folderPath.split('/')
      fileName = fileName[fileName.length - 1]
    }

    spinner.text = `Deleting ${
      regex
        ? `all files matching regex ${highlight(regex)}`
        : highlight(`${folderPath}/${fileName || ''}`)
    }`

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
    } catch (err) {
      // Throw the error
      spinner.stop()
      throw err
    }

    // Stop loading
    spinner.stop()
    // Tell the user
    printInfo(
      `Deleted ${
        regex
          ? `${highlight(deletedFilesCount)} files matching regex ${highlight(
              regex
            )}`
          : highlight(`${folderPath}/${fileName ? fileName : ''}`)
      }`
    )
    // Return successfully
    return
  }

  async sync(args) {
    // Show a loading indicator
    const spinner = ora(
      `Listing files in the ${highlight('source and target folders')}`
    ).start()

    // Get the path the user entered, default to current directory (to sync from)
    let {
      drive: fromDrive,
      folderPath: fromFolderPath,
    } = await parseUserInputForPath(args[1], false, true)

    // Get the path the user entered, default to current directory (to sync to)
    let {
      drive: toDrive,
      folderPath: toFolderPath,
    } = await parseUserInputForPath(args[2], false, true)

    spinner.text = `Listing all files in source folder ${chalk.keyword(
      'orange'
    )(`${fromDrive}:${fromFolderPath}`)}`

    // Fetch the files from the server
    let fromFiles = (await listRequest(fromDrive, fromFolderPath)) || []

    spinner.text = `Listing existing files in target folder ${chalk.keyword(
      'orange'
    )(`${toDrive}:${toFolderPath}`)}`

    // Now list all those that exist in the target folder already
    let toFiles
    try {
      toFiles = (await listRequest(toDrive, toFolderPath)) || []
    } catch (err) {
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
    let occurrences = {}

    let count = (key) => {
      occurrences[key.name] = ++occurrences[key.name] || 1
    }
    fromFiles.forEach(count)
    toFiles.forEach(count)

    // Get the ones that appear 2 or more times
    for (const fileName of Object.keys(occurrences)) {
      if (occurrences[fileName] >= 2) {
        // Add it to the final array
        filesToUpdate.push(
          fromFiles.filter((file) => file.name === fileName)[0]
        )
      }
    }

    // Update the files only if needed
    let filesAlreadyUpToDate = []
    filesToUpdate =
      filesToUpdate.length > 0
        ? filesToUpdate
            .map((key) => {
              let existingFile = toFiles.filter(
                (file) => file.name === key.name
              )[0]
              if (existingFile) {
                let existingDate = new Date(existingFile.lastModifiedTime)
                let newDate = new Date(key.lastModifiedTime)
                if (newDate > existingDate) {
                  return key
                } else {
                  filesAlreadyUpToDate += key
                }
              }
              return null
            })
            .filter((file) => file !== null)
        : []

    // Now get those that need to be added
    let filesToAdd = fromFiles.filter((file) => {
      return occurrences[file.name] < 2
    })

    // Keep a count of files updated, created and skipped due to errors
    let updatedFilesCount = 0
    let createdFilesCount = 0
    let erroredFilesCount = 0

    // Function to update files, called individually for the filesToAdd and
    // filesToUpdate arrays so we can keep count of files updated and created
    let processFile = async (fileToSync, updateWhichCount) => {
      spinner.text = `Syncing file ${highlight(
        `${fromDrive}:${fromFolderPath}/${fileToSync.name}`
      )} to ${highlight(`${toDrive}:${toFolderPath}/${fileToSync.name}`)}`

      try {
        // Fetch the file
        let localPath = await downloadRequest(
          fromDrive,
          fromFolderPath,
          fileToSync.name
        )
        // Upload the file
        let res = await uploadRequest(
          toDrive,
          toFolderPath,
          fileToSync.name,
          localPath
        )

        // Increase the number of files updated/created
        if (updateWhichCount === 'update') {
          updatedFilesCount++
        } else if (updateWhichCount === 'create') {
          createdFilesCount++
        }

        // Tell the user
        spinner.stop()
        printInfo(
          `Synced file ${highlight(
            `${fromDrive}:${fromFolderPath}/${fileToSync.name}`
          )} to ${highlight(`${toDrive}:${toFolderPath}/${fileToSync.name}`)}`
        )
        spinner.start()
      } catch (err) {
        // Increase the number of files updated/created
        erroredFilesCount++
        // Print the error and skip the file
        spinner.stop()
        printError(err)
        spinner.start()
      }
    }

    // Update/create all the files needed
    for (const fileToSync of filesToAdd) await processFile(fileToSync, 'create')
    for (const fileToSync of filesToUpdate)
      await processFile(fileToSync, 'update')

    // Stop loading
    spinner.stop()

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

    // Return successfully
    return
  }
}

// Export the class
module.exports.Client = Client
