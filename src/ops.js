const ora = require("ora")
const link = require("terminal-link")
const open = require("open")
const chalk = require("chalk")
const path = require("path")
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
        case "clear": // Clear the console
          opFunc = () => {
            // Promisify the clear process
            return new Promise((resolve, reject) => {
              process.stdout.write('\x1b[2J')
              process.stdout.write('\x1b[0f')
              resolve()
            })
          }
          break
        case "q", "quit", "Q", "Quit", "exit", "Exit":
          process.exit(0)
          break
        default:
          if (args[0] === "::") 
            opFunc = cnd // Create a new drive
          else if (args[0].endsWith(":"))
            opFunc = sd // Switch drives
          break
      }
      if (opFunc) {
        // Run the function (if needed only). Pass any errors back up
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
  // Parse the from file path
  let fromInput = args[1]
  if (!fromInput) fromInput = "."

  let fromSplit = fromInput.split(":")
  let fromDrive = fromSplit[0]
  if (!fromDrive || fromSplit.length === 1) fromDrive = get("current_drive")

  // Get the current drive name, so we can get the variables from the config file
  const fromDriveVars = get(`drives.${fromDrive}`)

  // The current path in that drive
  const fromCurrentPath = fromDriveVars.path || ""
  // The user given relative path
  const fromInputPath = fromSplit.length === 2 ? fromSplit[1] : fromSplit[0]
  // Get the folder names and file names separately
  let fromFolders = fromInputPath.split("/")
  // Get the file name
  const fromFileName = fromFolders.pop()
  // If only the file name was specified, set the fromFolders array to have a path 
  // to the present directory
  if (fromFolders.length === 0) {
    fromFolders = ["."]
  }
  // Parse the relative path and get an absolute one
  let fromFolderPath = parsePath(fromFolders.join("/"), fromCurrentPath)
  fromFolderPath = fromFolderPath === "" ? "/" : fromFolderPath

  // Parse the to file path
  let toInput = args[2]
  if (!toInput) toInput = "."

  let toSplit = toInput.split(":")
  let toDrive = toSplit[0]
  if (!toDrive || toSplit.length === 1) toDrive = get("current_drive")

  // Get the current drive name, so we can get the variables to the config file
  const toDriveVars = get(`drives.${toDrive}`)

  // The current path in that drive
  const toCurrentPath = toDriveVars.path || ""
  // The user given relative path
  const toInputPath = toSplit.length === 2 ? toSplit[1] : toSplit[0]
  // Get the folder names and file names separately
  let toFolders = toInputPath.split("/")
  // Get the file name
  const toFileName = toInputPath.endsWith("/") || toInputPath.endsWith("..") || toInputPath.endsWith(".") ? fromFileName : toFolders.pop()
  // If only the file name was specified, set the toFolders array to have a path 
  // to the present directory
  if (toFolders.length === 0) {
    toFolders = ["."]
  }
  // Parse the relative path and get an absolute one
  let toFolderPath = parsePath(toFolders.join("/"), toCurrentPath)
  toFolderPath = toFolderPath === "" ? "/" : toFolderPath

  // First, download the file
  const downloadFile = () => {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Show a loading indicator
      const spinner = ora(`Fetching ${chalk.blue(fromFileName)}`).start()

      // Initialise the provider module
      const FromDataModule = require(`./modules/${fromDriveVars.provider}`).default
      new FromDataModule().cat(get("server"), fromFolderPath, fromFileName, fromDriveVars)
        .then(filePath => {
          // We got the result, stop loading
          spinner.stop()
          if (filePath) {
            // Return the file path successfully
            resolve(filePath) 
          } else {
            // Error out
            reject("No file was downloaded")
          }
        })
        .catch((err) => {
          spinner.stop()
          reject(err)
        })
    })
  }

  // Then, upload it
  const uploadFile = (downloadedFilePath) => {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Show a loading indicator
      const spinner = ora(`Uploading ${chalk.blue(toFileName)}`).start()

      // Initialise the provider module
      const ToDataModule = require(`./modules/${toDriveVars.provider}`).default
      new ToDataModule().upl(get("server"), toFolderPath, toFileName, {...toDriveVars, downloadedFilePath: downloadedFilePath})
        .then(uploaded => {
          // We got the result, stop loading
          spinner.stop()
          if (uploaded) {
            // Tell the user we're done
            printInfo(`Successfully copied ${path.join(fromFolderPath, fromFileName)} to ${path.join(toFolderPath, toFileName)}`)
            // Return successfully
            resolve()
          } else {
            // Error out
            reject("File could not be uploaded")
          }
        })
        .catch((err) => {
          spinner.stop()
          reject(err)
        })
    })
  }

  // Execute the functions one after the other
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    downloadFile()
      .then(uploadFile)
      .then(resolve)
      .catch(reject)
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
    const spinner = ora(`Deleting ${chalk.blue(fileName || folderPath)}`).start()

    // Initialise the provider module
    const DataModule = require(`./modules/${driveVars.provider}`).default
    new DataModule().rm(get("server"), folderPath, fileName, driveVars)
      .then(deleted => {
        // We got the result, stop loading
        spinner.stop()
        if (deleted) {
          // Tell the user the file/folder was deleted
          if (fileName) {
            printInfo(`File ${path.join(folderPath, fileName)} was successfully deleted`)
          } else {
            printInfo(`Folder ${folderPath} was successfully deleted`)
          }
        } else {
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