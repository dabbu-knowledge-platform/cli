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

const fs = require("fs-extra")
const ora = require("ora")
const chalk = require("chalk")
const axios = require("axios")
const prompt = require("readcommand")
const express = require("express")
const open = require("open")

const { nanoid } = require("nanoid")

const { get, set, parsePath, printInfo, printBright, printFiles, getExtForMime } = require("./utils")

// The provider config
const providerConfigJSON = require("./provider_config.json").providers

// A helper function to generate the body and headers of a request for
// a provider
function generateBodyAndHeaders(drive) {
  let body = {}
  let headers = {}
  // Get the config for the respective provider ID of the drive
  const providerConfig = providerConfigJSON[get(`drives.${drive}.provider`)]
  // Get a list of variables from the provider config
  let bodyVariables = Object.keys(providerConfig.request.body || {})
  let headerVariables = Object.keys(providerConfig.request.headers || {})

  // Loop through them and get their value
  for (let i = 0, length = bodyVariables.length; i < length; i++) {
    const variable = providerConfig.request.body[bodyVariables[i]]
    body[bodyVariables[i]] = get(`drives.${drive}.${[variable["path"]]}`)
  }

  // Loop through them and get their value
  for (let i = 0, length = headerVariables.length; i < length; i++) {
    const variable = providerConfig.request.headers[headerVariables[i]]
    headers[headerVariables[i]] = get(`drives.${drive}.${[variable["path"]]}`)
  }

  // Return successfully
  return [body, headers]
}

// A helper function to regenerate the access token in case
// it has expired
function refreshAccessToken(drive) {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Get the config for the respective provider ID of the drive
    const providerConfig = providerConfigJSON[get(`drives.${drive}.provider`)]
    // Get a list of variables from the provider config
    let headerVariables = Object.keys(providerConfig.request.headers || {})
    
    // Check if the provider has a authorization field in its headers and auth is enabled
    const authHeaderIndex = headerVariables.indexOf("authorization")
    if (authHeaderIndex !== -1 && providerConfig.auth && providerConfig.auth.process === "oauth2") {
      // Refresh only if the token is expired
      let date = Date.now()
      let expiresAtDate = parseInt(get(`drives.${drive}.${providerConfig.auth.path}.expires_at`))
      if (expiresAtDate > date) {
        // If it has expired, get the auth metadata and the refresh token first
        let refreshToken = get(`drives.${drive}.${providerConfig.auth.path}.refresh_token`)

        // Get the URL to make a POST request to refresh the access token
        const tokenURL = providerConfig.auth.token_uri
        // Make a POST request with the required params
        // Put the params as query params in the URL and in the request
        // body too, Microsoft requires the params as a string in the body
        axios.post(tokenURL,
          // In the body
          `refresh_token=${refreshToken}&client_id=${get(`drives.${drive}.auth_meta.client_id`)}&client_secret=${get(`drives.${drive}.auth_meta.client_secret`)}&redirect_uri=${get(`drives.${drive}.auth_meta.redirect_uri`)}&grant_type=${"refresh_token"}`,
          // In the URL query parameters
          {
            params: {
              refresh_token: refreshToken,
              client_id: get(`drives.${drive}.auth_meta.client_id`),
              client_secret: get(`drives.${drive}.auth_meta.client_secret`),
              redirect_uri: get(`drives.${drive}.auth_meta.redirect_uri`),
              grant_type: "refresh_token"
            }
          }
        )
        .then(res => {
          // Store the access token and update the expiry time
          const {token_type, access_token, expires_in} = res.data
          set(`drives.${drive}.${providerConfig.auth.path}.access_token`, `${token_type || "Bearer"} ${access_token}`)
          set(`drives.${drive}.${providerConfig.auth.path}.expires_at`, (Date.now() + expires_in) * 1000) // Multiply by thousands to keep milliseconds
          // Return successfully
          resolve()
        })
        .catch(reject)
      } else {
        // If it is not expired, return successfully
        resolve()
      }
    } else {
      // If there is no auth required for that provider, return successfully
      resolve()
    }
  })
}

