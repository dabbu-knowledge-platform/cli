// MARK - Utility functions, imports and exports

// This runs async/promise returning functions one after the other insted of simultaneously, like Promise.all() would do
function waterfall(functions) {
  var promise = Promise.resolve()

  functions.forEach(func => {
    promise = promise.then(result => func(result))
  })

  return promise
}

// Asks a question using Enquirer
function ask(prompt) {
  return prompt.run()
}

// Replaces all occurrences of the given substrings with another set of substrings
function replaceAll(string, replaceObj) {
  var replacedString = string
  Object.keys(replaceObj).forEach((key) => {
    const replaceWhat = key
    const replaceWith = replaceObj[key]

    if (replacedString.includes(replaceWhat)) {
      replacedString = replacedString.split(replaceWhat).join(replaceWith)
    }
  })
  return replacedString
}

// Return a path from the current path and relative input path
const path = require("path")
function parsePath(currentPath, inputPath) {
  if (inputPath === "/") return "/"
  return path.join(currentPath, inputPath)
}

// Print out a message in red
const chalk = require("chalk")
function error(message) {
  console.log(chalk.redBright(`${message}`))
}

// Kill this process with an exit code
function exit(code) {
  process.exit(code)
}

// MARK: Exports

// Export all the functions declared in this file
module.exports = {
  waterfall, ask, replaceAll, parsePath, error, exit
}