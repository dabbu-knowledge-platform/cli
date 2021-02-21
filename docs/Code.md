# Dabbu Code Overview

**If you want to contribute new features or fix a bug or make perfomance improvements, please do read through this document to know how the code is structured.**

## **dabbu_cli_config.json**

It will contain the server address, the current drive, the ID of the provider the current drive is using and all drive-specific details. It is of the following format:

```JSON
{
	"server": "http://localhost:8080",
	"drives": {
		"g": {
			"provider": "google_drive",
			"path": "/Work",
			"auth_meta": {
				"redirect_uri": "http://localhost:8081",
				"client_id": "***************",
				"client_secret": "***************"
			},
			"auth": {
				"access_token": "***************",
				"refresh_token": "***************",
				"expires_at": -1
			}
		},
		"c": {
			"provider": "hard_drive",
			"path": "/Documents",
			"vars": {
				"base_path": "/home/username/"
			}
		}
	},
	"current_drive": "c",
	"setup_done": true,
	"history": [
		"ls",
    "cd"
	],
	"clips": {}
}
```

The config file's fields are all set by the CLI itself and it will reset the file if there is an error parsing the JSON. It is definitely **NOT** recommended to manually edit the file. If you are creating a client for a provider, you can set fields within each drive (like base_path, access_token, etc.), but not any global fields.

## **src/index.js**

This will contain most of the CLI code. Here is what will happen there:
- First, it will setup the UI - by drawing the Dabbu logo in yellow
- Then it will check if the CLI has been setup by checking for the `setup_done` field. If not, then it will begin setup.
- Then it will go into a REPL loop, reading the command line input, parsing it, calling the appropriate function or the client module, and then repeating this process again.

## **src/utils.js**

This file contains all utility methods used by the CLI.

## **src/client.js**

This file contains all code for parsing and handling the user's commands (list, read, create, update, copy, delete)
- Each function will be provided the with the user's command (separated by spaces; the space-escaping part is taken care of). It parses these and sends appropriate requests to the Dabbu Server. It is independent of providers. To add support for a new provider, add it to `src/provider_config.json`

## **src/provider_config.json**

This file contains the variables to configure on setup and the variables to send along with a request to the Dabbu server for each provider. The current file is given below.

While adding a new provider, if the provider has an OAuth2 flow, copy the config from google_drive and paste it, changing the provider ID, the auth_uri, token_uri, scopes and instructions. You can keep the rest of it the same. **Note: the only authorization process supported for now is OAuth2, because that is the default for most providers. If the provider you want to add has a different flow, file an issue under the Feature request category [here](https://github.com/gamemaker1/dabbu-cli/issues/new/choose) and we will add support if possible.**

To add a variable that the provider requires, copy the request body config from hard_drive and paste it, changing the variable ID, the description, prompt, type and path.

The user will be asked to enter values of whichever fields have the flag `user_input_needed` set to true, and they will be stored at the path given in the `path` variable.

```JSON
{
  "providers": {
    "hard_drive": {
      "auth": null,
      "request": {
        "body": {
          "base_path": {
            "user_input_needed": true,
            "description": "The root folder path on your hard drive (on Windows, it is C:\\Users\\<user name>\\) (on Linux, it is /home/<user name>/) (on MacOS, it is /Users/<user name>/)",
            "prompt": "Enter the base path",
            "type": "string",
            "path": "vars.base_path"
          }
        },
        "headers": null
      }
    },
    "google_drive": {
      "auth": {
        "process": "oauth2",
        "auth_uri": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "scopes": "https://www.googleapis.com/auth/drive",
        "instructions": "Open \"https://developers.google.com/drive/api/v3/quickstart/nodejs#step_1_turn_on_the\" in a web browser. Then follow these steps:\n  - Click on the blue \"Enable Drive API\" button,\n  - Fill in the following text boxes with these values,\n    - Name: Dabbu CLI,\n    - Type: Web Server,\n    - Redirect URI: http://localhost:8081,\n  - Copy the client ID and secret given there and paste it here.",
        "path": "auth"
      },
      "request": {
        "body": null,
        "headers": {
          "Authorization": {
            "user_input_needed": false,
            "description": "The access token retrieved from OAuth servers upon user consent",
            "type": "string",
            "path": "auth.access_token"
          }
        }
      }
    },
    "gmail": {
      "auth": {
        "process": "oauth2",
        "auth_uri": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "scopes": "https://www.googleapis.com/auth/gmail.readonly",
        "instructions": "Open \"https://developers.google.com/gmail/api/quickstart/nodejs#step_1_turn_on_the\" in a web browser. Then follow these steps:\n  - Click on the blue \"Enable Drive API\" button,\n  - Fill in the following text boxes with these values,\n    - Name: Dabbu CLI,\n    - Type: Web Server,\n    - Redirect URI: http://localhost:8081,\n  - Copy the client ID and secret given there and paste it here.",
        "path": "auth"
      },
      "request": {
        "body": null,
        "headers": {
          "Authorization": {
            "user_input_needed": false,
            "description": "The access token retrieved from OAuth servers upon user consent",
            "type": "string",
            "path": "auth.access_token"
          }
        }
      }
    },
    "one_drive": {
      "auth": {
        "process": "oauth2",
        "auth_uri": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_uri": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "scopes": "offline_access https://graph.microsoft.com/Files.ReadWrite.All",
        "instructions": "Open \"https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps\" in a web browser. Then do the following:\n  - Click on the \"New Registration\" button.\n  - Fill in the following text boxes with these values\n    - Name: Dabbu CLI\n    - Type: Web\n    - Accounts: Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)\n    - Redirect URI: http://localhost:8081\n  - Then click on the \"Register app\" button. Copy the client ID you get and enter it here.\n  - Then go to \"APIs permissions\" and click on \"Add a permission\" > \"Microsoft Graph API\" > \"Delegated permissions\" > select \"Offline access\" and \"Files.ReadWrite.All\". Then click on \"Add permission\".\n  - Then go to \"Certificates and Secrets and create a new secret and set expiry date to \"Never\". Copy the client secret you get on that webpage and enter it here.",
        "path": "auth"
      },
      "request": {
        "body": null,
        "headers": {
          "Authorization": {
            "user_input_needed": false,
            "description": "The access token retrieved from OAuth servers upon user consent",
            "type": "string",
            "path": "auth.access_token"
          }
        }
      }
    }
  }
}
```
