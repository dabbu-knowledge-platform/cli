---
layout: home
title: Installation and setup
nav_order: 2
---

# Installation and setup

The Dabbu CLI is bundled into a single executable file. It is cross-compiled for Linux, MacOS and Windows.

The CLI requires Dabbu Server to be running locally or remotely (you just need to know the server URL) to interact with your files.

### Installation

To install the CLI on your computer, you can simply download the latest version of the CLI [here](https://github.com/gamemaker1/dabbu-cli/releases/latest).

### Running it on your computer

On Windows, simply double click the file to run it (it will be a `.exe`).

On Linux/MacOS, mark the file as an executable by running `chmod u+x path/to/file`. Then simply type in the path to the file in Terminal.

Once the CLI is started for the first time, it will ask you for a server URL. There is a public instance of the server running on [Heroku](https://dabbu-server.herokuapp.com/), but it is recommended (and very easy) to download it to your computer and run it. To setup a server on your own computer, simply follow the instructions [here](https://gamemaker1.github.io/dabbu-server/install).

### Providers supported by Dabbu

Here is a list of providers supported by Dabbu:

- [**Hard drive**](./modules/hard_drive)
- [**Google drive**](./modules/google_drive)
- [**Gmail**](./modules/gmail)
- [**One drive**](./modules/one_drive)

### Usage

Before starting the CLI, always ensure the server is running (if you have installed the server onto your computer).

When the CLI is started, it will always display all the commands and usage instructions.

The CLI is designed to be a command prompt/shell. It uses POSIX commands to interact with files (ls, cd, pwd, cat, mv, cp and rm). The path separator is set to `/` and cannot be changed right now. 

To access files from different providers, you can create a `drive` (like `c:`, `d:`, `e:` on a Windows system). Each drive is an instance of a provider and multiple instances, or drives can be created for a single provider. For example, I may create 3 drives to interact with the files and folders on my Google Drive for three accounts. I may also create a 4<sup>th</sup> drive to interact with the files and folders on my One Drive. I can then list, view, download, copy, move and delete files in all my drives from one place. I can even copy/move files between drives of different providers. For example, I can copy files directly from my Google Drive to One Drive with a single command. 

Here is a brief overview of all commands:

```
Usage: command [options]
  - Anything in <> must be mentioned, while if it is in [], it is optional.
  - All file/folder paths may include drive names.
  - While specifying a folder, please add a / at the end of the folder name.
  - Escape spaces in the file name by surrounding it in quotes.

  pwd - Know your current drive and directory
  cd <relative path to directory> - Move into a directory
  ls [relative path to directory] - List files in a directory
  cat <relative path to file> - Download and open a file
  cp <relative path to file> <relative path to place to copy to> - Copy a file from one place to another
  mv <relative path to file> <relative path to place to copy to> - Move a file from one place to another
  rm <relative path to file> - Delete a file
  <drive name>: - Switch drives (Notice the colon at the end of the drive name)
  :: - Create a new drive
  clear - Clear the screen
  CTRL+C - Exit
```
