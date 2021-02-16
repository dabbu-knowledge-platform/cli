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
const { nanoid } = require("nanoid")

const FormData = require("form-data")
const Client = require("./client").default
const { get, set, printInfo, printBright } = require("../utils.js")

const path = require("path")

// Helper function to add the appropriate extension to the file if 
// it is a Google Workspace file (Google Doc/Sheet/Slide/App Script, etc)
const appendExtToFileName = (fileName, mimeType) => {
  let ext
  if (mimeType === "application/vnd.google-apps.document") {
    // Google Docs ---> Microsoft Word (docx)
    ext = ".docx"
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    // Google Sheets ---> Microsoft Excel (xlsx)
    ext = ".xlsx"
  } else if (mimeType === "application/vnd.google-apps.presentation") {
    // Google Slides ---> Microsoft Power Point (pptx)
    ext = ".pptx"
  } else if (mimeType === "application/vnd.google-apps.drawing") {
    // Google Drawing ---> PNG Image (png)
    ext = ".png"
  } else if (mimeType === "application/vnd.google-apps.script+json") {
    // Google App Script ---> JSON (json)
    ext = ".json"
  } else {
    ext = ""
  }

  return `${fileName}${ext}`
}

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
      // Make a POST request to Google's OAuth2 endpoint
      const tokenURL = "https://oauth2.googleapis.com/token"
      // Send a POST request
      axios.post(tokenURL, null, {
        params: {
          // Pass the client ID, client secret and refresh token to ask for an access token
          client_id: get(`drives.${name}.client_id`),
          client_secret: get(`drives.${name}.client_secret`),
          refresh_token: get(`drives.${name}.refresh_token`),
          grant_type: "refresh_token" // This tell Google to find the refresh token in the URL params, it does NOT mean return a refresh token
        }
      })
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

