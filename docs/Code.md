# Dabbu Code Overview

**If you want to contribute new features or fix a bug or make perfomance improvements, please do read through this document to know how the code is structured.**

## **src/config/dabbu_cli_config.json**

It will contain the server address, the current instance, the ID of the provider the current instance is using and all instance-specific details. It is of the following format:

```JSON
{
  "server_address": "http://localhost:8080",
  "current_provider_id": "hard_drive",
  "current_instance_id": "c",
  "instances": {
    "c": {
      "provider_id": "hard_drive",
      "base_path": "/home/user/code",
      "current_path": "/dabbu-cli"
    },
    "d": {
      "provider_id": "hard_drive",
      "base_path": "/home/user/Documents",
      "current_path": ""
    }
  }
}
```

The config file's fields are all set by the CLI itself and it will reset the file if there is an error parsing the JSON. It is definitely **NOT** recommended to manually edit the file. If you are creating a client for a provider, you can set fields within each instance (like base_path, access_token, etc.), but not any global fields. Even the current path the user is in should be stored per instance.

## **src/config/dabbu_cli_history.json**

It will contain the history of all commands of the user, so that they can scroll through it. It is managed by the `enquirer` package used by us to ask questions. It is of the following format:

```JSON
{
  "values": {
    "past": [
      "ls",
      "cd Work",
      "ls",
      "q"
    ],
    "present": ""
  }
}
```

## **src/index.js**

This will contain most of the CLI code. Here is what will happen there:
- First, it will setup the UI - by drawing the Dabbu logo in yellow
- Then it will check if the CLI has been setup by checking for the server_address field
- Then it will go into a REPL loop, reading the command line input, parsing it, calling the appropriate function or client module, and then repeating this process again.

## **src/utils.js**

This file contains all utility methods used by the server.

## **src/modules/provider_id.js**

This wil contain the code related to the client for each provider. Here is what will happen:
- Each client 'module' **must** extend the `Client` class and implement at least the following methods:
  - newInstance()
- The rest of the functions can be left as is, and they will by default call the Dabbu API with no extra provider-specific fields in the request body or header.
- Each function will be provided the with the user's command as is. It is upto it to parse it and send a request to the Dabbu server.

A sample provider will be as follows:

```Javascript
// MARK: Imports

// You usually need all these imports
// Colourful ASCII output
const chalk = require("chalk")
// CLI Spinner
const ora = require("ora")
// Hyperlinked text in terminal
const link = require("terminal-link")
// HTTP requests to the Dabbu server
const axios = require("axios")
// Get or set values from the client
const store = require("data-store")({ path: "../config/dabbu_cli_config.json" })
// Input from the enquirer
const { Input } = require("enquirer")
// Util methods
const { waterfall, ask, replaceAll, parsePath, error } = require("../utils.js")
// Create a nice table in terminal to show the list and cat results
const Table = require("cli-table3")

// Import the client class
const Client = require("./client.js").default

// Our custom client
class ClientForSomeProvider extends Client {
  // Constructor is required. Don't put anything in here, handle everything separately in the functions.
  constructor() {
    super()
  }

  async newInstance() {
    // Code to setup a new instance - Look at the HardDriveClient for an example of how to setup an instance
    const askForInstanceName = function() {
      return new Promise((resolve, reject) => {
        ask(new Input({
          name: "instanceName",
          message: "What should this instance be named (usually a single letter, like a drive name):",
          initial: "c"
        }))
        .then(instanceName => {
          store.set("current_instance_id", instanceName)
          store.set(`instances.${instanceName}.provider_id`, "hard_drive")
          resolve(instanceName)
        })
        .catch(err => {
          error(err.message)
          exit(1)
        })
      })
    }

    const askForVariable = function(instanceName) {
      return new Promise((resolve, reject) => {
        console.log(
          chalk.yellow([
            "Some info on the variable you need...",
            "Usually should include instructions on how",
            "to get to know the value to put in there"
          ],join("\n"))
        )
        ask(new Input({
          name: "variableName",
          "message": "Enter your variable value:"
        }))
        .then(variableName => {
          store.set(`instances.${instanceName}.variable_name`, variableName)
          console.log(chalk.blue(`Created ${instanceName}: successfully!`))
          resolve()
        })
        .catch(err => {
          error(err.message)
          exit(1)
        })
      })
    }

    return waterfall([
      askForInstanceName,
      askForVariable
    ])
  }
}

// Export it as the default export. Try NOT to export anything else.
exports.default = ClientForSomeProvider
```
