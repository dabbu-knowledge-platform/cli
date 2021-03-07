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
const express = require('express')
const open = require('open')

const FormData = require('form-data')

const { nanoid } = require('nanoid')

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
  parseUserInputForPath,
} = require('./utils')

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
        let driveJSON = get('drives')
        for (const drive of Object.keys(driveJSON)) {
          drives += `${drive} (${driveJSON[drive].provider}), `
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
              const varVal = args[0]
              // If they haven't entered anything, flag it and ask again
              if (!varVal) {
                printBright(`Please enter the names of the drives`)
                resolve(reqDrivesToIndex())
              } else {
                // Store its value in the config file
                set(
                  `drives.${drive}.${drives}`,
                  varVal
                    .split(',')
                    .map((val) => val.replace(/:/g, ''))
                    .filter((val) => val && val !== '')
                )
                // Return successfully
                resolve()
              }
            }
          }
        )
      })
    }

    // Ask the user which drives they want to index, then return
    return await reqDrivesToIndex()
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
