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

const ora = require("ora")
const open = require("open")
const chalk = require("chalk")
const axios = require("axios")
const prompt = require("readcommand")
const path = require("path")
const { get, set, uniqueArray, parsePath, printInfo, printBright, exitDabbu, printError, printFiles } = require("./utils.js")

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
        case "l": // List out files and folders in a directory
        case "ls":
        case "ll":
        case "la":
        case "lf":
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
        case "tree": // Lists files and folders recursively
          opFunc = tree
          break
        case "search": // Search for a file
          opFunc = search
          break
        case "pst": // Paste copied files
          opFunc = pst
          break
        case "help":
          const help = () => {
            // Promisify the help command
            return new Promise((resolve, reject) => {
              printInfo([
                "Welcome to Dabbu CLI! Here is an overview of the commands you can use:",
                "Anything in <> must be mentioned, while if it is in [], it is optional.",
                `  - ${chalk.keyword("orange")("pwd")} - Know your current drive and directory`,
                `  - ${chalk.keyword("orange")("cd <relative path to directory>")} - Move into a directory`,
                `  - ${chalk.keyword("orange")("ls [relative path to directory]")} - List files in a directory`,
                `  - ${chalk.keyword("orange")("cat <relative path to file>")} - Download and open a file`,
                `  - ${chalk.keyword("orange")("cp <relative path to file (can include drive name)> <relative path to place to copy to (can include drive name)>")} - Copy a file from`,
                `    one place to another`,
                `    Note: To copy search results or list results, you can simply add a ${chalk.keyword("orange")("\` | cp <name of set of files>\`")} (without quotes) to the end of a`,
                `    list or search command. To paste the files to another location, go to that folder and type in (without quotes) the following: `,
                `    ${chalk.keyword("orange")("\`pst <name of the set of files you copied>\`")}`,
                `  - ${chalk.keyword("orange")("rm <relative path to file>")} - Delete a file`,
                `  - ${chalk.keyword("orange")("search <relative path to folder> <space-separated keywords to search for>")} - Searches recursively for files and folders that contain any one of the mentioned keywords (greedy match)`,
                `  - ${chalk.keyword("orange")("tree [relative path to directory]")} - Recursively lists files and folders in a directory`,
                `  - ${chalk.keyword("orange")("<drive name>:")} - Switch drives (Notice the colon at the end of the drive name)`,
                `  - ${chalk.keyword("orange")("::")} - Create a new drive`,
                `  - ${chalk.keyword("orange")("clear")} - Clear the screen`,
                `  - ${chalk.keyword("orange")("q or quit or exit or CTRL+C")} - Exit`
              ].join("\n"))
              resolve()
            })
          }
          opFunc = help
          break
        case "clear": // Clear the console
          const clear = () => {
            // Promisify the clear process
            return new Promise((resolve, reject) => {
              process.stdout.write('\x1b[2J')
              process.stdout.write('\x1b[0f')
              resolve()
            })
          }
          opFunc = clear
          break
        case "q":
        case "quit":
        case "Q":
        case "Quit":
        case "exit":
        case "Exit":
          exitDabbu()
          return
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
  printInfo(`(${get(`drives.${drive}.provider`)}) ${drive}:${get(`drives.${drive}.path`)}`)

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
    let inputPath
    // Figure out if the user has given a path or not (keeping in mind the |)
    if (args[1]) {
      if (args[1] === "|") {
        inputPath = "."
      } else {
        inputPath = args[1]
      }
    } else {
      inputPath = "."
    }
    // Parse the relative path and get an absolute one
    let finalPath = parsePath(inputPath, currentPath)
    finalPath = finalPath === "" ? "/" : finalPath

    // Show a loading indicator
    const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

    // Initialise the provider module
    const DataModule = require(`./modules/${driveVars.provider}`).default
    new DataModule().ls(get("server"), get("current_drive"), finalPath, driveVars)
      .then((files) => {
        // Stop loading, we have the results
        spinner.stop()
        if (files) {
          // Check if the result is to be copied to clipboard
          const command = args.join(" ")
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
              set(`clips.${clipName}.drive`, get("current_drive"))
              // Also store the current path of the user in the drive
              set(`clips.${clipName}.path`, driveVars.path === "" ? "/" : driveVars.path)
              // Tell the user
              printInfo(`Files stored under name ${chalk.keyword("orange")(clipName)}. Use the commmand ${chalk.keyword("orange")(`\`pst ${clipName}\``)} (without quotes) to paste the files in the folder you are in`)
              // Return successfully
              resolve()
            } else {
              // Else just print the files
              printFiles(files)    
            }
          } else {
            // Else just print the files
            printFiles(files)
            // Return successfully
            resolve()
          }
        } else {
          // Tell the user the folder is empty
          printBright("Folder is empty")
          // Return successfully
          resolve()
        }
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
    new DataModule().cat(get("server"), get("current_drive"), folderPath, fileName, driveVars)
      .then(filePath => {
        // We got the result, stop loading
        spinner.stop()
        if (filePath) {
          // Tell the user where the file is downloaded
          printInfo(`File downloaded temporarily to ${path.normalize(filePath)}`)
          printInfo(`It will be deleted once this session ends.`)
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
  // Check if we have the -l parameter. If there is a -l or --list,
  // then list out the saved clips so far
  if (args.indexOf("-l") !== -1 || args.indexOf("--list") !== -1) {
    // Get the clips
    const clips = get("clips")
    // If there are no clips, tell the user that and return
    if (JSON.stringify(clips) === "{}") {
      printBright("Nothing copied to clipboard yet. To copy something to clipboard, add the following after a ls/tree/search command - \` | cp\`")
      // Return successfully
      return Promise.resolve()
    }
    // Loop through the clips
    Object.keys(clips).forEach(clipName => {
      // Get the clip
      const clip = clips[clipName]
      // Print out the clip name and which drive and folder it is from
      printInfo(`Showing clip \`${clipName}\` - ${clip.drive}:${clip.path}`)
      // Print the files with their full paths
      printFiles(clip.files, true)
    })
    // Return successfully
    return Promise.resolve()
  }

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
  const fromFileName = fromInputPath.endsWith("..") || fromInputPath.endsWith(".") ? null : fromFolders.pop()
  if (fromFileName === null) {
    return Promise.reject("Invalid file name")
  }
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
      new FromDataModule().cat(get("server"), fromDrive, fromFolderPath, fromFileName, fromDriveVars)
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
      new ToDataModule().upl(get("server"), toDrive, toFolderPath, toFileName, {...toDriveVars, downloadedFilePath: downloadedFilePath})
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
    new DataModule().rm(get("server"), get("current_drive"), folderPath, fileName, driveVars)
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

