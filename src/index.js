// MARK - Imports

const chalk = require("chalk")
const figlet = require("figlet")
const store = require("data-store")({ path: `${__dirname}/config/dabbu_cli_config.json` })
const axios = require("axios")
const { Input, AutoComplete, Select } = require("enquirer")
const { waterfall, ask, get, set, error, exit, replaceAll } = require("./utils.js")

// MARK - Functions

// Create an instance by calling the client's newInstance method
async function configureClientForProvider(providerId) {
  // Set the current provider ID to the new one
  store.set("current_provider_id", providerId)
  // Import the client and call the newInstance method
  const Client = require(`./modules/${providerId}.js`).default
  return await new Client().newInstance()
}
// Create an instance based on the user's command
async function createInstance(input) {
  // Parse the command for the provider ID
  const providerId = replaceAll(input.toLowerCase(), {"::": "", " ": "_"})
  if (providerId) {
    // Create an instace for that provider
    configureClientForProvider(providerId)
  } else {
    // Else error out
    error(`Invalid provider ID ${providerId}. Try checking for a typo.`)
  }
  return
}
// Switch to an existing instance
async function switchInstance(input) {
  // Parse the instance ID from the command
  const instanceId = replaceAll(input, {":": "", " ": ""})
  // Get the provider ID of that instance
  const providerId = store.get(`instances.${instanceId}.provider_id`)
  if (providerId) {
    // Set them and return to the prompt
    store.set("current_instance_id", instanceId)
    store.set("current_provider_id", providerId)
  } else {
    // Else error out
    error("Invalid drive/instance name. Try checking for a typo.")
  }
  return
}

// Return a help message
async function help() {
  return [
    chalk.green("Welcome to Dabbu CLI v1.0.0! Here are a few tips to make your experience better:"),
    chalk.blue("  To move into a drive, just type in the drive name followed by a :"),
    chalk.blue("  To create a new drive, just type in :: <hard_drive OR google_drive>"),
    chalk.blue("  To move into a directory, use cd <relative_directory_path>"),
    chalk.blue("  To check your current directory, use pwd"),
    chalk.blue("  To list files in a folder, use ls [relative_directory_path]"),
    chalk.blue("  To view/download a file, use cat <relative_file_path>"),
    chalk.blue("  To delete a file, use rm <relative_file_path>")
  ].join("\n")
}
// Call the current client's pwd method
async function pwd() {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return await new Client().pwd()
}
// Call the current client's cd method
async function cd(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return await new Client().cd(input)
}
// Call the current client's ls method
async function ls(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return await new Client().ls(input)
}
// Call the current client's cat method
async function cat(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return await new Client().cat(input)
}
// Call the current client's rm method
async function rm(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return await new Client().rm(input)
}

// MARK - Main

