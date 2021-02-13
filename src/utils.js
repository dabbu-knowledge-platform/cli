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
const link = require("terminal-link")
const chalk = require("chalk")
const figlet = require("figlet")

const config = require("data-store")({ path: `${__dirname}/config/dabbu_cli_config.json` })

const Table = require("cli-table3")

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
  if (err.code === "SIGINT") {
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

// Return an absolute path based on the current path in
// the drive and the user-entered path
exports.parsePath = (inputPath, currentPath) => {
  // If there is no path given, or the path is /, return 
  // nothing (which means /)
  if (!inputPath || inputPath === "/") {
    return ""
  }
  
  // Split the path by / and get an array of folders
  const folders = inputPath.split("/")
  // The final path should begin with the current path 
  // only if the user hasn't mentioned an absolute path
  let finalPath = inputPath.startsWith("/") ? ["/"] : currentPath.split("/")

  // Loop through the input path
  for (let i = 0, length = folders.length; i < length; i++) {
    // Get the folder
    const folder = folders[i]
    if (folder === ".") {
      // Do nothing if the folder is . (meaning current directory)
      continue
    } else if (folder === "..") {
      // Go back one folder if the path is ..
      finalPath.pop()
    } else {
      // Else add the folder to the path
      finalPath.push(folder)
    }
  }

  // Return the path, joined by /s and replace any duplicate slash
  return finalPath.join("/")
    .replace(/\/\/\/\//g, "/")
    .replace(/\/\/\//g, "/")
    .replace(/\/\//g, "/")
}

// Remove any duplicates (and the original too) from an array
exports.removeOriginalAndDuplicates = (array) => {
  return array.filter((item, pos) => {
    return array.lastIndexOf(item) == array.indexOf(item)
  })
}

// Convert a file size in bytes to a human readable format (with units)
// Copied from here - https://stackoverflow.com/a/20732091
exports.getHumanReadableFileSize = (fileSize) => {
  const thresh = 1024

  if (Math.abs(fileSize) < thresh) {
    return fileSize + " B"
  }

  const units = ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
  let unitIndex = -1
  const decimalsToKeep = 2

  do {
    fileSize /= thresh
    ++unitIndex
  } while (Math.round(Math.abs(fileSize) * (10 ** decimalsToKeep)) / (10 ** decimalsToKeep) >= thresh && unitIndex < units.length - 1)

  return fileSize.toFixed(decimalsToKeep) + " " + units[unitIndex]
}

// Display a set of files in a tabular format
exports.printFiles = (files, printFullPath = false) => {
  // Append the files to a table and then display them
  const table = new Table({head: [chalk.green("Name"), chalk.green("Size"), chalk.green("Type"), chalk.green("Last modified"), chalk.green("Action(s)")], colWidths: [null, null, null, null, null]})
  for (let i = 0, length = files.length; i < length; i++) {
    const file = files[i]

    // File name - blue if folder, magenta if file
    const name = printFullPath ? file.path : file.name
    const fileName = file.kind === "folder" ? `${chalk.blueBright(name)} (folder)` : chalk.magenta(name)
    // File size in a human readable unit
    const fileSize = !file.size || file.kind === "folder" ? "-" : this.getHumanReadableFileSize(file.size)
    // Mime type of file
    const fileType = file.mimeType
    // Last modified time
    let dateModified = new Date(file.lastModifiedTime).toLocaleDateString("en-in", {hour: "numeric", minute: "numeric"})
    if (dateModified === "Invalid Date") {
      dateModified = "-"
    }
    // Download link
    const contentURI = file.contentURI
    // Convert to hyper link and then display it
    let downloadLink
    if (file.kind === "folder") {
      if (!contentURI) {
        downloadLink = "Link unavailable"
      } else {
        downloadLink = link("View folder", contentURI, {fallback: (text, url) => `${text} (${url})`})
      }
    } else {
      if (!contentURI) {
        downloadLink = "Link unavailable"
      } else {
        downloadLink = link("View file", contentURI, {fallback: (text, url) => `${text} (${url})`})
      }
    }

    table.push([
      fileName, 
      fileSize,
      fileType,
      dateModified,
      downloadLink
    ])
  }
  // Print out the table
  if (table.length > 0) {
    console.log(table.toString())
  }
}

// Recursively search and print files
exports.listFilesRecursively = (folder, dataModule, drive, driveVars, spinner) => {
  // Tell the user which folder we are querying
  spinner.start()
  spinner.text = `Listing files in ${chalk.blue(folder)}`
  // An array to hold all the files whose names contain any 
  // one of the search terms
  let matchingFiles = []
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Call the module's list function
    dataModule.ls(this.get("server"), drive, folder, driveVars)
      .then(list => {
        if (list) {
          // First get all of the files not folders (we do !=== folder)
          // as we might have the "file" and "other" types
          let filesOnlyList = list.filter((item, pos) => {
            return item.kind !== "folder"
          })

          // Print them out
          // Stop the spinner while we are printing
          spinner.stop()
          
          // Print the folder name
          this.printInfo(folder)
          // Print the files (with the full path)
          this.printFiles(filesOnlyList, true)

          // Start the spinner
          spinner.start()

          // Add the files to matches as well
          matchingFiles = matchingFiles.concat(filesOnlyList)

          // Now recurse through the remaining folders
          let i = 0
          // Create a function that will walk through the directories
          const next = () => {
            // Current file
            var file = list[i++]
            // If there is no such file, return all the matching 
            // files found so far (we've reached the end)
            if (!file) {
              return resolve(matchingFiles)
            }
            if (file.kind === "folder") {
              // If it's a folder, then call the listFilesRecursively method again
              // with the folder path
              this.listFilesRecursively(file.path, dataModule, drive, driveVars, spinner)
                .then(files => matchingFiles = matchingFiles.concat(files))
                .then(() => next())
            } else {
              // We have already printed and added these files to the array, 
              // so continue
              next()
            }
          }

          // Start the chain
          next()
        } else {
          resolve([])
        }
      })
      .catch(reject) // Pass the error back on
  })
}

exports.handlePipe = (command, files, drive, driveVars) => {
  const splitCommand = command.split("|")
  if (splitCommand.length >= 2) {
    // The part after the |
    const pipedCommand = splitCommand[1]
        .split(" ")
        .filter(val => val !== "" && val !== null && val !== undefined)
    
    if (pipedCommand[0] === "cp") {
      // This list of files should be referenced by this name
      let clipName
      // If not specified, take the name as default
      if (pipedCommand.length === 1) 
        clipName = "default"
      else
        clipName = pipedCommand[1]
      
      // Store the clip
      set(`clips.${clipName}.files`, files)
      // Store the current drive name along with the clip
      set(`clips.${clipName}.drive`, drive)
      // Also store the current path of the user in the drive
      set(`clips.${clipName}.path`, driveVars.path === "" ? "/" : driveVars.path)
      // Tell the user
      printInfo(`Files stored under name ${chalk.keyword("orange")(clipName)}. Use the commmand ${chalk.keyword("orange")(`\`pst ${clipName}\``)} (without quotes) to paste the files in the folder you are in`)
    }
  }
}

// Wrap the console.log in a print function
exports.print = console.log

// Print out information in yellow
exports.printInfo = (anything) => {
  this.print(
    chalk.yellow(anything)
  )
}

// Print out something important in orange
exports.printBright = (anything) => {
  this.print(
    chalk.keyword("orange").bold(anything)
  )
}

// Print out an error in red
exports.printError = (err) => {
  if (err.isAxiosError) {
    if (err.code === "ECONNRESET") {
      this.print(
        chalk.red.bold("The server abruptly closed the connection. Check your wifi connection. Also check if the server has shut down or try again in a few seconds.")
      )
    }
    if (err.response && err.response.data && err.response.data.error && err.response.data.error.message) {
      this.print(
        chalk.red.bold(err.response.data.error.message)
      )
    } else if (err.statusText) {
      this.print(
        chalk.red.bold(`${err.status}: ${err.statusText}`)
      )
    } else {
      this.print(
        chalk.red.bold(err)
      )  
    }
  } else if (err.message) {
    this.print(
      chalk.red.bold(err.message)
    )
  } else {
    this.print(
      chalk.red.bold(err)
    )
  }
}

// Exit Dabbu and delete the .cache directory
exports.exitDabbu = () => {
  return fs.remove(`${__dirname}/../.cache/`)
    .then(() => this.set("clips", {}))
    .then(() => this.printInfo("Removed cache. Exiting.."))
    .finally(() => process.exit(0))
}