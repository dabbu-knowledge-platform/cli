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
const axios = require("axios")
const prompt = require("readcommand")
const express = require("express")
const link = require("terminal-link")

const FormData = require("form-data")
const Client = require("./client.js").default
const { get, set, printInfo, printBright } = require("../utils.js")

const path = require("path")

// Helper function to refresh the access token every time it expires
const refreshAccessToken = (name, vars) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Check if our access token has expired
    // Get the last time it was refreshed
    const lastRefreshTime = vars.last_refresh_time
    // Get the expiry time in seconds from the last refresh time
    const expiry = vars.token_expires_in
    // Check if we are overdue
    if (lastRefreshTime + expiry <= Math.floor(Date.now() / 1000)) {
      // If so, refresh the access token
      // Make a POST request to Microsoft's OAuth2 endpoint
      const tokenURL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
      // Send a POST request with the required params in 
      // the request body
      axios.post(tokenURL, `client_id=${get(`drives.${name}.client_id`)}&client_secret=${get(`drives.${name}.client_secret`)}&redirect_uri=${get(`drives.${name}.redirect_uri`)}&refresh_token=${get(`drives.${name}.refresh_token`)}&grant_type=${"refresh_token"}`)
      .then(res => {
        // Store the access token and update the expiry time
        const {access_token, expires_in} = res.data
        set(`drives.${name}.access_token`, access_token)
        set(`drives.${name}.last_refresh_time`, Math.floor(Date.now() / 1000))
        set(`drives.${name}.token_expires_in`, expires_in)
        // Return successfully
        resolve()
      })
      .catch(reject)
    } else {
      resolve()
    }
  })
}