// Go through the setup process if not done already
function setupUX() {
  // Check if the server address has been saved or not
  if (!store.get("server_address")) {
    // Ask for the server address
    const askForServerAddress = function() {
      return new Promise((resolve, reject) => {
        /*ask([
          {
            "name": "serverAddress", // The name of the variable the value will be returned as
            "type": "input", // The user needs to enter text
            "message": "Enter the address of your server:", // The prompt
            "validate": async (input) => {
              // Check if its a valid URL
              const expression = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/i
              const regex = new RegExp(expression);

              if (input.match(regex)) {
                return true
              } else {
                return false
              }
            }
          }
        ])*/
        ask(new Input({
          message: "Enter the address of your server",
          initial: "http://localhost:8080"
        }))
        .then(serverAddress => {
          // Store the server address and move on to the next step
          store.set("server_address", serverAddress)
          resolve(serverAddress)
        })
        .catch(err => {
          error(err.message)
          exit(1)
        })
      })
    }
  
    // Get the enabled providers on that server
    const getEnabledProviders = function(serverAddress) {
      return new Promise((resolve, reject) => {
        // Make an API call to the Dabbu server to get a list of enabled providers
        axios.get(`${serverAddress}/dabbu/v1/api/providers`)
          .then(res => {
            if (res.data.content.providers) {
              // Return them
              resolve(res.data.content.providers)
            } else {
              // Else error out
              error("Couldn't detect any enabled providers on the server!")
              exit(1)
            }
          })
          .catch(err => {
            if (err.response) {
              // Request made and server responded
              error(`An error occurred: ${err.response.data.error.message}`);
            } else if (err.request) {
              // The request was made but no response was received
              error(`An error occurred: No response was received from the server: ${err.message}`);
            } else {
              // Something happened in setting up the request that triggered an Error
              error(`An error occurred while sending a request to the server: ${err.message}`);
            }
            exit(1)
          })
      })
    }
  
    // Ask the user to choose a provider to setup first
    const askToChooseProvider = function(providers) {
      return new Promise((resolve, reject) => {
        /*ask([
          {
            "name": "currentProvider", // The name of the variable the value will be returned as
            "type": "list", // The user needs to enter text
            "message": "Pick a data provider (you can keep switching anytime):", // The prompt
            "default": store.get("current_instance_id"), // Default value should be the current instance
            "choices": providers // Choose from the list returned by the server
          }
        ])*/
        ask(new Select({
          name: "provider",
          message: "Pick a data provider to setup first (you can set up the others anytime):",
          choices: providers
        }))
        .then(currentProvider => {
          // Return the chosen provider and then call the configureClientForProvider method
          resolve(currentProvider)
        })
        .catch(err => {
          error(err.message)
          exit(1)
        })
      })
    }
  
    // Call these functions one after the other
    return waterfall([
      askForServerAddress,
      getEnabledProviders,
      askToChooseProvider,
      configureClientForProvider
    ])
  } else {
    return Promise.resolve()
  }
}

// Setup the UI
async function setupUI() {
  // Draw the logo
  console.log(chalk.yellowBright(figlet.textSync("Dabbu")))
}

// Go into a REPL loop - read the command line input, parse it, call the appropriate function or client module, and then repeat.
async function repl() {
  // To store the history, create a new data-store object
  const Store = require("data-store")
  const history = new Store({ path: `${__dirname}/config/dabbu_cli_history.json` })
  ask(new Input({
    name: "userInput", // The name of the variable the value gets saved in
    message: pwd(), // The prompt
    history: {
      store: history, // Save history in src/config/dabbu_cli_history.json
      autosave: true // Let enquirer do the saving
    },
    up() {
      return this.altUp(); // Scroll through previous commands on pressing the up arrow
    },
    down() {
      return this.altDown(); // Scroll through previous commands on pressing the down arrow
    }
  }))
  .then(async userInput => {
    // Check the user's input and call the appropriate function    
    if (userInput.startsWith("pwd")) {
      console.log(await pwd())
    } else if (userInput.startsWith("cd")) {
      await cd(userInput)
    } else if (userInput.startsWith("ls")) {
      await ls(userInput)
    } else if (userInput.startsWith("cat")) {
      await cat(userInput)
    } else if (userInput.startsWith("rm")) {
      await rm(userInput)
    } else if (userInput.startsWith("::")) {
      await createInstance(userInput)
    } else if (userInput.endsWith(":")) {
      await switchInstance(userInput)
    } else if (userInput === "help") {
      console.log(await help())
    } else if (userInput === "q" || userInput === "Q" || userInput === "quit" || userInput === "Quit" || userInput === "exit" || userInput === "Exit") {
      exit(0)
    } else {
      error("Invalid command. Type in help to know more.")
    }
    // Loop!
    return repl()
  })
  .catch(err => {
    // Error out, but continue to loop
    error(err.message)
    return repl()
  })
}

// Main function
function main() {
  waterfall([
    setupUI,
    setupUX,
    repl
  ])
}

// Call it
main()