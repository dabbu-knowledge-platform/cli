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

// The Client class, to be extended by all other provider clients
// Declares methods to be implemented by other provider clients
exports.default = class Client {
  constructor() {}

  init(server, name) {}

  ls(server, name, folderPath, vars) {}

  cat(server, name, folderPath, fileName, vars) {}

  upl(server, name, folderPath, fileName, vars) {}

  rm(server, name, folderPath, fileName, vars) {}
}
