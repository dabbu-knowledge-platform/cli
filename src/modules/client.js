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
const { replaceAll, parsePath, error } = require("../utils.js")

const Table = require("cli-table3")

// MARK: Client

class Client {
  constructor() {}

  // Creates a new instance
  async newInstance() {
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
          const table = new Table({head: [chalk.green("Name"), chalk.green("Size"), chalk.green("Download Link")], colWidths: [30, 10, 40]})
          for (var i = 0, length = files.length; i < length; i++) {
            const file = files[i]
            const contentURI = replaceAll(file.contentURI || "", {" ": "%20"})
            table.push([
              file.kind === "folder" ? chalk.blueBright(file.name) : chalk.magenta(file.name), // File name - blue if folder, magenta if file
              `${!file.size ? "-" : Math.floor(file.size / (1024 * 1024))} MB`, // File size in MB
              link(!contentURI ? "No download link" : `${contentURI.substring(0, 34)}...`, contentURI) // Download link
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
        if (err.response) {
          // Request made and server responded
          error(`An error occurred: ${err.response.data.error.message}`);
        } else if (err.request) {
          // The request was made but no response was received
          error(`An error occurred: No response was received: ${err.message}`);
        } else {
          // Something happened in setting up the request that triggered an Error
          error(`An error occurred while sending the request: ${err.message}`);
        }
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
    return axios.get(url)
      .then(res => {
        if (res.data.content) {
          // If we have a file, print out its info
          const file = res.data.content
          // Append the files to this table and then display them
          const table = new Table({head: [chalk.green("Name"), chalk.green("Size"), chalk.green("Download Link")], colWidths: [30, 10, 40]})
          const contentURI = replaceAll(file.contentURI || "", {" ": "%20"})
          table.push([
            file.kind === "folder" ? chalk.blueBright(file.name) : chalk.magenta(file.name), // File name - blue if folder, magenta if file
            `${!file.size ? "-" : Math.floor(file.size / (1024 * 1024))} MB`, // File size in MB
            link(!contentURI ? "No download link" : `${contentURI.substring(0, 34)}...`, contentURI) // Download link
          ])
          // We got the result, stop loading
          spinner.stop()
          // Print out the table
          console.log(table.toString())
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
          error(`An error occurred: ${err.response.data.error.message}`);
        } else if (err.request) {
          // The request was made but no response was received
          error(`An error occurred: No response was received: ${err.message}`);
        } else {
          // Something happened in setting up the request that triggered an Error
          error(`An error occurred while sending the request: ${err.message}`);
        }
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
        if (err.response) {
          // Request made and server responded
          error(`An error occurred: ${err.response.data.error.message}`);
        } else if (err.request) {
          // The request was made but no response was received
          error(`An error occurred: No response was received: ${err.message}`);
        } else {
          // Something happened in setting up the request that triggered an Error
          error(`An error occurred while sending the request: ${err.message}`);
        }
      })
  }
}

// MARK: Export

// Export the client as the default export
exports.default = Client