exports.default = class OneDriveClient extends Client {
  constructor() {
    super()
  }

  init(server, name) {
    // Ask them to setup a project and enter the creds they got
    const reqClientID = () => {
      return new Promise((resolve, reject) => {
        // Tell the user what they need to do to setup a project
        printInfo([
          `Open ${link("this", "https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps")} link in a web browser. Then do the following:\n` +
          `  - Click on the "New Registration" button.`,
          `  - Fill in the following text boxes with these values`,
          `    - Name: Dabbu CLI`,
          `    - Type: Web`,
          `    - Accounts: Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)`,
          `    - Redirect URI: http://localhost:8081`,
          `  - Then click on the "Register app" button. Copy the client ID you get and enter it here.`,
          `  - Then go to "APIs permissions" and click on "Add a permission" > "Microsoft Graph API" > "Delegated permissions" > select "Offline access" and "Files.ReadWrite.All". Then click on "Add permission".`,
          `  - Then go to "Certificates and Secrets and create a new secret and set expiry date to "Never". Copy the client secret you get on that webpage and enter it here."`,
        ].join("\n"))

        prompt.read({
          ps1: `Enter the client ID you got: > `
        }, (err, args) => {
          // If there is an error, handle it
          if (err) {
            reject(err)
          } else {
            // If there is no error, get the file path
            const client_id = args[0]
            // If they haven't entered anything, flag it and ask again
            if (!client_id) {
              printBright("Please enter the client ID.")
              reqClientID()
            } else {
              // Store the data in the config file
              set(`drives.${name}.redirect_uri`, "http://localhost:8081")
              set(`drives.${name}.client_id`, client_id)
              // Return successfully
              resolve()
            }
          }
        })
      })
    }

    // Ask them to enter the client secret they got
    const reqClientSecret = () => {
      return new Promise((resolve, reject) => {
        prompt.read({
          ps1: `Enter the client secret you got: > `
        }, (err, args) => {
          // If there is an error, handle it
          if (err) {
            reject(err)
          } else {
            // If there is no error, get the file path
            const client_secret = args[0]
            // If they haven't entered anything, flag it and ask again
            if (!client_secret) {
              printBright("Please enter the client secret.")
              reqClientID()
            } else {
              // Parse it and store the data in the config file
              set(`drives.${name}.client_secret`, client_secret)
              // Return successfully
              resolve()
            }
          }
        })
      })
    }

    const reqAuthorizationCode = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // Construct the URL to send the user to
        // The client ID and redirect URI (required in the URL)
        const clientId = get(`drives.${name}.client_id`)
        const redirectUri = get(`drives.${name}.redirect_uri`)
        // The URL
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&scope=offline_access%20https%3A//graph.microsoft.com/Files.ReadWrite.All&response_type=code&redirect_uri=${redirectUri}`
        // Ask the user to go there
        printInfo(`Authorize the app by visting this URL in a browser - ${authUrl}`)

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
            res.send(`The following error occurred: ${req.query.error_description}`)
            server.close()
            reject(req.query.error_description)
          } else {
            res.send("Thank you for signing in to Dabbu CLI. You can now continue using it.")
            server.close()
            resolve(req.query.code)
          }
        })
      })
    }

    // Get an access token and a refresh token from Google
    const getToken = (code) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to make a POST request to 
        const tokenURL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
        // Make a POST request with the required params in the 
        // request body
        axios.post(tokenURL, `code=${code}&client_id=${get(`drives.${name}.client_id`)}&client_secret=${get(`drives.${name}.client_secret`)}&redirect_uri=${get(`drives.${name}.redirect_uri`)}&grant_type=authorization_code`)
        .then(res => {
          // Get the access token, refresh token and expiry time
          const {access_token, refresh_token, expires_in} = res.data
          // Store it in config
          set(`drives.${name}.access_token`, access_token)
          set(`drives.${name}.refresh_token`, refresh_token)
          set(`drives.${name}.last_refresh_time`, Math.floor(Date.now() / 1000))
          set(`drives.${name}.token_expires_in`, expires_in)
          // Return successfully
          resolve()
        })
        .catch(reject) // Pass back the error, if any
      })
    }


    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Ask the user to setup a project and enter the client ID and secret
      reqClientID()
      .then(reqClientSecret)
      .then(reqAuthorizationCode) // Ask the user to give Dabbu access to Microsoft OneDrive
      .then(getToken) // Get an access and refresh token from Microsoft
      .then(resolve) // Return successfully
      .catch(reject) // Pass back the error, if any
    })
  }

  ls(server, name, folderPath, vars) {
    // First get the access token, then run the actual function
    const _getAccessToken = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        refreshAccessToken(name, vars)
        .then(() => resolve(get(`drives.${name}.access_token`))).catch(reject)
      })
    }

    // List the files
    const _ls = (accessToken) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to send the request to
        const url = `${server}/dabbu/v1/api/data/one_drive/${encodeURIComponent(folderPath)}?orderBy=kind&direction=asc&exportType=view`
        // Send a GET request
        axios.get(url, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        .then(res => {
          if (res.data.content.length > 0) {
            // If there are some files, return them
            let files = res.data.content
            // If the folder is the root folder, add the shared 
            // directory to the list of files and folders
            if (folderPath === "/") {
              files.push({
                name: "Shared",
                kind: "folder",
                path: "/Shared",
                mimeType: "inode/directory",
                size: NaN,
                createdAtTime: NaN,
                lastModifiedTime: NaN,
                contentURI: "https://onedrive.live.com/?id=root&qt=sharedby"
              })
            }
            resolve(files)
          } else {
            // Else return null if it is an empty folder
            resolve(null)
          }
        })
        .catch(err => {
          // If there is a network error, resolve with nothing
          if (err.response && err.response.data 
            && err.response.data.error
            && err.response.data.error.message 
            && err.response.data.error.message.includes("getaddrinfo ENOTFOUND www.googleapis.com")) {
              reject("Network error. Cannot reach Google servers.")
          } else {
            // Else pass the error back on
            reject(err)
          }
        })
      })
    }

    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      _getAccessToken() // Get the latest access token
      .then(_ls) // List out the files
      .then(resolve) // Return successfully
      .catch(reject) // Pass back the error, if any
    })
  }

  cat(server, name, folderPath, fileName, vars) {
    // First get the access token, then run the actual function
    const _getAccessToken = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        refreshAccessToken(name, vars)
        .then(() => resolve(get(`drives.${name}.access_token`))).catch(reject)
      })
    }

    const getFileData = (accessToken) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to send the request to
        const url = `${server}/dabbu/v1/api/data/one_drive/${encodeURIComponent(folderPath)}/${encodeURIComponent(fileName)}?exportType=media`
        // Send a GET request
        return axios.get(url, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
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

    const downloadFile = (file) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        const url = file.contentURI
        if (file && file.contentURI) {
          // If a content URI is provided, download the file
          axios.get(url, {
            responseType: "stream"
          })
          .then(res => {
            // If there is data, return it
            if (res.data) {
              resolve(res.data)
            } else {
              reject(res)
            }
          })
          .catch(reject) // Pass the error back up, if any
        } else {
          // Else return null
          resolve("No such file/folder was found.")
        }
      })
    }

    const storeFile = (fileData) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        if (fileData) {
          // Download the file
          // Path to the file
          const downloadFilePath = path.normalize(`${__dirname}/../../.cache/${fileName}`)
          // Create the file
          fs.createFile(downloadFilePath)
          .then(() => {
            // Open a write stream so we can write the data we got to it
            const writer = fs.createWriteStream(downloadFilePath)
            // Pipe the bytes to the file
            fileData.pipe(writer)
            writer.on('finish', () => {
              // Return the file path
              resolve([downloadFilePath])
            })
            writer.on('error', reject) // Pass the error back on, if any
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
      _getAccessToken()
      .then(getFileData) // Get the file's metadata and content URI from the server
      .then(downloadFile) // Download the file from its content URI
      .then(storeFile) // Store the file's contents in a .cache directory
      .then(resolve) // Return the file paths
      .catch(reject) // Pass back the error, if any
    })
  }

  upl(server, name, folderPath, fileName, vars) {
    // First get the access token, then run the actual function
    const _getAccessToken = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        refreshAccessToken(name, vars)
        .then(() => resolve(get(`drives.${name}.access_token`))).catch(reject)
      })
    }

    const _upl = (accessToken) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // First read the file
        fs.readFile(vars.downloadedFilePath)
        .then(fileData => {
          // Make a form data object to upload the file's contents
          const formData = new FormData()
          // Add it to the content field
          formData.append("content", fileData, { filename: vars.downloadedFilePath.split("/").pop() })

          // Use the headers that the form-data modules sets
          const formHeaders = formData.getHeaders()

          // The URL to send the request to
          const url = `${server}/dabbu/v1/api/data/one_drive/${encodeURIComponent(folderPath)}/${encodeURIComponent(fileName)}`
          // Send a POST request
          axios.post(url, formData, {
            headers: {
              ...formHeaders,
              "Authorization": `Bearer ${accessToken}`
            } 
          })
          .then(res => {
            if (res.status === 200) {
              // If there is no error, return true
              resolve(true)
            } else {
              // Else return false if there is an error
              reject(res.response.data.error)
            }
          })
          .catch(reject) // Pass error back if any
        })
      })
    }

    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      _getAccessToken() // Get the latest access token
      .then(_upl) // Upload the files
      .then(resolve) // Return successfully
      .catch(reject) // Pass back the error, if any
    })
  }

  rm(server, name, folderPath, fileName, vars) {
    // First get the access token, then run the actual function
    const _getAccessToken = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        refreshAccessToken(name, vars)
        .then(() => resolve(get(`drives.${name}.access_token`))).catch(reject)
      })
    }

    const _rm = (accessToken) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to send the request to
        const url = `${server}/dabbu/v1/api/data/one_drive/${encodeURIComponent(folderPath)}/${fileName ? encodeURIComponent(fileName) : ""}`
        // Send a DELETE request
        axios.delete(url, { 
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        .then(res => {
          if (res.status === 200) {
            // If there is no error, return true
            resolve(true)
          } else {
            // Else return false if there is an error
            resolve(false)
          }
        })
        .catch(reject) // Pass error back if any
      })
    }

    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      _getAccessToken() // Get the latest access token
      .then(_rm) // Delete the file/folder
      .then(resolve) // Return successfully
      .catch(reject) // Pass back the error, if any
    })
  }
}