const tree = (args) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Get the current drive name, so we can get the variables from the config file
    const driveVars = get(`drives.${get("current_drive")}`)

    // The current path in that drive
    const currentPath = driveVars.path || ""
    // The user given relative path
    let inputPath
    // Figure out if the user has given a path or not (keeping in mind the |)
    if (args[1]) {
      if (args[1] === "|") {
        inputPath = "."
      } else {
        inputPath = args[1]
      }
    } else {
      inputPath = "."
    }
    // Parse the relative path and get an absolute one
    let finalPath = parsePath(inputPath, currentPath)
    finalPath = finalPath === "" ? "/" : finalPath

    // List directories recursively
    // Show a loading indicator
    const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

    // Initialise the provider module
    const DataModule = require(`./modules/${driveVars.provider}`).default
    const dataModule = new DataModule()

    // Recursively list files
    const listFilesRecursively = function(folder, printResult) {
      // Tell the user which folder we are querying
      spinner.start()
      spinner.text = `Listing files in ${chalk.blue(folder)}`
      // An array to hold all the files whose names contain any 
      // one of the search terms
      let matchingFiles = []
      // Files already printed in recursive folders
      let seenFiles = []
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // Call the module's list function
        dataModule.ls(get("server"), get("current_drive"), folder, driveVars)
          .then(list => {
            if (list) {
              let i = 0
              // Create a function that will walk through the directories
              const next = () => {
                // Current file
                var file = list[i++]
                // If there is no such file, return all the matching 
                // files found so far (we've reached the end)
                if (!file) {
                  spinner.stop()
                  printInfo(folder)
                  printFiles(uniqueArray(matchingFiles.concat(seenFiles)), true)
                  return resolve(matchingFiles)
                }
                if (file.kind === "folder") {
                  // If it's a folder, then call the listFiles method again
                  // with the folder path
                  listFilesRecursively(file.path)
                    .then(files => {
                      matchingFiles = matchingFiles.concat(files)
                      seenFiles = seenFiles.concat(files)
                    })
                    .then(() => next())
                } else {
                  matchingFiles.push(file)
                  // Call this method again for the rest of the files
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

    // Get the files
    listFilesRecursively(finalPath, true)
    .then(files => {
      // Stop loading, we have the results
      spinner.stop()
      if (files) {
        // Check if the result is to be copied to clipboard
        const command = args.join(" ")
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
            set(`clips.${clipName}.drive`, get("current_drive"))
            // Also store the current path of the user in the drive
            set(`clips.${clipName}.path`, finalPath === "" ? "/" : finalPath)
            // Tell the user
            printInfo(`Files stored under name ${chalk.keyword("orange")(clipName)}. Use the commmand ${chalk.keyword("orange")(`\`pst ${clipName}\``)} (without quotes) to paste the files in the folder you are in`)
          }
        }
        // Return successfully
        resolve()
      } else {
        // There were no results
        printBright(`Did not find any matches in the folder ${finalPath}`)
        // Return successfully
        resolve()
      }
    })
    .catch(reject) // Pass the error back on, if any
  })
}

const search = (args) => {
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

    // The rest of the args are the search terms
    let searchTerms = args.slice(2)
    if (searchTerms.length === 0) {
      // If there are no search terms, error out
      reject("Please specify space-separated keywords to search for. Use the command this way: \n  search <relative path to folder> <space-separated keywords to search for>")
    } else {
      // List directories recursively
      // Show a loading indicator
      const spinner = ora(`Loading your ${chalk.blue("files and folders")}`).start()

      // Initialise the provider module
      const DataModule = require(`./modules/${driveVars.provider}`).default
      const dataModule = new DataModule()

      // Recursively list files
      const listFilesRecursively = function(folder, printResult) {
        // Tell the user which folder we are querying
        spinner.start()
        spinner.text = `Searching in ${chalk.blue(folder)}`
        // An array to hold all the files whose names contain any 
        // one of the search terms
        let matchingFiles = []
        // Files already printed in recursive folders
        let seenFiles = []
        // Wrap everything in a promise
        return new Promise((resolve, reject) => {
          // Call the module's list function
          dataModule.ls(get("server"), get("current_drive"), folder, driveVars)
            .then(list => {
              if (list) {
                let i = 0
                // Create a function that will walk through the directories
                const next = () => {
                  // Current file
                  var file = list[i++]
                  // If there is no such file, return all the matching 
                  // files found so far (we've reached the end)
                  if (!file) {
                    spinner.stop()
                    printInfo(folder)
                    printFiles(uniqueArray(matchingFiles.concat(seenFiles)), true)
                    return resolve(matchingFiles)
                  }
                  if (file.kind === "folder") {
                    // Check if ANY of the search terms are included 
                    // in the name of the folder itself first
                    for (j in searchTerms) {
                      if (file.name.toLowerCase().includes(searchTerms[j].toLowerCase())) {
                        matchingFiles.push(file)
                        break
                      }
                    }
                    // If it's a folder, then call the listFiles method again
                    // with the folder path
                    listFilesRecursively(file.path)
                      .then(files => {
                        matchingFiles = matchingFiles.concat(files)
                        seenFiles = seenFiles.concat(files)
                        //printInfo(file.path)
                        //printFiles(files, true)
                      })
                      .then(() => next())
                  } else {
                    // If it's a file, check if ANY of the search terms are 
                    // included in the name of the file
                    for (j in searchTerms) {
                      if (file.name.toLowerCase().includes(searchTerms[j].toLowerCase())) {
                        matchingFiles.push(file)
                        break
                      }
                    }
                    // Call this method again for the rest of the files
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

      // Get the files
      listFilesRecursively(finalPath, true)
      .then(files => {
        // Stop loading, we have the results
        spinner.stop()
        if (files) {
          // Check if the result is to be copied to clipboard
          const command = args.join(" ")
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
              set(`clips.${clipName}.drive`, get("current_drive"))
              // Also store the current path of the user in the drive
              set(`clips.${clipName}.path`, finalPath === "" ? "/" : finalPath)
              // Tell the user
              printInfo(`Files stored under name ${chalk.keyword("orange")(clipName)}. Use the commmand ${chalk.keyword("orange")(`\`pst ${clipName}\``)} (without quotes) to paste the files in the folder you are in`)
            }
          }
          // Return successfully
          resolve()
        } else {
          // There were no results
          printBright(`Did not find any matches in the folder ${finalPath}`)
          // Return successfully
          resolve()
        }
      })
      .catch(reject) // Pass the error back on, if any
    }
  })
}

const pst = async (args) => {
  // Get the name of the result you had copied and now want to paste
  let clipName
  if (args.length < 2) 
    clipName = "default"
  else
    clipName = args[1]

  // Get everything stored in the clip
  const clip = get(`clips.${clipName}`)
  if (!clip) {
    printError(`No clip was found with the name ${clipName}`)
    return
  }

  // Get the from drive name and vars
  const fromDrive = clip.drive
  const fromDriveVars = get(`drives.${fromDrive}`)
  // Get the path the user was in when they copied the files
  // We will remove everything before this path while re-uploading
  // the files
  const fromBasePath = clip.path

  // The files to paste
  const filesToPaste = clip.files

  if (filesToPaste.length === 0) {
    return Promise.reject("No files to paste!")
  }

  // Get the current drive name and vars
  const toDrive = get("current_drive")
  const toDriveVars = get(`drives.${toDrive}`)

  // Show a loading indicator
  let spinner = ora(`Pasting ${chalk.blue("files and folders")}`).start()

  // The functions needed to download and re-upload the files
  // First, download the file
  const downloadFile = (fromDrive, fromDriveVars, fromFolderPath, fromFileName) => {
    // Tell the user
    spinner.text = `Downloading ${fromFolderPath}/${fromFileName}`
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Initialise the provider module
      const FromDataModule = require(`./modules/${fromDriveVars.provider}`).default
      new FromDataModule().cat(get("server"), fromDrive, fromFolderPath, fromFileName, fromDriveVars)
        .then(filePath => {
          if (filePath) {
            // Return the file path successfully
            resolve(filePath) 
          } else {
            // Error out
            reject("No file was downloaded")
          }
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  // Then, upload it
  const uploadFile = (toDrive, toDriveVars, toFolderPath, toFileName, downloadedFilePath) => {
    // Tell the user
    spinner.text = `Uploading ${toFolderPath}${toFileName}`
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Initialise the provider module
      const ToDataModule = require(`./modules/${toDriveVars.provider}`).default
      new ToDataModule().upl(get("server"), toDrive, toFolderPath, toFileName, {...toDriveVars, downloadedFilePath: downloadedFilePath})
        .then(uploaded => {
          if (uploaded) {
            // Return successfully
            resolve()
          } else {
            // Error out
            reject("File could not be uploaded")
          }
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  for(const file of filesToPaste) {
    // Parse the paths, then download and re-upload the files
    // Don't do anything if the it is a folder
    if (file.kind === "folder") {
      spinner.stop()
      printBright(`Skipping \`${file.name}\` as it is a folder. To recursively copy files, use \`tree <folder name> | cp\` (without quotes).`)
      spinner.start()
      continue
    }
    // Get the file's path
    let fromFilePath = file.path
    // To adjust for the base path of the hard drive provider,
    // remove everything before the current path and add the
    // current path again
    fromFilePath = fromFilePath.split(fromBasePath)
    if (fromFilePath.length >= 2) {
      fromFilePath = `${fromBasePath}${fromFilePath[fromFilePath.length - 1]}`
    } else {
      fromFilePath = file.path
    }

    // Get the folder names and file names separately
    let fromFolders = fromFilePath.split("/")
    // Get the file name
    const fromFileName = fromFilePath.endsWith("..") || fromFilePath.endsWith(".") ? null : fromFolders.pop()
    if (fromFileName === null) {
      return Promise.reject("Invalid file name")
    }
    // If only the file name was specified, set the fromFolders array to have a path 
    // to the present directory
    if (fromFolders.length === 0) {
      fromFolders = ["."]
    }
    // Parse the relative path and get an absolute one
    let fromFolderPath = parsePath(fromFolders.join("/"), fromDriveVars.path)
    fromFolderPath = fromFolderPath === "" ? "/" : fromFolderPath

    // For the toFilePath, remove the base path from the fromFilePath
    let toFilePath = fromFilePath.split(fromBasePath)
    if (toFilePath.length >= 2) {
      toFilePath = toFilePath[toFilePath.length - 1]
    } else {
      toFilePath = file.path
    }

    // Get the folder names and file names separately
    let toFolders = toFilePath.split("/")
    // Get the file name
    const toFileName = toFilePath.endsWith("/") || toFilePath.endsWith("..") || toFilePath.endsWith(".") ? fromFileName : toFolders.pop()
    // If only the file name was specified, set the toFolders array to have a path 
    // to the present directory
    if (toFolders.length === 0) {
      toFolders = ["."]
    }
    // Parse the relative path and get an absolute one
    let toFolderPath = parsePath(`./${toFolders.join("/")}`, toDriveVars.path)
    toFolderPath = toFolderPath === "" ? "/" : toFolderPath

    try {
      const downloadedFilePath = await downloadFile(fromDrive, fromDriveVars, fromFolderPath, fromFileName)
      await uploadFile(toDrive, toDriveVars, toFolderPath, toFileName, downloadedFilePath)
    } catch (err) {
      spinner.stop()
      printError(err)
      spinner.start()
    }
  }

  spinner.stop()

  return
}

const cnd = (args) => {
  const server = get("server")
  // Get all enabled providers from the server
  const getProviders = (server) => {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // The URL to send the request to
      const url = `${server}/dabbu/v1/api/providers`
      // Send a GET request
      axios.get(url)
      .then(res => {
        if (res.data.content.providers.length > 0) {
          // If there are some providers, return them
          resolve(res.data.content.providers)
        } else {
          // Else error out
          reject("An unexpected error occurred: The server returned no valid/enabled providers")
        }
      })
      .catch(reject) // Pass error back if any
    })
  }

  // Ask the user to choose a provider
  const reqProvider = (providers) => {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Join the providers into a presentable list
      let providerString = providers.join(", ")

      // Tell the user about the base path they need to enter
      printInfo(`Choose a provider to setup first - ${providerString}`)

      // Ask them to enter it
      prompt.read({
        ps1: `Enter the provider name as is > `
      }, (err, args) => {        
        // If there is an error, handle it
        if (err) {
          reject(err)
        } else {
          // If there is no error, get the provider
          let provider = args.join("_")
          // If they haven't entered anything, flag it and ask again
          if (!provider || providers.indexOf(provider.replace(/\ /g, "_").toLowerCase()) === -1) {
            printError(`Choose a provider to setup first - ${providerString}`)
            reqProvider(providers)
          } else {
            provider = provider.replace(/\ /g, "_").toLowerCase()
            // Return successfully
            resolve(provider)
          }
        }
      })
    })
  }
  
  // Ask the user for a name for the drive
  const reqDriveName = (provider) => {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      // Ask them to enter it
      prompt.read({
        ps1: `Enter a name for your drive > `
      }, (err, args) => {        
        // If there is an error, handle it
        if (err) {
          reject(err)
        } else {
          // If there is no error, get the name
          let name = args.join("_")
          // If they haven't entered anything, flag it and ask again
          if (!name) {
            printError("Please enter a name for the drive. (e.g.: c, d, e)")
            reqDriveName(provider)
          } else {
            // Else create a drive in config by setting the provider and path
            name = name.replace(/\ /g, "_").replace(/:/g, "")
            set(`drives.${name}.provider`, provider)
            set(`drives.${name}.path`, "")
            // Return successfully
            resolve(name)
          }
        }
      })
    })
  }

  // Let the provider do the rest
  const providerInit = (name) => {
    // Wrap everything in a promise
    return new Promise((resolve, reject) => {
      const provider = get(`drives.${name}.provider`)
      const DataModule = require(`./modules/${provider}`).default
      new DataModule().init(get("server"), get("current_drive"), name)
        .then(() => resolve(name))
        .catch(reject)
    })
  }

  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    getProviders(server) // Get enabled providers from the server
    .then(reqProvider) // Then ask the user to choose a provider to setup
    .then(reqDriveName) // Get the name of the drive to create from the user
    .then(providerInit) // Let the provider run the rest
    .then(name => set("current_drive", name)) // Set the current drive
    .then(() => resolve())
    .catch(reject) // Pass back the error, if any
  })
}

const sd = (args) => {
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Get the drive the user wants to switch to
    const drive = args[0].replace(/:/g, "")
    // Get the drives the user has setup
    const drives = get("drives")

    // If there is a drive with that name, switch to it
    if (drives[drive]) {
      set("current_drive", drive)
      resolve()
    } else {
      // Else error out
      reject(`Invalid drive name - choose one of these - ${Object.keys(drives).join(", ")}`)
    }
  })
}