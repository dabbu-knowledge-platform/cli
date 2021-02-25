# Contributing to Dabbu

First off, thanks for taking the time to contribute!

The following is a set of guidelines for contributing to Dabbu.
These are just guidelines, not rules, use your best judgment and feel free to
propose changes to this document in a pull request.

## Issues

You can contribute to Dabbu by reporting bugs, fixing bugs, adding features, and spreading the word! If you want to report a bug, create an issue by clicking [here](https://github.com/gamemaker1/dabbu-cli/issues/new/choose). While creating an issue, try to follow the Bug report or Feature request template.

## Pull requests

### Step 0: Install `git`, `nodejs` and `npm`

- `git` **must** be installed to make pull requests and push changed code.
  - To check if git is already installed, type `git --version` in terminal/command prompt. You should see a version number displayed after running this command.
  - [Here](https://github.com/git-guides/install-git) are the official instructions to install git for all platforms in case you haven't installed it already.
- `nodejs and npm` **must** be installed to run the server locally
  - To check if nodejs is already installed, type `node --version && npm --version` in terminal/command prompt. You should see two version numbers displayed after running this command.
  - [Here](https://nodejs.org/en/download/package-manager/) are the official instructions to install nodejs and npm for all platforms in case you haven't installed it already.
- `pkg` **must** be installed to build the server
  - To check if pkg is installed, type `pkg --version` in terminal/command prompt. You should see a version number displayed after running this command.
  - [Here](https://www.npmjs.com/package/pkg#usage) are the official instructions to install pkg for all platforms in case you haven't installed it already. (Requires nodejs and npm)

### Step 1: Fork

Fork the project [on the GitHub site](https://github.com/gamemaker1/dabbu-cli) and clone your fork locally.

Run the following to clone your fork locally:

```sh
$ git clone https://github.com/<your-username>/dabbu-cli
$ cd dabbu-cli
$ git remote add upstream https://github.com/gamemaker1/dabbu-cli.git
$ git fetch upstream
```

### Step 2: Build

All you need to do to build is run `npm build`. If the command runs successfully, there should be 3 files (`dabbu-cli-linux`, `dabbu-cli-macos` and `dabbu-cli-win.exe`) in the `dist/` folder. These are the executables that can be run on linux, macos and windows respectively without installation of external dependencies.

Once you've built the project locally, you're ready to start making changes!

### Step 3: Branch

To keep your development environment organized, create local branches to hold your work. These should be branched directly off of the `main` branch. While naming branches, try to name it according to the bug it fixes or the feature it adds.

```sh
$ git checkout -b my-branch-name -t upstream/main
```

### Step 4: Code

To get a decent idea of how the code is organised and what happens where, read [this](./docs/Code.md) file. Also, the code is heavily commented to allow you to understand exactly what happens. Remember to also read through the [Code Style Guidelines](./docs/CodeStyles.md) before starting to write code.

To test a change without building the executables, you can type `npm start` and it will run the server directly. To format the code using prettier, run `npm run format`.

### Step 5: Commit

It is recommended to keep your changes grouped logically within individual commits. Many contributors find it easier to review changes that are split across multiple commits. There is no limit to the number of commits in a pull request.

```sh
$ git add my/changed/files
$ git commit
```

Note that multiple commits often get squashed when they are landed.

**Commit message guidelines**

A good commit message should describe what changed and why. This project uses [semantic commit messages](https://conventionalcommits.org/) to streamline the release process.

Before a pull request can be merged, it **must** have a pull request title with a semantic prefix.

Examples of commit messages with semantic prefixes: (Also, note that they must be in present tense)

- `fix: fix crash in Google Drive client`
- `feat: add MS OneDrive client for CLI`
- `docs: fix typo in README.md`

Common prefixes:

- `fix`: A bug fix
- `feat`: A new feature
- `docs`: Documentation changes
- `perf`: A code change that improves performance
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `style`: Changes that do not affect the meaning of the code (linting)
- `vendor`: Bumping a dependency like node or express

Other things to keep in mind when writing a commit message:

- The first line should:
  - contain a short description of the change (preferably 50 characters or less, and no more than 72 characters)
  - be entirely in lowercase with the exception of proper nouns, acronyms, and the words that refer to code, like function/variable names
- Keep the second line blank.
- Wrap all other lines at 72 columns.

**Breaking Changes**

A commit that has the text `BREAKING CHANGE:` at the beginning of its optional body or footer section introduces a breaking API change (correlating with Major in semantic versioning). A breaking change can be part of commits of any type, e.g., a `fix:`, `feat:` & `chore:` types would all be valid, in addition to any other type.

See [conventionalcommits.org](https://conventionalcommits.org) for more details.

### Step 6: Rebase

Once you have committed your changes, it is a good idea to use `git rebase` (_NOT `git merge`_) to synchronize your work with the main repository.

```sh
$ git fetch upstream
$ git rebase upstream/main
```

This ensures that your working branch has the latest changes from `gamemaker1/dabbu-cli` main.

### Step 7: Test

Bug fixes and features should always come with tests. Please test your own code adequately. Also, before finally pushing your code, clone it into a fresh environment (different user or maybe a different computer) and make sure it works just as fine. Make sure you test the executables in the `dist/` directory, not just the \*.js files.

### Step 8: Push

Once your commits are ready to go - with adequate testing - begin the process of opening a pull request by pushing your working branch to your fork on GitHub.

```sh
$ git push origin my-branch-name
```

### Step 9: Opening the Pull Request

From within GitHub, opening a new pull request will present you with a template that should be filled out.

### Step 10: Discuss and update

You will probably get feedback or requests for changes to your pull request. This is a big part of the submission process so don't be discouraged! Some contributors may sign off on the pull request right away. Others may have detailed comments or feedback. This is a necessary part of the process in order to evaluate whether the changes are correct and necessary.

To make changes to an existing pull request, make the changes to your local branch, add a new commit with those changes, and push those to your fork. GitHub will automatically update the pull request.

```sh
$ git add my/changed/files
$ git commit
$ git push origin my-branch-name
```

There are a number of more advanced mechanisms for managing commits using `git rebase` that can be used, but are beyond the scope of this README.

Feel free to post a comment in the pull request to ping reviewers if you are awaiting an answer on something.

**Approval and Request Changes Workflow**

All pull requests require approval from a [Code Owner](https://github.com/dabbu-cli/blob/main/.github/CODE_OWNERS) of the area you modified in order to land. Whenever a maintainer reviews a pull request they may request changes. These may be small, such as fixing a typo, or may involve substantive changes. Such requests are intended to be helpful, but at times may come across as abrupt or unhelpful, especially if they do not include concrete suggestions on _how_ to change them.

Try not to be discouraged. Try asking the maintainer for advice on how to implement it. If you feel that a review is unfair, say so or seek the input of another project contributor. Often such comments are the result of a reviewer having taken insufficient time to review and are not ill-intended. Such difficulties can often be resolved with a bit of patience. That said, reviewers should be expected to provide helpful feedback.

### Step 11: Landing

In order to land, a pull request needs to be reviewed and approved by at least one Code Owner. After that, if there are no objections from other contributors, the pull request can be merged.

**Congratulations and thanks a lot for your contribution!**
