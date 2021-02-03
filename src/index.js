const chalk = require("chalk")
const prompt = require("readcommand")
const { parseCommand } = require("./ops")
const { getDrawableText, handleInputError, get, printBright, printError, set } = require("./utils")

// Main function
function main() {
  // Draw fancy text
  getDrawableText("Dabbu") // Get the text
    .then(printBright) // Print it out
    .then(showPrompt) // Show the user the prompt
    .catch(printError) // Any error should be printed out
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
  // Return the drive and the current path as the PS
  return chalk.cyan(`${drive}:${get(`drives.${drive}.path`)}$ `)
}

function getPromptHistory() {
  return get("history") || []
}

// Start the app
main()
