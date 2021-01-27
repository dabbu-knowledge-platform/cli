// MARK: Imports

// Colourful text in terminal
const chalk = require("chalk")
// CLI Spinner
const ora = require("ora")
// Hyperlinked text in terminal
const link = require("terminal-link")
// HTTP requests to the Dabbu server
const axios = require("axios")
// Get and set values to and from JSON config
const store = require("data-store")({ path: `${__dirname}/../config/dabbu_cli_config.json` })
// Utility methods
const { replaceAll, parsePath, error, handleError } = require("../utils.js")

const Table = require("cli-table3")

// MARK: Client

class Client {
  constructor() {}

  // Creates a new instance
  newInstance() {
    // Error out, each client needs a separate instantiator
    error("Extend the default Client class at the very least, implement the newInstance method.")
    exit(1)
  }

  // Returns the present working directory
  async pwd() {
    // Return string of format :instanceId/:currentPath, e.g. c:/Documents/Work
    return `${store.get("current_instance_id")}:${store.get(`instances.${store.get("current_instance_id")}.current_path`) || ""}`
  }

  // Move into a directory by saving it in the config
  async cd(input) {
    // Parse the command to get the relative path
    const inputPath = replaceAll(input, {"cd ": "", "cd": "", "//": "/"})
    // Parse the relative path to get an absolute one
    const path = parsePath(store.get(`instances.${store.get("current_instance_id")}.current_path`) || "", inputPath)
    // Save the new path
    return store.set(`instances.${store.get("current_instance_id")}.current_path`, path)
  }

  // List out files and folders by sending an API call to the server
  async ls(input) {
    // Get the ID of the current instance, so we can get the variables from the config file
    const currentInstance = store.get("current_instance_id")

    // Parse the command to get the relative path
    const inputPath = replaceAll(input, {"ls ": "", "ls": "", "//": "/"})
    // Parse the relative path to get an absolute one
    const path = parsePath(store.get(`instances.${currentInstance}.current_path`) || "", inputPath ? inputPath: "")
    // Show a loading indicator
    const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

    // The URL to send the request to
    const url = `${store.get("server_address")}/dabbu/v1/api/data/${encodeURIComponent(store.get("current_provider_id"))}/${encodeURIComponent(path === "" ? "/" : path)}`
    // GET request
    return axios.get(url)
      .then(res => {
        if (res.data.content.length > 0) {
          // If there are some files, loop through them
          const files = res.data.content
          // Append the files to this table and then display them
          const table = new Table({head: [chalk.green("Name"), chalk.green("Size"), chalk.green("Download Link")], colWidths: [null, null, null]})
          for (let i = 0, length = files.length; i < length; i++) {
            const file = files[i]
            const contentURI = replaceAll(file.contentURI || "", {" ": "%20"})
            table.push([
              file.kind === "folder" ? chalk.blueBright(file.name) : chalk.magenta(file.name), // File name - blue if folder, magenta if file
              `${!file.size ? "-" : Math.floor(file.size / (1024 * 1024))} MB`, // File size in MB
              link(!contentURI ? "No download link" : "Click to download", contentURI) // Download link
            ])
          }
          // We got the result, stop loading
          spinner.stop()
          // Print out the table
          console.log(table.toString())
        } else {
          // We have no files, stop loading
          spinner.stop()
          // Tell the user the folder is empty
          error("Folder is empty")
        }
      })
      .catch(err => {
        // We have an error, stop loading
        spinner.stop()
        // Handle it 
        handleError(err)
      })
  }

