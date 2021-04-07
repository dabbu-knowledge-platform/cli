# Dabbu CLI

[![NodeJS CI](https://github.com/dabbu-knowledge-platform/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/dabbu-knowledge-platform/cli/actions/workflows/ci.yml) [![Platforms: Alpine Linux MacOS Windows](https://img.shields.io/badge/platforms-alpine%20linux%20macos%20windows-blue)](https://img.shields.io/badge/platforms-windows%20linux%20macos%20alpine-blue) [![Code Style: XO/Prettier](https://img.shields.io/badge/code%20style-xo%2Fprettier-ff69b4)](https://img.shields.io/badge/code%20style-xo%2Fprettier-ff69b4)

With the Dabbu Knowledge Platform, we aim to rethink the way we organize and traverse large amounts of knowledge, no matter where it is stored. 

Dabbu allows you to access any of your personal information (Gmail, Google Drive, OneDrive, your hard drive, ...) as simple files and folders from Dabbu CLI. 

It not only allows you to seamlessly search/traverse your information across these sources (as simple as `cd`, `ls`), but also move information around between drives (`cp`, `mv`, `sync`) - yes even your Gmail messages in a thread get copied to your hard drive as `.md` files in a zip if you do a `c:/$ cp m:/INBOX/* ./"My Emails"`.

You can also go into the special knowledge drive where you can pivot information by topics/people/places e.g. `k:/$ cd austin` (will return you all your information from Gmail, Google Drive, OneDrive that has a reference to the place Austin). You can further narrow your search by doing `k:/austin$ cd ravi@example.com` (yes it even extracts people and allows you to pivot information by them). This would show you all emails and files that are related to Austin and from/to ravi@example.com. 

All of this has been implemented by abstracting access to providers (you can add more providers as modules) and exposing a unified API for information (no matter where and what form it takes).

The only way to use Dabbu (at the moment) is through a command-line interface (CLI). A web interface is in the works.

## Installation

Excited to use Dabbu? Here's how to get started:

### Linux/MacOS

On Linux/MacOS, simply type the following in your terminal and follow on-screen instructions:

```
wget https://raw.githubusercontent.com/dabbu-knowledge-platform/cli/main/scripts/install -O - | bash
```

Then type `dabbu-cli` to run Dabbu.

To reinstall or update the server, simply run the script again.

#### **Advanced options**

To simply do a dry run, save the install script and then run it with the -d option:

```
wget https://raw.githubusercontent.com/dabbu-knowledge-platform/cli/main/scripts/install
./install -d
```

### Windows

<sub>**An installer script for windows is in progress**</sub>

To install Dabbu on your computer, you can simply download the latest version of it [here](https://github.com/dabbu-knowledge-platform/dabbu-cli/releases/latest).

> Note: It is **recommended** that you move the executable to a separate folder and run it from there. This is because Dabbu will create a folder `_dabbu` which contains several important files. When moving the executable anywhere else, make sure you move the `_dabbu` folder as well.
>
> Windows users will currently **be unable to** access or create files on their hard drive. This will be fixed with the addition of the installer script. A workaround is to use the Linux/MacOS installer script on WSL2.

Once download, simply double click the file to run it (it will be a `.exe`). Read on to know how to setup and use your first drive!

If you run into any problems while installing or using Dabbu, feel free to ask [here](https://github.com/dabbu-knowledge-platform/cli/discussions/categories/q-a). We'll only be glad to help :)

## Getting started

### Setup

Once Dabbu is started for the first time, it will ask you for a server URL (**Only on Windows**). Please enter `https://dabbu-server.herokuapp.com`.

Then, Dabbu will ask you to setup your first 'drive'. A drive is just like a usb drive attached to your computer - `c:`, `d:`, `e:`, etc - but instead of showing files from the USB drive, it shows you files and folders from a certain provider (Gmail, Google Drive, OneDrive, ...). Follow the instructions Dabbu shows you to setup the drive.

You can use several commands to tell Dabbu what you want to do. Read on to know more about how to use them.

### Using commands

#### **The prompt**

Once a drive is created, you will see something called a 'prompt' on the screen. It looks like this:

```
<drive name>:/$ 
```

> For those who are already familiar with the bash shell: Dabbu is sort of a shell, and its commands are very similar to bash commands. Take a look at the [summary of CLI commands](#a-brief-summary-of-cli-commands) for a quick summary of all the commands you can run.

The prompt shows you what drive which folder/directory you are currently in. You can also type `pwd` (short form for **P**rint **W**orking **D**irectory) and hit `enter` to know that information.

#### **Moving around**

Dabbu has a notion of the _current working directory_, which refers to what folder/directory you are currently in. A special symbol, `.` (the full stop), is used to refer to the current folder/directory you are in. Another special symbol, `..` (two full stops), is used to refer to the _parent folder/directory_ of the current working directory. 

The current path is always shown in the prompt after the drive name:

```
<drive name>:<path to folder you are in>$
```

The topmost folder is always called `/` (forward slash). To change folders, type in `cd <folder to move to>/` (`cd` is short form for **C**hange **D**irectory) and hit `enter`. For example, the following command will move you into the directory `Work`:

```
cd Work/
```

**Note**: The forward slash at the end is required - it tells Dabbu that we are talking about a folder.

Now that you have moved into the folder `Work`, the prompt will change to update your current working directory:

```
<drive name>:/Work$
```

To move back into the root folder (`/`), type in `cd ..` (remember that `.` refers to the current working directory, while `..` refers to the parent directory) and hit `enter`. This should move you to the root folder and also update your prompt to show `/` as the current path.

To switch to another drive, type in the following and hit `enter`:

```
<drive name>:
```

Notice the colon at the end - it tells Dabbu that you are talking about a drive.

To create a new drive, simply type in `::` and hit enter.

#### **Listing files and folders**

To list files and folders within the your current working directory, type in `ls`. For example, if I am in the `Work` directory, typing in `ls` will show you a list of the files and folders within the `Work` directory.

Optionally, you can specify which directory's files and folders to list using `ls <directory whose files and folders to list>`. For example, if I am in the root (`/`) directory, I can list files from the `Work` directory by typing `ls Work/` and hitting `enter`.

The `ls` command prints the number of files in that folder (if there are less than 50 files) and a table of the files and folders. The table has 4 columns: `Name`, `Size`, `Type`,`Last Modified Time` and `Actions`. The file/folder name is coloured blue if it is a folder (it also has the words folder written in brackets next to the name) and magenta if it is a file. The size and last modified time are formatted into human readable formats. The type column shows the type of the file. The actions column contains a link that opens the file in the provider's preferred editor. This means that if you click on a link for a from Google Drive, it will open the Google Drive File Viewer to display the file. Use the `cat` command to download and view the file on your computer.

#### **Downloading and viewing files**

To download a file to your computer and open it up, type in `cat <path to file>` and hit `enter`. This will download the file temporarily on your computer and open it using the default app to open that file on your computer. The file will be deleted once Dabbu is closed. For example, to download the file `Dabbu Design Document` in the `Work` folder, type in the following and hit `enter`:

```
cat "Work/Dabbu Design Document"
```

Notice that the path to the file is surrounded by quotes (`"`). This is only required if the file/folder name contains spaces.

If you want to save the file to your hard drive or to another drive, use the `cp` (copy) command as mentioned below.

#### **Copying/moving files**

To copy a file from one drive to another drive, use the `cp` (short form for **c**o**p**y) command as follows:

```
cp <path to file that you want to copy> <path to destination folder>
```

For example, if I want to copy a file (say, `School Project.docx`) from my `Personal` folder on `g:` (where I have set up a Google Drive account) to the `Work` folder on `c:` (where I have set up my hard drive), I would type the following and hit `enter`:

```
cp "g:/Personal/School Project.docx" c:/Work/
```

Notice two things:
- One, the path to the `School Project.docx` file is surrounded by quotes. This is because the file name contains spaces.
- Two, the path to the `Work` folder ends with a `/`. This is to tell Dabbu that `Work` is a folder.

If I want to copy the file `School Project.docx` from my `Personal` folder on `g:` (where I have set up a Google Drive account) to the `Work` folder on `c:` (where I have set up my hard drive) and rename it to `MyProject.docx`, I would type the following and hit `enter`:

```
cp "g:/Personal/School Project.docx" c:/Work/MyProject.docx
```

Notice two things:
- One, the path to the `School Project.docx` file is surrounded by squotes. This is because the file name contains spaces.
- Two, the path to the destination does not end with a `/`. This i because we are copying the file to another file, and not another folder.

To rename a file without copying it, or to move a file instead of copying it, just use `mv` instead of `cp`.

#### **Deleting files**

To delete a file on a certain drive, use the `rm` ((short form for **r**e**m**ove)) command. For example, to delete the file `Dabbu Design Document` in the `Work` folder, type in the following and hit `enter`:

```
rm "Work/Dabbu Design Document"
```

Notice that the path to the file is surrounded by quotes (`"`). This is only required if the file/folder name contains spaces.

To delete the entire work folder:

```
rm Work/
```

Notice that the path to the `Work` folder ends with a `/`. This is to tell Dabbu that `Work` is a folder.

Be careful while using the `rm` command as it usually permanently deletes files and folders.

### Knowledge Drive

The latest version of Dabbu CLI also supports a special `knowledge` drive. This drive will, on startup, **'index'** all your files - it will extract topics, people and places from all the files in the selected drives. It will then treat these topics/people/places as folders, that you can move into using `cd <topic/person/place name>` and view which files are related to which topic.

To setup the `knowledge` drive, simply type in `::` into the Dabbu CLI command prompt and choose `knowledge` as the provider. Follow the instructions on screen to select which drives' files you wish to index. Once the indexing process is over, you may list out the files related to a certain topic/person/place and view the files too.

If any files have changed, you will have to recreate the drive to see the changes. This is being fixed (refer to issue [cli#21](https://github.com/dabbu-knowledge-platform/cli/issues/21) on Github).

### A Brief Summary of CLI Commands

**Note:**

- Anything in <> must be mentioned, while if it is in [], it is optional.
- All file/folder paths may include drive names.
- While specifying a folder, please add a / at the end of the folder name.
- Escape spaces in the file name by surrounding it in quotes.

**Commands:**

- `pwd` - Know your current drive and folder
- `cd <relative path to folder>` - Move into a folder
- `ls [relative path to folder]` - List files in a folder (default is current folder)
- `cat <relative path to file>` - Download and open a file
- `cp <relative path to file> <relative path to place to copy to>` - Copy a file from one place to another
- `mv <relative path to file> <relative path to place to copy to>` - Move a file from one place to another
- `rm <relative path to file>` - Delete a file
- `sync <relative path to folder> <relative path to folder to sync files to>` - Sync files from one folder to another efficiently
- `<drive name>:` - Switch drives (Notice the colon at the end of the drive name)
- `::` - Create a new drive
- `clear` - Clear the screen
- `CTRL+C` - Exit

Typing any of the above and then hitting enter will allow you to execute that command and get a result.

## Providers supported

- **Hard drive**
- **Google drive**
- **Gmail**
- **One Drive**

_And more to come...!_

### Creating a new provider

If you want to create a client for a provider supported by the server but not the CLI, please file an issue using the `New client` template [here](https://github.com/dabbu-knowledge-platform/cli/issues/new/choose). This is only to let us know that you want to work on the provider and how you plan to go about it.

Please read [contributing.md](./contributing.md) for a detailed guide to setting up your environment and making changes to the code.

Also, if you need any help on the code, please do ask on [this](https://github.com/dabbu-knowledge-platform/cli/discussions/categories/want-to-contribute) Github discussion. We will only be glad to help :)

## Docs

The documentation for the CLI can be found on the [website](https://dabbu-knowledge-platform.github.io/impls/cli). The source can be found [here](https://github.com/dabbu-knowledge-platform/dabbu-knowledge-platform.github.io/blob/main/index.md).

## Issues and pull requests

You can contribute to Dabbu by reporting bugs, fixing bugs, adding features, and spreading the word! If you want to report a bug, create an issue by clicking [here](https://github.com/dabbu-knowledge-platform/cli/issues/new/choose). While creating an issue, try to follow the Bug report or Feature request template.

Please read [contributing.md](./contributing.md) for a detailed guide to setting up your environment and making changes to the code.

## Legal stuff

### License - GNU GPL v3

Dabbu CLI - A CLI that leverages the Dabbu API and neatly retrieves your files and folders scattered online.

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
