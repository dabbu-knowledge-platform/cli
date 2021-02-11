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
const e = require("express")

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

exports.uniqueArray = (array) => {
  return array.filter(function(item, pos) {
    return array.lastIndexOf(item) == array.indexOf(item);
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
  let u = -1
  const r = 100

  do {
    fileSize /= thresh
    ++u
  } while (Math.round(Math.abs(fileSize) * r) / r >= thresh && u < units.length - 1)

  return fileSize.toFixed(2) + " " + units[u]
}

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
        downloadLink = link("View folder", contentURI)
      }
    } else {
      if (!contentURI) {
        downloadLink = "Link unavailable"
      } else {
        downloadLink = link("View file", contentURI)
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