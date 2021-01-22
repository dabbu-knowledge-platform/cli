# Installation Guide for Dabbu CLI

**Requirements:**
- `git` could be installed (or you could download the source code as a zip file and extract it). [Here](https://github.com/git-guides/install-git) are the official instructions to install git for all platforms in case you haven't installed it already.
- `nodejs and npm` **must** be installed for the CLI to run. [Here](https://nodejs.org/en/download/package-manager/) are the official instructions to install nodejs and npm for all platforms in case you haven't installed it already.

**Important: This CLI relies on a server to fetch your files. To use the CLI, you must either know the URL of a hosted Dabbu server, or run one yourself (it's very easy to run one yourself). To run one yourself, follow the instructions [here](https://github.com/gamemaker1/dabbu-server#getting-started)**

**Install steps:**
- Open a terminal/command prompt.
- If you are using git to get the source code, run this in an empty folder (the code will be downloaded to this folder): `git clone https://github.com/gamemaker1/dabbu-cli .`
- Then type in `npm install`. This will install all the dependencies.
- Then type in `npm start`. This will start the CLI.

**Configuration:**
- Configuration will be done automatically by the CLI if the config file (src/config/dabbu_cli_config.json) is empty or doesn't exist.
