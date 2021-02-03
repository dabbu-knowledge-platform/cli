const chalk = require("chalk")
const figlet = require("figlet")

const config = require("data-store")({ path: `${__dirname}/config/dabbu_cli_config.json` })

// Return the fancy text that we can print out
exports.getDrawableText = (text) => {
  // Return it wrapped up as a promise
  return new Promise((resolve, reject) => {
    // Get the text
    figlet.text(text, (err, res) => {
      // In the callback, check for errors
      if (err) {
        // Error occurred, reject
        reject(err)
      } else {
        // Return the printable result
        resolve(res)
      }
    })
  })
}

// Handle an input error while reading user input
exports.handleInputError = (err) => {
  // Check if it is a Ctrl+C
  if (err.code === "SIGINT") {
    // If so, exit without error
    process.exit(0)
  }

  // Else print out the error
  this.printError(err)
}

// Get a variable's value from config
exports.get = (name) => {
  return config.get(name)
}

// Set the value of a variable in config
exports.set = (path, value) => {
  return config.set(path, value)
}

exports.parsePath = (inputPath, currentPath) => {
  if (!inputPath || inputPath === "/") {
    return ""
  }
  
  const folders = inputPath.split("/")
  let finalPath = currentPath.split("/")

  for (let i = 0, length = folders.length; i < length; i++) {
    const folder = folders[i]
    if (folder === ".") {
      continue
    } else if (folder === "..") {
      finalPath.pop()
    } else {
      finalPath.push(folder)
    }
  }

  return finalPath.join("/")
    .replace(/\/\/\/\//g, "")
    .replace(/\/\/\//g, "")
    .replace(/\/\//g, "")
    .replace(/\//g, "")
}

// Wrap the console.log in a print function
exports.print = console.log

// Print out information in yellow
exports.printInfo = (anything) => {
  this.print(
    chalk.yellow(anything)
  )
}

// Print out something important in orange
exports.printBright = (anything) => {
  this.print(
    chalk.keyword("orange").bold(anything)
  )
}

// Print out an error in red
exports.printError = (err) => {
  if (err.response && err.response.data && err.response.data.error && err.response.data.error.message) {
    this.print(
      chalk.red.bold(err.response.data.error.message)
    )
  } else if (err.message) {
    this.print(
      chalk.red.bold(err.message)
    )
  } else {
    this.print(
      chalk.red.bold(err)
    )
  }
}