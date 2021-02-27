# Dabbu CLI

[![Code Style and Build Check](https://github.com/gamemaker1/dabbu-server/actions/workflows/style_and_build_check.yml/badge.svg)](https://github.com/gamemaker1/dabbu-server/actions/workflows/style_and_build_check.yml)

A CLI that leverages the Dabbu API and neatly retrieves your files and folders scattered online.

## Intro

Tired of having your files and folders randomly scattered about online with multiple providers like Google Drive and One Drive? Want to access all your files and folders using a single, unified interface? Dabbu’s APIs (Application Programming Interfaces) allow you to access your files and folders from any provider (Google Drive, Gmail, Microsoft OneDrive, etc) from a single, unified interface. Behind these APIs is a software layer that connects to these providers and returns your files and folders in one unified format. We'll let this GIF do the talking:

![](./media/DabbuCLI.gif)

<sub>Dabbu CLI retrieving files from Google Drive</sub>

What you just saw there was Dabbu CLI in action - a simple program in javascript that leverages the Dabbu API to bring your files and folders to your fingertips from all over the web.

**This repo contains the CLI application's source code. To view and install the server that handles API calls from clients like this one, go [here](https://github.com/gamemaker1/dabbu-server).**

## Getting started

The installation can be done manually on Linux, MacOS, Android (Requires Termux) and Windows.

- First download the proper [Dabbu Server](https://github.com/gamemaker1/dabbu-server#readme) executable for your platform from its [Releases](https://github.com/gamemaker1/dabbu-server/releases).

- Then download the proper CLI executable for your platform from the [Releases page](https://github.com/gamemaker1/dabbu-cli/releases). (Caution: releases may not work on certain versions of Android, depending on the manafacturer and version.)

- On Windows, simply double click on the file to run it.

- On Linux/MacOS, run the following command in a terminal (assuming you have downloaded the executable to your Downloads folder):

  - On MacOS:

    ```sh
    $ ~/Downloads/dabbu-cli-macos
    ```

  - On Linux:

    ```sh
    $ ~/Downloads/dabbu-cli-linux
    ```

- And the CLI should be running! If there is a problem, post a message on [Github discussions](https://github.com/gamemaker1/dabbu-cli/discussions/categories/q-a) asking for help. We'll only be glad to help you :)

## Updating the CLI

To update the CLI, simply download the new version from the [Releases page](https://github.com/gamemaker1/dabbu-cli/releases).

## Providers supported

- **Hard drive**
- **Google drive**
- **Gmail**
- **One Drive**

_And more to come...!_

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

Copyright (C) 2021 gamemaker1

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