exports.default = class GmailClient extends Client {
  constructor() {
    super()
  }

  init(server, name) {
    // Ask them to setup a project and enter the path to the creds file they download
    const reqCredFilePath = () => {
      return new Promise((resolve, reject) => {
        // Tell the user what they need to do to setup a project
        printInfo([
          `Open ${link("this", "https://developers.google.com/gmail/api/quickstart/nodejs#step_1_turn_on_the")} link in a web browser. Then follow these steps:\n` +
          `  - Click on the blue "Enable Gmail API" button`,
          `  - Fill in the following text boxes with these values`,
          `    - Name: Dabbu CLI`,
          `    - Type: Web Server`,
          `    - Redirect URI: http://localhost:8081`,
          `  - Click the blue "Download Client Configuration" button and save the file somewhere safe`,
        ].join("\n"))

        prompt.read({
          ps1: `Enter the path to the file you downloaded: > `
        }, (err, args) => {
          // If there is an error, handle it
          if (err) {
            reject(err)
          } else {
            // If there is no error, get the file path
            const credFilePath = args[0]
            // If they haven't entered anything, flag it and ask again
            if (!credFilePath) {
              printBright("Please enter the path to the file you just downloaded.")
              reqCredFilePath()
            } else {
              // Parse it and store the data in the config file
              fs.readFile(credFilePath)
              .then(fileData => {
                // Get the credentials
                const credentials = JSON.parse(fileData)
                // Get the client secret, ID and redirect URI
                const {client_secret, client_id, redirect_uris} = credentials.web
                set(`drives.${name}.client_secret`, client_secret)
                set(`drives.${name}.client_id`, client_id)
                set(`drives.${name}.redirect_uri`, redirect_uris[0])
                // Return successfully
                resolve()
              })
            }
          }
        })
      })
    }

    const reqAuthorizationCode = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // Construct the URL to send the user to
        // A random state to prevent CORS attacks
        const randomNumber = nanoid(24)
        // The client ID and redirect URI (required in the URL)
        const clientId = get(`drives.${name}.client_id`)
        const redirectUri = get(`drives.${name}.redirect_uri`)
        // The URL
        // WARNING: This authorization process requests readonly access to the user's mailbox
        // If the API is updated, we will require users to give consent again to gain access to
        // other scopes like sending messages
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https%3A//www.googleapis.com/auth/gmail.readonly&state=${randomNumber}&include_granted_scopes=true&response_type=code&access_type=offline`
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
            res.send(`The following error occurred: ${req.query.error}`)
            server.close()
            reject(req.query.error)
          } else {
            if (req.query.state === randomNumber) {
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

    // Get an access token and a refresh token from Google
    const getToken = (code) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to make a POST request to 
        const tokenURL = "https://oauth2.googleapis.com/token"
        // Make a POST request with the required params
        axios.post(tokenURL, null, {
          params: {
            code: code,
            client_id: get(`drives.${name}.client_id`),
            client_secret: get(`drives.${name}.client_secret`),
            redirect_uri: get(`drives.${name}.redirect_uri`),
            grant_type: "authorization_code"
          }
        })
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
      reqCredFilePath() // Ask the user to setup a project and enter the path to the creds file
      .then(reqAuthorizationCode) // Ask the user to give Dabbu access to Google Drive
      .then(getToken) // Get an access and refresh token from Google
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
        const url = `${server}/dabbu/v1/api/data/gmail/${encodeURIComponent(folderPath)}?orderBy=kind&direction=asc&exportType=view`
        // Send a GET request
        axios.get(url, { 
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        .then(res => {
          if (res.data.content.length > 0) {
            // If there are some files, return them
            resolve(res.data.content)
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
        const url = `${server}/dabbu/v1/api/data/gmail/${encodeURIComponent(folderPath)}/${encodeURIComponent(fileName)}?exportType=media`
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
          // The contentURI contains the message and any attachments
          // First get the JSON data from the data URI
          let data
          try {
            // Parse the URL and get the JSON from it
            data = file.contentURI.split(",").slice(1).join(",")
            // Parse it for JSON
            data = JSON.parse(data)
          } catch (err) {
            reject("Invalid data returned")
          }

          // Get the message
          let message = data.messages
          // Get the individual attachments
          let attachments = data.attachments

          // Return them
          resolve([message, attachments])
        } else {
          // Else return null
          reject("No such file/folder was found.")
        }
      })
    }

    const storeMessage = (message) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        if (message) {
          // Download the file
          // Path to the file
          const downloadFilePath = path.normalize(`${__dirname}/../../.cache/${fileName}.txt`)
          // Create the file
          fs.createFile(downloadFilePath)
          .then(() => {
            // Decode the bytes into a buffer
            const fileData = Buffer.from(message, "base64")
            // Write the message to the file
            fs.writeFile(downloadFilePath, fileData)
            .then(() => {
              // Return the file path
              resolve(downloadFilePath)
            })
            .catch(reject) // Pass the error back on, if any
          })
          .catch(reject)
        } else {
          // Else return null
          reject("No such file/folder was found.")
        }
      })
    }

    const storeAttachment = (attachment) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        if (attachment) {
          // Download the file
          // Path to the file
          const downloadFilePath = path.normalize(`${__dirname}/../../.cache/${attachment.fileName}`)
          // Create the file
          fs.createFile(downloadFilePath)
          .then(() => {
            // Decode the bytes into a buffer
            const fileData = Buffer.from(attachment.data, "base64")
            // Write the message to the file
            return fs.writeFile(downloadFilePath, fileData)
            .then(() => {
              // Return the file path
              resolve(downloadFilePath)
            })
            .catch(reject) // Pass the error back on, if any
          })
          .catch(reject)
        } else {
          // Else return null
          reject("No such file/folder was found.")
        }
      })
    }

    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      _getAccessToken()
      .then(getFileData) // Get the file's metadata and content URI from the server
      .then(downloadFile) // Extract the message and attachments from the content URI
      .then(async ([message, attachments]) => {
        let paths = []
        // Download the message as a file
        paths.push(await storeMessage(message))
        // Download each attachment as a file too
        for (let i = 0, length = attachments.length; i < length; i++) {
          const attachment = attachments[i]
          const filePath = await storeAttachment(attachment)
          paths.push(filePath)
        }
        return paths
      })
      .then(resolve) // Return the file paths
      .catch(reject) // Pass back the error, if any
    })
  }

  upl(server, name, folderPath, fileName, vars) {
    return Promise.reject("Not supported by Dabbu's Gmail provider")
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
        const url = `${server}/dabbu/v1/api/data/gmail/${encodeURIComponent(folderPath)}/${fileName ? encodeURIComponent(fileName) : ""}`
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
