const ora = require("ora")
const link = require("terminal-link")
const open = require("open")
const chalk = require("chalk")
const { get, set, parsePath, printInfo, printBright } = require("./utils")

const Table = require("cli-table3")

// Parse the command
exports.parseCommand = (args) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // If no args were specified, error out
    if (args.length === 0) {
      reject("No command specified")
    } else {
      // Check what the command is and act accordingly
      // Store the function as a variable and then execute it
      let opFunc = null
      switch(args[0]) {
        case "pwd": // Show the user their current drive and path
          opFunc = pwd
          break
        case "cd": // Move into a directory
          opFunc = cd
          break
        case "ls": // List out files and folders in a directory
          opFunc = ls
          break
        case "cat": // Download and open a file
          opFunc = cat
          break
        case "cp": // Copy a file across drives
          opFunc = cp
          break
        case "rm": // Delete a file
          opFunc = rm
          break
        default:
          if (args[0] === "::") 
            opFunc = cnd // Create a new drive
          else if (args[0].endsWith(":"))
            opFunc = sd // Switch drives
          break
      }
      if (opFunc) {
        // Run the function. Pass any errors back up
        opFunc(args).then(resolve).catch(reject)
      } else {
        reject("No such command") // Invalid input
      }
    }
  })
}

// Show the user their current drive and path
const pwd = (args) => {
  // Current drive
  const drive = get("current_drive")
  // Print the drive name and path as a promise
  printInfo(`${drive}:/${get(`drives.${drive}.path`)}`)

  // Return a resolved promise
  return Promise.resolve()
}

const cd = (args) => {
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

const ls = (args) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Get the current drive name, so we can get the variables from the config file
    const driveVars = get(`drives.${get("current_drive")}`)

    // The current path in that drive
    const currentPath = driveVars.path || ""
    // The user given relative path
    const inputPath = args[1] || "."
    // Parse the relative path and get an absolute one
    let finalPath = parsePath(inputPath, currentPath)
    finalPath = finalPath === "" ? "/" : finalPath

    // Show a loading indicator
    const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

    // Initialise the provider module
    const DataModule = require(`./modules/${driveVars.provider}`).default
    new DataModule().ls(get("server"), finalPath, driveVars)
      .then(files => {
        if (files) {
          // Append the files to a table and then display them
          const table = new Table({head: [chalk.green("Name"), chalk.green("Size"), chalk.green("Download Link")], colWidths: [null, null, null]})
          for (let i = 0, length = files.length; i < length; i++) {
            const file = files[i]

            // File name - blue if folder, magenta if file
            const fileName = file.kind === "folder" ? `${chalk.blueBright(file.name)} (folder)` : chalk.magenta(file.name)
            // File size in MB
            const fileSize = !file.size ? "-" : `${Math.floor(file.size / (1024 * 1024))} MB`
            // Download link
            const contentURI = file.contentURI
            // Convert to hyper link and then display it
            let downloadLink
            if (!contentURI) {
              if (file.kind !== "folder") {
                downloadLink = "Link unavailable"
              } else {
                // Never show a download link for a folder
                downloadLink = "-"
              }
            } else {
              downloadLink = link("Click to download", contentURI.replace(/\ /g, ""))
            }

            table.push([
              fileName, 
              fileSize,
              downloadLink
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
          printBright("Folder is empty")
        }
        // Return successfully
        resolve()
      })
      .catch((err) => {
        spinner.stop()
        reject(err)
      })
  })
}

const cat = (args) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Get the current drive name, so we can get the variables from the config file
    const driveVars = get(`drives.${get("current_drive")}`)

    // The current path in that drive
    const currentPath = driveVars.path || ""
    // The user given relative path
    const inputPath = args[1] || "./"
    // Get the folder names and file names separately
    let folders = inputPath.split("/")
    // Get the file name
    const fileName = folders.pop()
    // If only the file name was specified, set the folders array to have a path 
    // to the present directory
    if (folders.length === 0) {
      folders = ["."]
    }
    // Parse the relative path and get an absolute one
    let folderPath = parsePath(folders.join("/"), currentPath)
    folderPath = folderPath === "" ? "/" : folderPath

    // Show a loading indicator
    const spinner = ora(`Fetching ${chalk.blue(fileName)}`).start()

    // Initialise the provider module
    const DataModule = require(`./modules/${driveVars.provider}`).default
    new DataModule().cat(get("server"), folderPath, fileName, driveVars)
      .then(filePath => {
        // We got the result, stop loading
        spinner.stop()
        if (filePath) {
          // Tell the user where the file is downloaded
          printInfo(`File downloaded to ${filePath}`)
          // Open the downloaded file
          open(filePath, { wait: false })
        } else {
          // We have no file, stop loading
          spinner.stop()
          // Tell the user there was no file downloaded
          printBright("No file was downloaded")
        }
        // Return successfully
        resolve()
      })
      .catch((err) => {
        spinner.stop()
        reject(err)
      })
  })
}

const cp = (args) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Get the current drive name, so we can get the variables from the config file
    const driveVars = get(`drives.${get("current_drive")}`)

    // The current path in that drive
    const currentPath = driveVars.path || ""
    // The user given relative path
    const inputPath = args[1] || "./"
    // Get the folder names and file names separately
    let folders = inputPath.split("/")
    // Get the file name
    const fileName = folders.pop()
    // If only the file name was specified, set the folders array to have a path 
    // to the present directory
    if (folders.length === 0) {
      folders = ["."]
    }
    // Parse the relative path and get an absolute one
    let folderPath = parsePath(folders.join("/"), currentPath)
    folderPath = folderPath === "" ? "/" : folderPath

    // Show a loading indicator
    const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

    // Initialise the provider module
    const DataModule = require(`./modules/${driveVars.provider}`).default
    new DataModule().upl(get("server"), folderPath, fileName, driveVars)
      .then(() => {
        // Return successfully
        resolve()
      })
      .catch((err) => {
        spinner.stop()
        reject(err)
      })
  })
}

const rm = (args) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Get the current drive name, so we can get the variables from the config file
    const driveVars = get(`drives.${get("current_drive")}`)

    // The current path in that drive
    const currentPath = driveVars.path || ""
    // The user given relative path
    const inputPath = args[1] || "./"
    // Get the folder names and file names separately
    let folders = inputPath.split("/")
    // Get the file name
    const fileName = inputPath.endsWith("/") ? null : folders.pop()
    // If only the file name was specified, set the folders array to have a path 
    // to the present directory
    if (folders.length === 0) {
      folders = ["."]
    }
    // Parse the relative path and get an absolute one
    let folderPath = parsePath(folders.join("/"), currentPath)
    folderPath = folderPath === "" ? "/" : folderPath

    // Show a loading indicator
    const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

    // Initialise the provider module
    const DataModule = require(`./modules/${driveVars.provider}`).default
    new DataModule().rm(get("server"), folderPath, fileName, driveVars)
      .then(deleted => {
        if (deleted) {
          // We got the result, stop loading
          spinner.stop()
          // Tell the user the file/folder was deleted
          if (fileName) {
            printInfo(`File ${folderPath}/${fileName} was successfully deleted`)
          } else {
            printInfo(`Folder ${folderPath} was successfully deleted`)
          }
        } else {
          // We have no files, stop loading
          spinner.stop()
          // Tell the user the file/folder was not deleted
          reject("File/folder not deleted due to unkown reason")
        }
        // Return successfully
        resolve()
      })
      .catch((err) => {
        spinner.stop()
        reject(err)
      })
  })
}