  // Return a single file's information by sending an API call to the server
  async cat(input) {
    // Get the current instance ID so we can get variables from the config file
    const currentInstance = store.get("current_instance_id")

    // Parse the command for the relative path
    const inputPath = replaceAll(input, {"cat ": "", "cat": "", "//": "/"})
    // Get an array of folder names from the path
    const folderPath = inputPath.split("/")
    // Get the file name
    const fileName = folderPath.pop()
    // Now parse the folder path to get an absolute one
    const path = parsePath(store.get(`instances.${currentInstance}.current_path`) || "", folderPath.join("/"))
    // Show a loading indicator
    const spinner = ora(`Fetching ${chalk.blue(fileName)}`).start()

    // The URL to send a request to
    const url = `${store.get("server_address")}/dabbu/v1/api/data/${encodeURIComponent(store.get("current_provider_id"))}/${encodeURIComponent(path === "" ? "/" : path)}/${encodeURIComponent(fileName)}`
    // GET request
    return instance.get(url)
      .then(res => {
        if (res.data.content) {
          // If we have a file, download it using the content URI
          const file = res.data.content
          // The URL to download it from
          url = file.contentURI
          if (file.contentURI) {
            // If there is a contentURI
            // GET request
            return instance.get(url, { responseType: "stream" })
              .then(async res => {
                if (res.data) {
                  // Download it to the downloads folder
                  const ext = getExtFromMime(file.mimeType)
                  const downloadFilePath = parsePath(__dirname,`../../downloads/${fileName}${ext && fileName.indexOf(ext) === -1 ? `.${ext}` : ""}`)
                  // Create the file
                  await fs.createFile(downloadFilePath)
                  // Open a write stream so we can write the data we got to it
                  const writer = fs.createWriteStream(downloadFilePath)
                  // Pipe the bytes to the file
                  res.data.pipe(writer)
                  return new Promise((resolve, reject) => {
                    writer.on('finish', () => {
                      // Stop loading, we got the file
                      spinner.stop()
                      // Tell them we downloaded it
                      console.log(
                        chalk.yellow(
                          `File download to ${downloadFilePath}`
                        )
                      )
                      // Ask the user if they want to open the download the file
                      ask(new Confirm({
                        "name": "confirm",
                        "message": "Do you want to open it?"
                      }))
                      .then(confirm => {
                        if (confirm) {
                          // Open the file
                          open(downloadFilePath, { wait: false })
                        }
                        // Return from the promise
                        resolve()
                      })
                    })
                    writer.on('error', err => {
                      // Stop loading, we have an error
                      spinner.stop()
                      // Error out
                      error(err)
                      // Don't reject else it will throw an unhandled promise rejection error
                    })
                  })
                } else {
                  // We have no response, stop loading
                  spinner.stop()
                  // Tell the user the server responded with an empty body
                  error("An error occurred: server responded with an empty response body")
                }
              })
              .catch(err => {
                // We have an error, stop loading
                spinner.stop()
                if (err.response) {
                  // Request made and server responded
                  error(`An error occurred: ${err.response.data ? err.response.data.error.message : "Unkown Error"}`)
                } else if (err.request) {
                  // The request was made but no response was received
                  error(`An error occurred: No response was received: ${err.message}`)
                } else {
                  // Something happened in setting up the request that triggered an Error
                  error(`An error occurred while sending the request: ${err.message}`)
                }
              })
          } else {
            spinner.stop()
            error("File/folder couldn't be downloaded, no download link available.")
          }
        } else {
          // We have no response, stop loading
          spinner.stop()
          // Tell the user the server responded with an empty body
          error("An error occurred: server responded with an empty response body")
        }
      })
      .catch(err => {
        // We have an error, stop loading
        spinner.stop()
        // Handle it 
        handleError(err)
      })
  }