// The Client class
const Client = class {
  constructor() {
    this.ops = {
      "pwd": this.pwd,
      "cd": this.cd,
      "l": this.list,
      "ls": this.list,
      "ll": this.list,
      "cat": this.read,
      "upl": this.create,
      "cp": this.copy,
      "mv": this.move,
      "rm": this.delete,
      "del": this.delete,
      "file": this.info,
    }
  }

  init(drive) {
    // First get the provider, so we can get the related variables
    // from the provider_config.json file
    const provider = get(`drives.${drive}.provider`)
    const providerConfig = providerConfigJSON[provider]

    // Request a variable from the user
    const _reqVariable = (variable) => {
      return new Promise((resolve, reject) => {
        // Get the description, type and path to store the variable
        const varInfo = providerConfig.request.body[variable]
        // Tell the user about the variable
        printInfo(varInfo.description)

        prompt.read({
          ps1: `${varInfo.prompt} > `
        }, (err, args) => {
          // If there is an error, handle it
          if (err) {
            reject(err)
          } else {
            // If there is no error, get the value
            const varVal = args[0]
            // If they haven't entered anything, flag it and ask again
            if (!varVal) {
              printBright(`Please ${varInfo.prompt.toLowerCase()}`)
              _reqVariable(variable)
            } else {
              // Store its value in the config file
              set(`drives.${drive}.${varInfo.path}`, varVal)
              // Return successfully
              resolve()
            }
          }
        })
      })
    }

    // Get the values for all variables in the body and header
    const reqVariables = async () => {
      // Get a list of variables from the provider config
      let variablesFromBody = Object.keys(providerConfig.request.body || {})
      let variablesFromHeaders = Object.keys(providerConfig.request.headers || {})

      // Loop through them and get their value
      for (let i = 0, length = variablesFromBody.length; i < length; i++) {
        const variable = providerConfig.request.body[variablesFromBody[i]]
        // Ask the user for the value only if the user_input_needed flag is explicitly true
        if (variable["user_input_needed"] === true) {
          await _reqVariable(variablesFromBody[i])
        }
      }

      // Loop through them and get their value
      for (let i = 0, length = variablesFromHeaders.length; i < length; i++) {
        const variable = providerConfig.request.headers[variablesFromHeaders[i]]
        // Ask the user for the value only if the user_input_needed flag is explicitly true
        if (variable["user_input_needed"] === true) {
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

        prompt.read({
          ps1: `Enter the client ID you got: > `
        }, (err, args) => {
          // If there is an error, handle it
          if (err) {
            reject(err)
          } else {
            // If there is no error, get the value
            const clientID = args.join(" ")
            // If they haven't entered anything, flag it and ask again
            if (!clientID) {
              printBright("Please enter the client ID.")
              reqClientID()
            } else {
              // Store its value in the config file
              set(`drives.${drive}.auth_meta.redirect_uri`, "http://localhost:8081")
              set(`drives.${drive}.auth_meta.client_id`, clientID)
              // Return successfully
              resolve()
            }
          }
        })
      })
    }

    // Ask for the client secret
    const reqClientSecret = () => {
      return new Promise((resolve, reject) => {
        prompt.read({
          ps1: `Enter the client secret you got: > `
        }, (err, args) => {
          // If there is an error, handle it
          if (err) {
            reject(err)
          } else {
            // If there is no error, get the value
            const clientSecret = args.join(" ")
            // If they haven't entered anything, flag it and ask again
            if (!clientSecret) {
              printBright("Please enter the client secret.")
              reqClientSecret()
            } else {
              // Store its value in the config file
              set(`drives.${drive}.auth_meta.client_secret`, clientSecret)
              // Return successfully
              resolve()
            }
          }
        })
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
        const authUrl = `${providerConfig.auth.auth_uri}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(providerConfig.auth.scopes)}&state=${randomNumber}&include_granted_scopes=true&response_type=code&access_type=offline`
        // Ask the user to go there
        printInfo(`Authorize the app by visting this URL in a browser (if you see a warning "Unsafe site", press Advanced > Go to site (unsafe)) - ${authUrl}`)

        // Once the user finishes the auth process, they will be redirected to localhost:8081
        // We need to setup a server to parse the URL for the code and then get the token
        const app = express()

        // Start the server
        const server = app.listen(8081, null)

        // Once we get the code, return successfully
        // Listen for requests to localhost:8081/
        app.get("/", (req, res) => {
          // Return the code only if there is no error and the state variable matches
          if (req.query.error) {
            res.send(`The following error occurred: ${req.query.error}`)
            server.close()
            reject(req.query.error)
          } else {
            // Take into account that some providers (like microsoft) do not return state
            if (!req.query.state || req.query.state === randomNumber) {
              res.send("Thank you for signing in to Dabbu CLI. You can now continue using it.")
              resolve(req.query.code)
            } else {
              res.send(`The following error occurred: URL state does not match. Please try again.`)
              reject("Error: URL state does not match. Please try again.")
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
        axios.post(tokenURL,
          // In the body
          `code=${code}&client_id=${get(`drives.${drive}.auth_meta.client_id`)}&client_secret=${get(`drives.${drive}.auth_meta.client_secret`)}&redirect_uri=${get(`drives.${drive}.auth_meta.redirect_uri`)}&grant_type=${"authorization_code"}`, 
          // In the URL query parameters
          {
            params: {
              code: code,
              client_id: get(`drives.${drive}.auth_meta.client_id`),
              client_secret: get(`drives.${drive}.auth_meta.client_secret`),
              redirect_uri: get(`drives.${drive}.auth_meta.redirect_uri`),
              grant_type: "authorization_code"
            }
          }
        )
        .then(res => {
          // Get the access token, refresh token and expiry time
          const {access_token, refresh_token, expires_in, token_type} = res.data
          // Store it in config
          set(`drives.${drive}.${providerConfig.auth.path}.access_token`, `${token_type || "Bearer"} ${access_token}`)
          set(`drives.${drive}.${providerConfig.auth.path}.refresh_token`, refresh_token)
          set(`drives.${drive}.${providerConfig.auth.path}.expires_at`, (Date.now() + expires_in) * 1000) // Multiply by thousands to keep milliseconds
          // Return successfully
          resolve()
        })
        .catch(reject) // Pass back the error, if any
      })
    }

    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // First ask for all variables
      return reqVariables()
        .then(() => {
          // Check if there is an auth process
          // Currently only OAuth2 is supported
          if (providerConfig.auth && providerConfig.auth.process === "oauth2") {
            return reqClientID() // Ask user to create a project and get client ID
              .then(reqClientSecret) // Get client secret from the user
              .then(getAuthorization) // Get user consent to access their files/mail
              .then(getToken) // Get an access token and refresh token
              .then(resolve) // Return successfully
              .catch(reject) // Pass back the error, if any
          } else {
            // Else resolve successfully
            return
          }
        })
        .then(resolve) // Return successfully
        .catch(reject) // Pass back the error, if any
    })
  }

  // Show the user their current drive and path
  pwd(args) {
    // Current drive
    const drive = get("current_drive")
    // Print the drive name and path as a promise
    printInfo(`(${get(`drives.${drive}.provider`)}) ${drive}:${get(`drives.${drive}.path`)}`)

    // Return a resolved promise
    return Promise.resolve()
  }

  // Change the user's directory
  cd(args) {
    // The user given relative path
    const inputPath = args[1]
    // The current path in that drive
    const currentPath = get(`drives.${get("current_drive")}.path`) || ""

    // Parse the relative path and get an absolute one
    const finalPath = parsePath(inputPath, currentPath)
    // Set the path
    set(`drives.${get("current_drive")}.path`, finalPath)

    // Return a resolved promise
    return Promise.resolve()
  }

  list(args) {
    // The user input path
    let folderPath = args[1] || "."
    // Parse the relative path and get an absolute one
    folderPath = parsePath(folderPath, get(`drives.${get("current_drive")}.path`))

    // Show a loading indicator
    const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

    // Generate the request body and headers for the provider
    const [body, headers] = generateBodyAndHeaders(get("current_drive"))

    // List out the files and folders
    const makeListRequest = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to send the request to
        let server = get("server")
        let provider = get(`drives.${get("current_drive")}.provider`)
        folderPath = encodeURIComponent(folderPath === "" ? "/" : folderPath)
        const url = `${server}/dabbu/v1/api/data/${provider}/${folderPath}?orderBy=kind&direction=asc&exportType=view`
        // Send a GET request
        axios.get(url, {
          data: body, // The appropriate request body for this provider
          headers: headers // The appropriate headers for this provider
        })
        .then(res => {
          if (res.data.content.length > 0) {
            // Stop loading
            spinner.stop()
            // If there are some files, print them
            printFiles(res.data.content)
            // Return successfully
            resolve()
          } else {
            // Else return null if it is an empty folder
            resolve(null)
          }
        })
        .catch(err => {
          // Stop loading
          spinner.stop()
          // Pass the error back on
          reject(err)
        })
      })
    }

    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // First refresh the access token (if provider requires it and it has expired)
      return refreshAccessToken(get("current_drive"))
        .then(makeListRequest) // Then run the list request
        .then(resolve) // Then return successfully
        .catch(reject) // Else pass the error back on
    })
  }

  read(args) {
    // The user input path
    let filePath = args[1] || "."
    // Get the folder names and file names separately
    let folders = filePath.split("/")
    // Get the file name
    let fileName = folders.pop()
    // If only the file name was specified, set the folders array to have a path 
    // to the present directory
    if (folders.length === 0) {
      folders = ["."]
    }
    // Parse the relative path and get an absolute one
    let folderPath = parsePath(folders.join("/"), get(`drives.${get("current_drive")}.path`))

    // Show a loading indicator
    const spinner = ora(`Fetching ${chalk.blue(fileName)}`).start()

    // Generate the request body and headers for the provider
    const [body, headers] = generateBodyAndHeaders(get("current_drive"))

    // Make a request to the server, fetching data from the server
    const getFileData = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to send the request to
        let server = get("server")
        let provider = get(`drives.${get("current_drive")}.provider`)
        folderPath = encodeURIComponent(folderPath === "" ? "/" : folderPath)
        fileName = encodeURIComponent(fileName)
        const url = `${server}/dabbu/v1/api/data/${provider}/${folderPath}/${fileName}?exportType=media`
        // Send a GET request
        return axios.get(url, {
          data: body,
          headers: headers
        })
        .then(res => {
          if (res.data.content) {
            // If there is a file, download it
            const file = res.data.content
            // If it is a folder, error out
            if (file.kind === "folder") {
              reject(`Cannot download folder ${file.name}`)
            }
            resolve(file)
          } else {
            // Else return false if there is an error
            reject(res.response.data.error)
          }
        })
        .catch(reject)
      })
    }

    // Download the file's data from the content URI
    const downloadFile = (file) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        const url = file.contentURI
        if (file && file.contentURI) {
          // If a content URI is provided, download the file
          axios.get(url, {
            data: body,
            headers: headers,
            responseType: "stream" 
          })
          .then(res => {
            // If there is data, return it
            if (res.data) {
              resolve([file, res.data])
            } else if (res) {
              resolve([file, res])
            } else {
              reject("No data received from file's contentURI")
            }
          })
          .catch(reject) // Pass the error back up, if any
        } else {
          // Else return null
          reject("No such file/folder was found.")
        }
      })
    }

    // Pipe the data to a local file
    const storeFile = async ([file, fileData]) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        if (fileData) {
          // Download the file
          // Path to the file
          let downloadToFilePath = `./.cache/${file.name || file.fileName}`
          downloadToFilePath = `${downloadToFilePath}${getExtForMime(file.mimeType)}`
          // Create the file
          fs.createFile(downloadToFilePath)
          .then(() => {
            // Open a write stream so we can write the data we got to it
            const writer = fs.createWriteStream(downloadToFilePath)
            // Pipe the bytes to the file
            fileData.pipe(writer)
            writer.on("finish", () => {
              // Stop loading
              spinner.stop()
              // Tell the user where the file is stored
              printInfo(`File downloaded ${chalk.keyword("orange")("temporarily")} to ${downloadToFilePath}`)
              // Open it in the default app
              open(downloadToFilePath, { wait: false })
              // Return successfully
              resolve()
            })
            writer.on("error", reject) // Pass the error back on, if any
          })
          .catch(reject)
        } else {
          // Else return null
          resolve("No such file/folder was found.")
        }
      })
    }

    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // First refresh the access token (if provider requires it and it has expired)
      return refreshAccessToken(get("current_drive"))
        .then(getFileData) // Get the file's metadata and content URI from the server
        .then(downloadFile) // Download the file from its content URI
        .then(storeFile)
        .then(resolve) // Return the file paths
        .catch(reject) // Pass back the error, if any
    })
  }

  create(args) {}

  update(args) {}

  copy(args) {}

  move(args) {}

  delete(args) {}
}

// Export the class
module.exports.Client = Client