const fs = require("fs-extra")
const axios = require("axios")
const getUri = require("get-uri")

const FormData = require("form-data")
const Client = require("./client").default

exports.default = class HardDriveClient extends Client {
  constructor() {
    super()
  }

  ls(server, folderPath, vars) {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // The URL to send the request to
      const url = `${server}/dabbu/v1/api/data/hard_drive/${encodeURIComponent(folderPath)}`
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
          resolve(null)
        }
      })
    }

    const storeFile = (fileData) => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        if (fileData) {
          // Download the file
          // Path to the file
          const downloadFilePath = `${__dirname}/../../downloads/${fileName}`
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
          resolve(null)
        }
      })
    }

    // Execute the functions one after the other
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      let promise = Promise.resolve()
      let functions = [getFileData, downloadFile, storeFile]

      functions.forEach(func => {
        promise = promise.then(func).catch(reject)
      })

      resolve(promise)
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