  // Copy a file from one location to another
  async cp(input) {
    // Get the current instance ID so we can get variables from the config file
    const currentInstance = store.get("current_instance_id")

    // Parse the command for two relative paths - one to the original file and second to where it should be copied
    const inputPath = replaceAll(input, {"cp ": "", "cp": "", "//": "/"})

    // Check if the required arguments exist
    if (inputPath.split(" ").length < 2) {
      // Else error out
      error("Must have a path to the file to copy and the folder path to copy it to")
      return
    }

    // The path to the file to copy
    const fromFolderPath = inputPath.split(" ")[0]
    // The location to copy it to
    const toFolderPath = inputPath.split(" ")[1]
    // Get the file name
    const fileName = fromFolderPath.split("/").pop()
    // Now parse the folder paths to get absolute ones
    const fromPath = parsePath(store.get(`instances.${currentInstance}.current_path`) || "", fromFolderPath.split("/").slice(0, -1).join("/"))
    const toPath = parsePath(store.get(`instances.${currentInstance}.current_path`) || "", toFolderPath)
    // Show a loading indicator
    const spinner = ora(`Copying ${chalk.blue(fileName)} to ${toPath}`).start()

    // The URL to send the request to
    let url = `${store.get("server_address")}/dabbu/v1/api/data/${encodeURIComponent(store.get("current_provider_id"))}/${encodeURIComponent(fromPath === "" ? "/" : fromPath)}/${encodeURIComponent(fileName)}`
    // GET request
    return axios.get(url)
      .then(async res => {
        if (res.data.content) {
          // If we have a file, download it then upload it again
          const file = res.data.content
          // Get the data as a stream
          const response = await instance.get(file.contentURI, { responseType: "stream" })
          // To upload the data as a file, we need to store it in a file first
          // Path to the file
          const downloadFilePath = parsePath(__dirname,`../../downloads/${fileName}`)
          // Create the file
          await fs.createFile(downloadFilePath)
          // Open a write stream so we can write the data we got to it
          const writer = fs.createWriteStream(downloadFilePath)
          // Pipe the bytes to the file
          response.data.pipe(writer)
          // Now upload it as form data
          const formData = new FormData()
          // Add it to the content field
          formData.append("content", fs.createReadStream(downloadFilePath), { filename: fileName })

          // Use the headers that the form-data modules sets
          const headers = formData.getHeaders()

          // POST request
          url = `${store.get("server_address")}/dabbu/v1/api/data/${encodeURIComponent(store.get("current_provider_id"))}/${encodeURIComponent(toPath === "" ? "/" : toPath)}/${encodeURIComponent(fileName)}`
          return axios.post(url, formData, { headers })
          .then(res => {
            // We have the result, stop loading
            spinner.stop()
            console.log(
              chalk.yellow(
                `Copied ${chalk.blue(fileName)} to ${toPath}`
              )
            )
          })
          .catch(err => {
            // We have an error, stop loading
            spinner.stop()
            if (err.response) {
              // Request made and server responded
              error(`An error occurred while moving the file: ${err.response.data ? err.response.data.error.message : "Unkown Error"}`)
            } else if (err.request) {
              // The request was made but no response was received
              error(`An error occurred: No response was received: ${err.message}`)
            } else {
              // Something happened in setting up the request that triggered an Error
              error(`An error occurred while sending the request: ${err.message}`)
            }
          })
        } else {
          // We have no response, stop loading
          spinner.stop()
          // Tell the user the server responded with an empty body
          error("An error occurred: server responded with an empty response body")
        }
      })
      .catch(err => {
        // We have an error, stop loading
        spinner.stop()
        // Handle it 
        handleError(err)
      })
  }

  // Delete a file by sending an API call to the server
  async rm(input) {
    // Get the current instance ID so we can get variables from the config file
    const currentInstance = store.get("current_instance_id")

    // Parse the command for the relative path
    const inputPath = replaceAll(input, {"rm ": "", "rm": "", "//": "/"})
    // Get an array of folder names from the path
    const folderPath = inputPath.split("/")
    // Get the file name
    const fileName = folderPath.pop()
    // Now parse the folder path to get an absolute one
    const path = parsePath(store.get(`instances.${currentInstance}.current_path`) || "", folderPath.join("/"))
    // Show a loading indicator
    const spinner = ora(`Deleting ${chalk.blue(fileName)}`).start()

    // The URL to send a DELETE request to
    const url = `${store.get("server_address")}/dabbu/v1/api/data/${encodeURIComponent(store.get("current_provider_id"))}/${encodeURIComponent(path === "" ? "/" : path)}/${encodeURIComponent(fileName)}`
    // DELETE request
    return axios.delete(url)
      .then(res => {
        // Done, stop loading
        spinner.stop()
        // Tell the user
        console.log(`File ${fileName} was deleted successfully`)
      })
      .catch(err => {
        // We have an error, stop loading
        spinner.stop()
        // Handle it 
        handleError(err)
      })
  }
}

// MARK: Export

// Export the client as the default export
exports.default = Client