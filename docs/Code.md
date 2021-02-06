# Dabbu Code Overview

**If you want to contribute new features or fix a bug or make perfomance improvements, please do read through this document to know how the code is structured.**

## **src/config/dabbu_cli_config.json**

It will contain the server address, the current drive, the ID of the provider the current drive is using and all drive-specific details. It is of the following format:

```JSON
{
  "server": "http://localhost:8080",
  "current_drive": "c",
  "drives": {
    "c": {
      "provider": "hard_drive",
      "path": "/dabbu-cli",
      "base_path": "/home/user/code"
    },
    "d": {
      "provider": "hard_drive",
      "path": "",
      "base_path": "/home/user/Documents"
    }
  },
  "setup_done": true,
  "history": [
    "ls",
    "cd .."
  ]
}
```

The config file's fields are all set by the CLI itself and it will reset the file if there is an error parsing the JSON. It is definitely **NOT** recommended to manually edit the file. If you are creating a client for a provider, you can set fields within each drive (like base_path, access_token, etc.), but not any global fields.

## **src/index.js**

This will contain most of the CLI code. Here is what will happen there:
- First, it will setup the UI - by drawing the Dabbu logo in yellow
- Then it will check if the CLI has been setup by checking for the `setup_done` field. If not, then it will begin setup
- Then it will go into a REPL loop, reading the command line input, parsing it, calling the appropriate function or client module, and then repeating this process again.

## **src/utils.js**

This file contains all utility methods used by the CLI.

## **src/modules/provider_id.js**

This wil contain the code related to the client for each provider. Here is what will happen:
- Each client 'module' **must** extend the `Client` class and implement all of the methods. If they are not implemented, the command will produce no output.
- Each function will be provided the with the user's commands (separated by spaces; the space-escaping part is taken care of). It is upto it to parse it and send a request to the Dabbu server.

While creating a provider, you may take the `hard_drive` provider as your base and make changes to that code to suit your provider's needs. The code for the `hard_drive` provider is [here](../src/modules/hard_drive.js)
