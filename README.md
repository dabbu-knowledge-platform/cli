# Dabbu CLI

A CLI that leverages the Dabbu API and neatly retrieves your files and folders scattered online.

## Intro

Tired of having your files and folders randomly scattered about online with multiple companies from Google to Dropbox? Want to access your Google Drive or OneDrive as fast and easily as your hard drive? Well, that's exactly what we have tried doing with Dabbu. We'll let this GIF do the talking:

![](./media/DabbuCLI.gif)

<sub>Dabbu CLI retrieving files from Google Drive</sub>

What you just saw there was Dabbu CLI in action - a simple program in javascript that leverages the Dabbu API to bring your files and folders to your fingertips from all over the web.

**This repo contains the CLI application's source code. To view and install the server that handles API calls from clients like this one, go [here](https://github.com/gamemaker1/dabbu-server).**

## Getting started

The installation can be done manually on Linux, MacOS, Android (Requires Termux) and Windows.

A detailed installation guide can be found [here](./docs/Installation.md).

Here is a brief install guide:
- Install [git](https://github.com/git-guides/install-git) and [nodejs](https://nodejs.org/en/download/package-manager/).
- Install **Dabbu Server** from [here](https://github.com/gamemaker1/dabbu-server#getting-started)
- Then run the following commands in terminal/command prompt:
```sh
$ git clone https://github.com/gamemaker1/dabbu-cli
$ npm install
$ npm start
```
- And the CLI should be running! If there is a problem, post a message on [Github discussions](https://github.com/gamemaker1/dabbu-cli/discussions/categories/q-a) asking for help. We'll only be glad to help you :)

## Usage

Once you have run `npm start` to start the CLI, it will take you through the setup process. Once that is done, here is a brief guide on how to see your files and folders, view them, download them, copy them and delete them. You can access this guide in the CLI by typing `help`.

### Concept of drives in Dabbu

Dabbu allows you to manage your files and folders from multiple sources like your hard drive, google drive, etc. Drives in Dabbu are just like a USB drive or external hard drive attached to your computer, except that you are getting files from Google Drive instead of the attached USB/hard drive. So when you start setup, you will be asked to setup a drive using one of the enabled providers on the server you connect to. Follow the onscreen instructions, and you will be able to access files and folders from that provider. 

To create a new drive, type in the following:

```
::
```

It will then ask you to pick a provider to setup and then you can follow the onscreen instructions to finish setting up the drive.

To switch a drive, type in the following:

```
<drive name>:
```

Notice the `:` at the end. This drive switch syntax has been borrowed from the old DOS style syntax. You are encouraged to name your drive with single letters for easier switching, like `c`, `d`, `e`, etc. So to switch to `d` drive, you would type in the following:

```
d:
```

### List files and folders

To list files and folders in the current folder, type in the following:

```
ls
```

### To move into a folder

To move into a folder, type in the following:

```
cd <path/to/folder>
```

To go back one folder, type in the following:

```
cd ..
```

To the program, `..` stands for previous folder.

### To check what folder you are in

To know what folder you are in, type in the folowing:

```
pwd
```

### To view a file

To view a file/folder in the website/UI that the provider providers (like viewing a Google Doc from your Google Drive on the docs.google.com website), you can click on the link provided when you type in `ls`. To download the file and view it on your computer with an app installed on your computer, type in the following:

```
cat <path/to/file>
```

### To list out files in a folder recursively

To view all the files in a folder and the folders within it, type in the following:

```
tree
```

### To search for a file

To recursively search for a file with any of the mentioned keywords in its name, type in the following:

```
search <path/to/folder/to/search> <keyword 1> <keyword 2> ....
```

To search for files in the current folder, use `.` as the folder path. To search for files in the previous folder, use `..` as the folder path. You can use as many keywords as you like. If the file name contains even one of them, it will be displayed in the result.

### To delete a file or folder

To delete a file, type in the following:

```
rm <path/to/file>
```

To delete a folder and its contents, type in the following:

```
rm <path/to/folder>/ 
```

Notice the / at the end of the path. The / tells Dabbu that you want to delete a folder.

### To copy a file from one place to another

```
cp <path/to/file> <path/to/folder/where/file/should/be/copied>/
```

Notice the / at the end of the path. The / tells Dabbu that you want to copy the file to inside the folder. If you do not put a / at the end, Dabbu will assume you want to copy the file there and rename it to the given name. In the cp command, you can specify paths in different drives by prefixing the paths with the drive name and a `:`, e.g.: 

```
cp c:/Test/SomeFile.pdf d:/Dabbu/
```

will copy the SomeFile.pdf file from the Test folder in `c:` to the Dabbu folder in `d:`.

### To copy the result of a command to clipboard

Suppose you wanted to copy the result of a search command and paste it into  another location. You can do that by adding ` | cp` to the end of the search/list/tree command. For example:

Copy all the files in the current folder to clipboard. Folders will not be copied. To copy folders, use tree.
```
ls | cp
```

Copy all files in the current folder recursively to clipboard
```
tree | cp
```

Copy all the files returned by this search command to clipboard
```
search . dabbu cli server | cp
```

If you want, you can store that set of files under a specific name to be used later. For example, to store the result of a search command under the name `dabbufiles`, you can run the following:

```
search . dabbu cli server | cp dabbufiles
```

### To paste your clipboard

To paste the files on your clipboard, type in the following:

```
pst [name of saved result]
```

If you didn't specify a name while copying the files to clipboard, you do not need to specift a name while using `pst`. (It stores it under the name `default` if you didn't mention any name)

### To view what files are currently copied to clipboard

To view what files are copied to clipboard, type in the following:

```
cp --list
```

## Updating the CLI

To update the CLI, simply run the following commands from the terminal/command prompt:

```sh
$ git pull origin main
```

## Providers supported
- **Hard drive**
- **Google drive**
- **Gmail**
- **One Drive**

*And more to come...!*

### Creating a new provider

**Note: If you want to create a client for a provider supported by the server but not the CLI, please file an issue using the `New client` template [here](https://github.com/gamemaker1/dabbu-cli/issues/new/choose). This is only to let us know that you want to work on the provider and how you plan to go about it. Also, if you need any help on the code, please do ask on [this](https://github.com/gamemaker1/dabbu-cli/discussions/categories/want-to-contribute) Github discussion. We will only be glad to help :)**

## Docs

The code structure is documented in the file [docs/Code.md](./docs/Code.md).

## Issues and pull requests

You can contribute to Dabbu by reporting bugs, fixing bugs, adding features, and spreading the word! If you want to report a bug, create an issue by clicking [here](https://github.com/gamemaker1/dabbu-cli/issues/new/choose). While creating an issue, try to follow the Bug report or Feature request template.

To contribute code, have a look at [CONTRIBUTING.md](./CONTRIBUTING.md).

## Legal stuff

### License - GNU GPL v3

Dabbu CLI - A CLI that leverages the Dabbu API and neatly retrieves your files and folders scattered online

Copyright (C) 2021  gamemaker1

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
