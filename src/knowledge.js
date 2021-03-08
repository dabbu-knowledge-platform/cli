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

const fs = require('fs-extra')
const ora = require('ora')
const chalk = require('chalk')
const axios = require('axios')
const prompt = require('readcommand')

const FormData = require('form-data')

const {
  get,
  set,
  getAbsolutePath,
  generateBodyAndHeaders,
  printInfo,
  printBright,
  printFiles,
  getExtForMime,
  printError,
} = require('./utils')

// A helper function to list files in a folder
const listRequest = async (drive, folderPath) => {
  // Generate request body and headers
  let [body, headers] = await generateBodyAndHeaders(drive)

  // Get the server address, provider ID and URL encode the folder path
  let server = get('server')
  let provider = get(`drives.${drive}.provider`)
  let encodedFolderPath = encodeURIComponent(
    folderPath === '' ? '/' : folderPath
  )

  // The URL to send the request to
  let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}?exportType=view`
  // Send a GET request
  let res = await axios.get(url, {
    data: body, // The appropriate request body for this provider
    headers: headers, // The appropriate headers for this provider
  })

  // Check if there is a response
  if (res.data.content.length > 0) {
    // Get the files from the response
    let files = res.data.content
    // Return the files
    return files
  } else {
    // Else return null if it is an empty folder
    return null
  }
}

// A helper function to list files recursively
const listFilesRecursively = (drive, folder, spinner) => {
  // Tell the user which folder we are querying
  spinner.text = `Fetching files in ${chalk.blue(folder)}`
  // An array to hold all the files whose names contain any
  // one of the search terms
  let matchingFiles = []
  // Wrap everything in a promise
  return new Promise((resolve, reject) => {
    // Call the module's list function
    listRequest(drive, folder)
      .then((list) => {
        if (list) {
          // First get all of the files not folders (we do !=== folder)
          // as we might have the "file" and "other" types
          let filesOnlyList = list.filter((item, pos) => {
            return item.kind !== 'folder'
          })

          // Add the matched ones to the final array
          matchingFiles = matchingFiles.concat(filesOnlyList)

          // Now recurse through the remaining folders
          let i = 0
          // Create a function that will walk through the directories
          const next = () => {
            // Current file
            let file = list[i++]
            // If there is no such file, return all the matching
            // files found so far (we've reached the end)
            if (!file) {
              return resolve(matchingFiles)
            }
            if (file.kind === 'folder') {
              // If it's a folder, then call the listFilesRecursively method again
              // with the folder path
              listFilesRecursively(drive, file.path, spinner)
                .then((files) => {
                  // Add the matching files to the matching files array
                  matchingFiles = matchingFiles.concat(files)
                })
                .then(() => next())
            } else {
              // We have already printed and added these files to the array,
              // so continue
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

// The Klient class (Knowledge + Client = Klient) (bad joke)
const Klient = class {
  constructor() {
    this.ops = {
      pwd: this.pwd,
      whereami: this.pwd,
      cd: this.cd,
      changedir: this.cd,
      l: this.list,
      ls: this.list,
      ll: this.list,
      dir: this.list,
      list: this.list,
      cat: this.read,
      read: this.read,
    }
  }

  async init(drive) {
    // Ask the user which providers we should index
    const reqDrivesToIndex = () => {
      return new Promise((resolve, reject) => {
        // Get the user's drives
        let drives = ''
        let driveJson = get('drives')
        for (const drive of Object.keys(driveJson)) {
          drives += `${drive} (${driveJson[drive].provider}), `
        }
        // Tell the user what they need to do
        printInfo(
          [
            'The knowledge drive uses the Dabbu Intel API to extract topics, people and places',
            'from the information stored in your drives. It will then allow you to view all files',
            'regarding a certain topic or regarding a certain person. Pick the drives whose',
            'files we should extract topics, people and places from.',
            '',
            `The current drives setup are => ${drives}`,
          ].join('\n')
        )

        prompt.read(
          {
            ps1: `Enter the names of the drives, separated by commas > `,
          },
          (err, args) => {
            // If there is an error, handle it
            if (err) {
              reject(err)
            } else {
              // If there is no error, get the value
              let drivesToIndex = args.join('')
              // If they haven't entered anything, flag it and ask again
              if (!drivesToIndex) {
                printBright(`Please enter the names of the drives`)
                resolve(reqDrivesToIndex())
              } else {
                // Turn it into an array
                drivesToIndex = drivesToIndex
                  .split(',')
                  .map((val) => val.replace(/:/g, ''))
                  .filter((val) => val && val !== '')
                // Store its value in the config file
                set(`drives.${drive}.vars.drives_to_index`, drivesToIndex)
                // Return successfully
                resolve(drivesToIndex)
              }
            }
          }
        )
      })
    }

    // Ask the user which drives they want to index
    const drivesToIndex = await reqDrivesToIndex()

    // Tell the user what we are going to do
    printBright(
      'Hang on while we fetch and index your files, this might take a long time depending on the number of files...'
    )
    // Show a loading indicator
    const spinner = ora('Loading...').start()

    // The file in which to store the index data
    let indexFilePath = `./.cache/_knowledge/index.json`
    // Create that file
    await fs.createFile(indexFilePath)
    // The json object to write to that file
    let indexJson = { files: [] }

    // For each drive, index all its files
    for (const driveToIndex of drivesToIndex) {
      spinner.text = `Fetching files from ${chalk.blue(driveToIndex)}`
      const files = await listFilesRecursively(driveToIndex, '/', spinner)
      indexJson.files.push(files)
    }

    // Write the data to the file
    await fs.writeFile(indexFilePath, JSON.stringify(indexJson, null, 4))

    spinner.stop()

    // Return succesfully
    return
  }

  // Show the user their current drive and path
  async pwd(args) {
    // Current drive
    const drive = (args[1] || get('current_drive')).replace(/:/g, '')
    // Print the drive name and path
    printInfo(
      `(${get(`drives.${drive}.provider`)}) ${drive}:${get(
        `drives.${drive}.path`
      )}`
    )

    // Return
    return
  }

  // Change the topic the user is viewing
  async cd(args) {
    // The user given relative path
    const inputPath = args[1] || ''

    // Set the path
    set(`drives.${get('current_drive')}.path`, inputPath)

    // Return
    return
  }

  async list(args) {}

  async read(args) {}
}

// Export the class
module.exports.Klient = Klient
