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
  refreshAccessToken,
  generateBodyAndHeaders,
  printInfo,
  printBright,
  getExtForMime,
  printError,
  printFiles,
} = require('./utils')

// A helper function to list files in a folder
const listRequest = async (drive, folderPath) => {
  // First (before parsing further) refresh the access token
  await refreshAccessToken(drive)

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

// A helper function to download a file based on its content URI
const downloadRequest = async (drive, folderPath, fileName) => {
  // The file object (from Dabbu Server), the file data retrieved from its
  // contentURI and the path on the local disk where the file is downloaded
  let file, fileData, localPath
  // Generate request body and headers
  let [body, headers] = await generateBodyAndHeaders(drive)

  // Get the server address, provider ID and URL encode the folder path and file name
  let server = get('server')
  let provider = get(`drives.${drive}.provider`)
  let encodedFolderPath = encodeURIComponent(
    folderPath === '' ? '/' : folderPath
  )
  let encodedFileName = encodeURIComponent(fileName)
  // The URL to send the GET request to
  let url = `${server}/files-api/v1/data/${provider}/${encodedFolderPath}/${encodedFileName}?exportType=media`
  // Send a GET request
  let res = await axios.get(url, {
    data: body,
    headers: headers,
  })

  // Check if a file was returned
  if (res.data.content) {
    // If there is a file, download it
    file = res.data.content
    // If it is a folder, error out
    if (file.kind === 'folder') {
      throw new Error(`Cannot download folder ${file.name}`)
    }
  } else {
    // Else error out
    throw new Error(`${res.response.data.error.message}`)
  }

  // Download the file's data from the content URI
  url = file.contentURI
  if (file && file.contentURI) {
    // If a content URI is provided, download the file
    // Check if it is a file:// URI
    if (file.contentURI.startsWith('file://')) {
      // If so, parse the file path and fetch that using the get-uri library
      res = fs.createReadStream(
        unescape(file.contentURI).replace('file://', '')
      )
      // If there is data, return it
      if (res) {
        fileData = res
      } else {
        // Else error out
        throw new Error("No data received from file's contentURI")
      }
    } else {
      // Else it is a normal url, fetch it using axios
      // Add the headers and body only if they really are
      // needed, else risk getting a 400 Bad request
      let meta = {}
      if (Object.keys(body || {}).length > 0) {
        meta['data'] = body
      }
      if (Object.keys(headers || {}).length > 0) {
        meta['headers'] = headers
      }
      meta['responseType'] = 'stream'
      res = await axios.get(url, meta)
      // If there is data, return it
      if (res.data) {
        fileData = res.data
      } else if (res) {
        fileData = res
      } else {
        throw new Error("No data received from file's contentURI")
      }
    }
  } else {
    // Else return null
    throw new Error('No such file/folder was found.')
  }

  // Pipe the data to a local file
  if (fileData) {
    // Download the file
    // Get the file's extension based on its mime type first
    let ext = getExtForMime(file.mimeType)
    // Path to the file
    localPath = `./_dabbu/_cli/_${provider}/${file.name || file.fileName}`
    localPath = `${localPath}${localPath.includes(ext) ? '' : `.${ext}`}`
    // Create the file
    await fs.createFile(localPath)
    // Open a write stream so we can write the data we got to it
    const writer = fs.createWriteStream(localPath)
    // Pipe the bytes to the file
    fileData.pipe(writer)
    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        // Stop loading
        resolve()
      })
      writer.on('error', reject) // Pass the error back on, if any
    })
  } else {
    // Else return null
    throw new Error('No such file/folder was found.')
  }

  return { localPath: localPath, fileMeta: file }
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
      ct: this.cd,
      changedir: this.cd,
      changetopic: this.cd,
      l: this.list,
      ls: this.list,
      ll: this.list,
      dir: this.list,
      list: this.list,
      op: this.onepager,
      onepager: this.onepager,
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
    let indexFilePath = `./_dabbu/dabbu_knowledge_index.json`
    // Create that file
    await fs.createFile(indexFilePath)
    // The json object to write to that file
    let indexJson = { files: [], topics: {}, people: {}, places: {} }

    // For each drive, index all its files
    for (const driveToIndex of drivesToIndex) {
      // Tell the user what we are doing
      spinner.text = `Fetching files from ${chalk.blue(driveToIndex)}`

      // Fetch the file's metadata recursively
      const files = await listFilesRecursively(driveToIndex, '/', spinner)
      // Add the files to the JSON
      indexJson.files.push(...files)

      // Number of files skipped due to errors
      let skippedFiles = 0

      // Check if there are some files
      if (files && files.length > 0) {
        // If so, fetch the contents of each file using the content URI and index them
        for (const file of files) {
          if (file.kind === 'file') {
            // Tell the user what we are doing
            spinner.text = `Indexing file ${chalk.blue(
              driveToIndex + ':' + file.path
            )}`
            // Get the file name and the folder path
            let fileName = file.name
            let folderPath = file.path.split('/')
            folderPath = folderPath.slice(0, folderPath.length - 1).join('/')

            // Surround with a try-catch
            try {
              // Download the file based on its content URI
              let { localPath, fileMeta } = await downloadRequest(
                driveToIndex,
                folderPath,
                fileName
              )

              // Now get the topics, people and places from the files

              // Make a form data object to upload the files
              const formData = new FormData()
              // Add the file's data as a readable stream to the content field
              formData.append('content', fs.createReadStream(localPath), {
                filename: fileName,
              })

              let extractedData = await axios.post(
                'http://localhost:8079/intel-api/v1/extract-info',
                formData,
                {
                  headers: formData.getHeaders(),
                  maxContentLength: Infinity,
                  maxBodyLength: Infinity,
                }
              )

              // Check if data was returned
              if (extractedData.data && extractedData.data.content) {
                // Check if there were topics extracted
                if (
                  extractedData.data.content.topics &&
                  extractedData.data.content.topics.length > 0
                ) {
                  for (const topic of extractedData.data.content.topics) {
                    if (!indexJson.topics[topic.text]) {
                      indexJson.topics[topic.text] = []
                    }

                    indexJson.topics[topic.text].push(fileMeta)
                  }
                }

                // Check if there were people-related details extracted
                if (
                  extractedData.data.content.people &&
                  extractedData.data.content.people.length > 0
                ) {
                  for (const person of extractedData.data.content.people) {
                    if (!indexJson.people[person.email]) {
                      indexJson.people[person.email] = []
                    }

                    indexJson.people[person.email].push(fileMeta)
                  }
                }

                // Check if there were places extracted
                if (
                  extractedData.data.content.places &&
                  extractedData.data.content.places.length > 0
                ) {
                  for (const place of extractedData.data.content.places) {
                    if (!indexJson.places[place.name]) {
                      indexJson.places[place.name] = []
                    }

                    indexJson.places[place.name].push(fileMeta)
                  }
                }
              }
            } catch (err) {
              // Just print out the error if any one of the files fails and continue
              spinner.stop()
              printError(`Skipping ${fileName}, error encountered: ${err}`)
              skippedFiles++
              spinner.start()
            }
          }
        }
      } else {
        // If there are no files, continue
        continue
      }

      // Write the data to the file (save progress)
      await fs.writeFile(indexFilePath, JSON.stringify(indexJson, null, 2))

      // Tell the user we are finished with that drive
      spinner.stop()
      printBright(
        `Successfully indexed all files in ${driveToIndex}: (${skippedFiles} skipped due to errors)`
      )
      spinner.start()
    }

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
    const inputPath = args[1]
    // The current path in that drive
    const currentPath = get(`drives.${get('current_drive')}.path`) || ''

    // Parse the relative path and get an absolute one
    const finalPath = getAbsolutePath(inputPath, currentPath)
    // Set the path
    set(`drives.${get('current_drive')}.path`, finalPath)

    // Return
    return
  }

  async list(args) {
    // // The user given keyword
    const keyword = args[1] || get(`drives.${get('current_drive')}.path`)

    // Get the indexed files
    let indexJson
    try {
      indexJson = await fs.readJSON('./_dabbu/dabbu_knowledge_index.json')
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(
          `Could not find the index file, ${chalk.yellow(
            './_dabbu/dabbu_knowledge_index.json'
          )}. Try recreating the drive with the same settings again.`
        )
      }
    }

    if (indexJson) {
      // First check what the path is
      // For the root path, simply show them topics, places and people
      if (keyword === '') {
        printInfo('topics  people  places')
      } else if (keyword === '/topics' || keyword === 'topics') {
        printInfo(
          indexJson.topics && Object.keys(indexJson.topics).length > 0
            ? `${Object.keys(indexJson.topics).join('  ')}`
            : 'No topics found'
        )
      } else if (keyword === '/people' || keyword === 'people') {
        printInfo(
          indexJson.people && Object.keys(indexJson.people).length > 0
            ? `${Object.keys(indexJson.people).join('  ')}`
            : 'No people found'
        )
      } else if (keyword === '/places' || keyword === 'places') {
        printInfo(
          indexJson.places && Object.keys(indexJson.places).length > 0
            ? `${Object.keys(indexJson.places).join('  ')}`
            : 'No places found'
        )
      } else {
        // Else find the files with the topic/person/place and show their info
        let path = keyword.split('/')
        if (path.length < 3) {
          set(`drives.${get('current_drive')}.path`, '')
          throw new Error('Invalid path')
        }

        // Each folder is a topic/place/person that the file must be
        // related to to get listed
        let allFiles = []
        let matchingFiles = []
        let numberOfTopics = path.slice(2).length
        for (let i = 2; i < path.length; i++) {
          // If there is a trailing slash, don't consider it a topic
          if (path[i] && path[i] !== '') {
            let files = indexJson[path[1]][path[i]]
            if (files) {
              allFiles.push(...files)
            } else {
              printBright(`Couldn't find topic ${path[i]}`)
            }
          } else {
            // If there is a trailing slash, don't consider it a topic
            numberOfTopics -= 1
          }
        }

        // Check if the user has specified multiple topics
        if (path.length > 3) {
          // Get the files that appear more than once (AND query)
          // Make an array of provider+name of file
          let fileIds = allFiles.map((file) => {
            return `${file.provider}:${file.path}`
          })

          // Get the number of times each file appears
          let occurrences = {}

          let count = (keys) => {
            occurrences[keys] = ++occurrences[keys] || 1
          }
          fileIds.forEach(count)

          // Get the ones that appear n number of times, where
          // n is the number of topics it should match
          for (const fileId of Object.keys(occurrences)) {
            if (occurrences[fileId] === numberOfTopics) {
              // Add it to the final array
              matchingFiles.push(allFiles[fileIds.indexOf(fileId)])
            }
          }
        } else {
          // Else just return the files for the topic we got
          matchingFiles = allFiles
        }

        // Print out the files
        printFiles(matchingFiles, true)
      }
    } else {
      throw new Error(
        `Could not read the index file, ${chalk.yellow(
          './_dabbu/dabbu_knowledge_index.json'
        )}. Try recreating the drive with the same settings again.`
      )
    }
  }

  async onepager(args) {
    throw new Error('Not yet implemented')
  }
}

// Export the class
module.exports.Klient = Klient
