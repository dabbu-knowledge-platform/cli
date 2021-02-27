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

Once the CLI is started for the first time, it will ask you for a server URL. There is a public instance of the server running on [Heroku](https://dabbu-server.herokuapp.com/), but it is recommended (and very easy) to download it to your computer and run it. To setup a server on your own computer, simply follow the instructions [here](https://gamemaker1.github.io/dabbu-server/install)

### Providers supported by Dabbu

Here is a list of providers supported by Dabbu:

- [**Hard drive**](./modules/hard_drive)
- [**Google drive**](./modules/google_drive)
- [**Gmail**](./modules/gmail)
- [**One drive**](./modules/one_drive)