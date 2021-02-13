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
const chalk = require("chalk")
const axios = require("axios")
const prompt = require("readcommand")
const { parseCommand } = require("./ops.js")
const { getDrawableText, handleInputError, deleteConfig, exitDabbu, get, set, printInfo, printBright, printError } = require("./utils.js")

// Main function
function main() {
  // Draw fancy text
  getDrawableText("Dabbu") // Get the text
    .then(printBright) // Print it out
    .then(checkSetupAndRun) // Check if the user is new and act accordingly
    .catch(printError) // Any error should be printed out
}

// Check if the user is new and act accordingly
function checkSetupAndRun() {
  // If the user hasn't been setup, welcome them
  if (!get("setup_done")) {
    // Ask the user for the address of the server
    const reqServerAddress = () => {
      // Wrap everything in a promise
      return new Promise((resolve, reject) => {
        // Ask them to enter it
        prompt.read({
          ps1: `Enter your server's address ${chalk.gray("default: http://localhost:8080")} > `
        }, (err, args) => {        
          // If there is an error, handle it
          if (err) {
            reject(err)
          } else {
            // If there is no error, get the address
            const server = args[0] || "http://localhost:8080"
            // Store it in config
            set("server", server)
            // Return successfully
            resolve(server)
          }
        })
      })
    }

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
        new DataModule().init(get("server"), name)
          .then(() => resolve(name))
          .catch(reject)
      })
    }

    reqServerAddress() // Get the server address from the user
      .then(getProviders) // Then get enabled providers from the server
      .then(reqProvider) // Then ask the user to choose a provider to setup
      .then(reqDriveName) // Get the name of the drive to create from the user
      .then(providerInit) // Let the provider run the rest
      .then(name => set("current_drive", name)) // Set the current drive
      .then(() => set("setup_done", true)) // Mark the setup as done
      .then(() => showPrompt()) // Show the user the command line
      .catch(printError) // Print the error, if any
  } else {
    // First check if the current drive is valid, as someone may have
    // deleted a provider and not changed the current drive
    let currentDriveName = get("current_drive")
    let currentDriveVars = get(`drives.${currentDriveName}`)
    // Check if there is no current drive
    if (!currentDriveName || JSON.stringify(currentDriveVars) === "{}") {
      // If not, then get all the current drives possible
      let allDrives = Object.keys(get("drives"))
      if (allDrives.length === 0) {
        // If there are no current drives, delete the config and exit, let them start again
        // We delete the config because they have messed with the only drive they had, so
        // there is no config other than server address that we will be deleting
        printError(`No valid drive was found. Deleting config and exiting. Running again will start setup.`)
        deleteConfig()
        exitDabbu()
      } else {
        // Else, if there are a few drives left, change to the first one that's not empty
        for (let i = 0, length = allDrives.length; i < length; i++) {
          const driveName = allDrives[i]
          const driveVars = get(`drives.${driveName}`)
          // Make sure it is not the current drive and has at least the provider field
          if (driveName != currentDriveName && driveVars.provider) {
            set("current_drive", driveName)
            break
          } else {
            // Empty that drive so it never gets picked, it is not properly configured
            set(`drives.${drive}`, {})
          }
        }
        printError(`Current drive was not set to a valid drive or current drive configuration was corrupt. Changing to ${drive}:`)
      }
    }
    // Then show them the command line
    showPrompt()
  }
}

// Show the user a prompt to enter input
function showPrompt(err = null) {
  // If there is an error, show it and then continue with the prompt
  if (err) printError(err)

  prompt
    .read({
      ps1: getPromptPs(), // The PS is the prefix to the user's input
      history: getPromptHistory() // Past commands can be accessed with the up key
    }, (err, args) => {
      // Add the command to history
      if (args.join(" ") !== "") {
        // Get current history
        let history = get("history") || []
        // Trim the length to the last 20 commands
        if (history.length > 19) {
          history = [...history.slice(history.length - 18, history.length - 1), args.join(" ")]
        } else {
          history = [...history, args.join(" ")]
        }
        // Set it in config
        set("history", history)
      }
      
      // If there is an error, handle it
      if (err) {
        handleInputError(err) // Handle the error
        showPrompt() // Show prompt again
      } else {
        // If there is no error, parse the input
        parseCommand(args)
          .then(showPrompt) // Then show prompt again
          .catch(showPrompt) // Show prompt again, but pass the error to it
      }
    })
}

function getPromptPs() {
  // Current drive
  const drive = get("current_drive")
  const driveVars = get(`drives.${drive}`)
  // Return the drive and the current path as the PS
  //return `(${driveVars.provider}) ${chalk.cyan(`${drive}:${driveVars.path}$`)} `
  return chalk.cyan(`${drive}:${driveVars.path}$ `)
}

function getPromptHistory() {
  return get("history") || []
}

// Start the app
main()
