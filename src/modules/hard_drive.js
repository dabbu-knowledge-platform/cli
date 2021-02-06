const fs = require("fs-extra")
const chalk = require("chalk")
const axios = require("axios")
const prompt = require("readcommand")
const getUri = require("get-uri")

const FormData = require("form-data")
const Client = require("./client").default
const { set, printInfo } = require("../utils")

exports.default = class HardDriveClient extends Client {
  constructor() {
    super()
  }

  init(server, name) {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Tell the user about the base path they need to enter
      printInfo([
        "In Dabbu, the root of your drive need not be the root path of your computer.",
        "Each drive can point to any folder on your hard drive. The path to the folder",
        "on your computer is called the base path by Dabbu."
      ].join("\n"))

      // Ask them to enter it
      prompt.read({
        ps1: `Enter your base path for ${name}: ${chalk.gray("default: /")} > `
      }, (err, args) => {        
        // If there is an error, handle it
        if (err) {
          reject(err)
        } else {
          // If there is no error, get the base path
          const basePath = args[0] || "/"
          // Store it in config
          set(`drives.${name}.base_path`, basePath)
          // Return successfully
          resolve()
        }
      })
    })
  }

  ls(server, folderPath, vars) {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // The URL to send the request to
      const url = `${server}/dabbu/v1/api/data/hard_drive/${encodeURIComponent(folderPath)}?exportType=view`
      // Send a GET request
      axios.get(url, { 
        data: {
          // Send the base path along, since the hard drive provider requires it
          base_path: vars.base_path || "/"
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
      .catch(reject) // Pass error back if any
    })
  }

  cat(server, folderPath, fileName, vars) {
    const getFileData = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // The URL to send the request to
        const url = `${server}/dabbu/v1/api/data/hard_drive/${encodeURIComponent(folderPath)}/${encodeURIComponent(fileName)}`
        // Send a GET request
        return axios.get(url, { 
          data: {
            // Send the base path along, since the hard drive provider requires it
            base_path: vars.base_path || "/"
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
        if (file && file.contentURI) {
          // If a content URI is provided, download the file
          resolve(getUri(file.contentURI))
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
          const downloadFilePath = `${__dirname}/../../.cache/${fileName}`
          // Create the file
          fs.createFile(downloadFilePath)
          .then(() => {
            // Open a write stream so we can write the data we got to it
            const writer = fs.createWriteStream(downloadFilePath)
            // Pipe the bytes to the file
            fileData.pipe(writer)
            // Return the file path
            resolve(downloadFilePath)
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
      getFileData() // Get the file's metadata and content URI from the server
      .then(downloadFile) // Download the file from its content URI
      .then(storeFile) // Store the file's contents in a .cache directory
      .then(resolve) // Return the file path
      .catch(reject) // Pass back the error, if any
    })
  }

  upl(server, folderPath, fileName, vars) {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // First read the file
      fs.readFile(vars.downloadedFilePath)
      .then(fileData => {
        // Make a form data object to upload the file's contents
        const formData = new FormData()
        // Send the base path too
        formData.append("base_path", vars.base_path)
        // Add it to the content field
        formData.append("content", fileData, { filename: fileName })

        // Use the headers that the form-data modules sets
        const headers = formData.getHeaders()

        // The URL to send the request to
        const url = `${server}/dabbu/v1/api/data/hard_drive/${encodeURIComponent(folderPath)}/${encodeURIComponent(fileName)}`
        // Send a POST request
        axios.post(url, formData, { headers })
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

  rm(server, folderPath, fileName, vars) {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // The URL to send the request to
      const url = `${server}/dabbu/v1/api/data/hard_drive/${encodeURIComponent(folderPath)}/${fileName ? encodeURIComponent(fileName) : ""}`
      // Send a DELETE request
      axios.delete(url, { 
        data: {
          // Send the base path along, since the hard drive provider requires it
          base_path: vars.base_path || "/"
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
}