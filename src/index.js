// MARK - Imports

const fs = require("fs-extra")
const chalk = require("chalk")
const figlet = require("figlet")
const store = require("data-store")({ path: `${__dirname}/config/dabbu_cli_config.json` })
const axios = require("axios")
const { Input, Confirm, Select } = require("enquirer")
const { waterfall, ask, replaceAll, error, exit, handleError } = require("./utils.js")

// MARK - Functions

// Create an instance by calling the client's newInstance method
function configureClientForProvider(providerId) {
  // Set the current provider ID to the new one
  store.set("current_provider_id", providerId)
  // Import the client and call the newInstance method
  const Client = require(`./modules/${providerId}.js`).default
  return new Client().newInstance()
}
// Create an instance based on the user's command
function createInstance(input) {
  // Parse the command for the provider ID
  const providerId = replaceAll(input.toLowerCase(), {"::": ""})
  if (providerId) {
    // Create an instance for that provider
    return configureClientForProvider(providerId)
  } else {
    // Else error out
    error(`Invalid provider ID ${providerId}. Try checking for a typo.`)
  }
}
// Switch to an existing instance
async function switchInstance(input) {
  // Parse the instance ID from the command
  const instanceId = replaceAll(input, {":": ""}).toLowerCase()
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
async function reset(input) {
  // Parse the instance ID from the command
  const onlyHist = replaceAll(input, {"reset": "", " ": ""}).toLowerCase().indexOf("h") !== -1
  if (onlyHist) {
    // If only history is to be deleted, ask the user and then do so
    return ask(new Confirm({
        name: "confirm",
        message: "Are you sure you want to delete your command history?"
      }))
      .then(confirm => confirm ? fs.unlink(`${__dirname}/config/dabbu_cli_history.json`) : false)
      .then(deleted => deleted ? console.log(chalk.yellow("Deleted history (src/config/dabbu_cli_history.json)")) : undefined)
  } else {
    console.log(
      chalk.redBright([
        "Are you sure you want to delete the current configuration",
        "file? This will remove all your drives and related configuration",
        "details! It will also forget your command history. If you",
        "want to delete only command history, run reset -h instead."
      ].join("\n"))
    )
    return ask(new Confirm({
        name: "confirm",
        message: "Are you sure want to do this?"
      }))
      .then(confirm => confirm ? fs.unlink(`${__dirname}/config/dabbu_cli_config.json`) : false)
      .then(confirm => confirm ? fs.unlink(`${__dirname}/config/dabbu_cli_history.json`) : false)
      .then(deleted => deleted ? console.log(chalk.yellow("Deleted config (src/config/dabbu_cli_config.json) and history (src/config/dabbu_cli_history.json)")) : undefined)
  }
}

// Return a help message
function help() {
  return [
    chalk.green("Welcome to Dabbu CLI v1.0.0! Here are a few tips to make your experience better:"),
    chalk.blue("  To move into a drive, just type in the drive name followed by a :, e.g. c:"),
    chalk.blue("  To create a new drive, just type in ::<hard_drive OR google_drive>"),
    chalk.blue("  To move into a directory, use cd <relative_directory_path>"),
    chalk.blue("  To check your current directory, use pwd"),
    chalk.blue("  To list files in a folder, use ls [relative_directory_path]"),
    chalk.blue("  To download and view a file, use cat <relative_file_path>"),
    chalk.blue("  To copy a file within a drive, use cp <relative_file_path> <path_to_folder_to_copy_to>"),
    chalk.blue("  To delete a file, use rm <relative_file_path>"),
    chalk.blue("  To delete your command history, run reset -h"),
    chalk.blue("  To delete your configuration and command history, run reset")
  ].join("\n")
}
// Call the current client's pwd method
function pwd() {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return new Client().pwd()
}
// Call the current client's cd method
function cd(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return new Client().cd(input)
}
// Call the current client's ls method
function ls(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return new Client().ls(input)
}
// Call the current client's cat method
function cat(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return new Client().cat(input)
}
// Call the current client's cp method
function cp(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return new Client().cp(input)
}
// Call the current client's rm method
function rm(input) {
  const Client = require(`./modules/${store.get("current_provider_id")}.js`).default
  return new Client().rm(input)
}

// MARK - Main

// Go through the setup process if not done already
function setupUX() {
  // Check if the server address has been saved or not
  if (!store.get("server_address")) {
    // Ask for the server address
    const askForServerAddress = function() {
      return ask(new Input({
          message: "Enter the address of your server",
          initial: "http://localhost:8080"
        }))
        .then(serverAddress => {
          // Store the server address and move on to the next step
          store.set("server_address", serverAddress)
          return serverAddress
        })
    }
  
    // Get the enabled providers on that server
    const getEnabledProviders = function(serverAddress) {
        // Make an API call to the Dabbu server to get a list of enabled providers
      return axios.get(`${serverAddress}/dabbu/v1/api/providers`)
        .then(res => {
          if (res.data && res.data.content && res.data.content.providers) {
            // Return them
            resolve(res.data.content.providers)
          } else {
            // Else error out
            error("Couldn't detect any enabled providers on the server!")
            exit(1)
          }
        })
        .catch(err => {
          // Handle the error
          handleError(err)
          exit(1)
        })
    }
  
    // Ask the user to choose a provider to setup first
    const askToChooseProvider = function(providers) {
      return ask(new Select({
          name: "provider",
          message: "Pick a data provider to setup first (you can set up the others anytime):",
          choices: providers
        }))
        .then(currentProvider => {
          // Return the chosen provider and then call the configureClientForProvider method
          return currentProvider
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
function setupUI() {
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
      return this.altUp() // Scroll through previous commands on pressing the up arrow
    },
    down() {
      return this.altUp() // Scroll through previous commands on pressing the down arrow
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
    } else if (userInput.startsWith("cp")) {
      await cp(userInput)
    } else if (userInput.startsWith("rm")) {
      await rm(userInput)
    } else if (userInput.startsWith("::")) {
      await createInstance(userInput)
    } else if (userInput.endsWith(":")) {
      await switchInstance(userInput)
    } else if (userInput.startsWith("reset")) {
      await reset(userInput)
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