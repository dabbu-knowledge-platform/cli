# Contributing to Dabbu CLI

First off, thanks for taking the time to contribute!

The following is a set of guidelines for contributing to Dabbu CLI. These are just guidelines, not rules, use your best judgment and feel free to propose changes to this document in a pull request.

## Issues

You can contribute to Dabbu CLI by reporting bugs, fixing bugs, adding features, and spreading the word! If you want to report a bug, create an issue by clicking [here](https://github.com/dabbu-knowledge-platform/cli/issues/new/choose). While creating an issue, try to follow the Bug report or Feature request template.

## Pull requests

This guide assumes you are familiar with Github and the command line. If not, [here](https://guides.github.com/activities/hello-world/) is a guide to get started with Github. If you are stuck on something, feel free to ask on [Github Discussions](https://github.com/dabbu-knowledge-platform/cli/discussions/categories/want-to-contribute).

### Step 0: Environment

Install `git`, `nodejs` and `npm`.

#### Git

`git` **must** be installed to make pull requests and push changed code.

- To check if git is already installed, type `git --version` in terminal/command prompt. You should see a version number displayed after running this command.
- [Here](https://github.com/git-guides/install-git) are the official instructions to install git for all platforms in case you haven't installed it already.

#### NodeJS and NPM

`nodejs` and `npm` **must** be installed to run the CLI locally.

- To check if NodeJS and NPM already installed, type `node --version && npm --version` in terminal/command prompt. You should see two version numbers displayed after running this command. For developing Dabbu CLI, we use the LTS version of NodeJS (v14.x)
- [Here](https://nodejs.org/en/download/package-manager/) are the official instructions to install NodeJS and NPM for all platforms in case you haven't installed it already.

### Step 1: Fork

Fork the project [on the GitHub website](https://github.com/dabbu-knowledge-platform/cli) and clone your fork locally.

Run the following in a terminal to clone your fork locally:

```sh
$ git clone https://github.com/<your-username>/cli
$ cd cli
$ git remote add upstream https://github.com/dabbu-knowledge-platform/cli.git
$ git fetch upstream
```

### Step 2: Build

All you need to do to build is run `npm run build`. If the command runs successfully, there should be 4 files (`dabbu-cli-alpine`, `dabbu-cli-linux`, `dabbu-cli-macos` and `dabbu-cli-win.exe`) in the `dist/` folder. These are the executables that can be run on alpine, linux, macos and windows respectively without installation of external dependencies.

Once you've built the project locally, you're ready to start making changes!

### Step 3: Branch

To keep your development environment organized, create local branches to hold your work. These should be branched directly off of the `develop` branch. While naming branches, try to name it according to the bug it fixes or the feature it adds. Also prefix the branch with the type of change it is making. Here is a list of common prefixes:

- `fix/`: A bug fix
- `feature/`: A new feature
- `docs/`: Documentation changes
- `perf/`: A code change that improves performance
- `refactor/`: A code change that neither fixes a bug nor adds a feature
- `test/`: A change to the tests
- `style/`: Changes that do not affect the meaning of the code (linting)
- `build/`: Bumping a dependency like node or express

```sh
$ git checkout -b feature/add-awesome-new-feature -t upstream/develop
```

### Step 4: Code

The code is heavily commented to allow you to understand exactly what happens where.

- `src/index.js` contains UI code.
- `src/client.js` contains code that runs when you type a command into the CLI.
- `src/knowledge.js` contains code related to the special knowledge drive.
- `src/utils.js` contains common functions used by the above files.
- `src/mimes.json` contains data related to the file type you see when you list files in the CLI.

To test a change without building the executables, you can type `npm start` and it will run the CLI directly.

> While running the CLI for the first time, you will be asked to enter the URL to a Dabbu Server. For testing and development purposes, you may use the server hosted on Heroku - https://dabbu-server.herokuapp.com - but for continued use, it is recommended to setup your own server following the instructions [here](https://dabbu-knowledge-platform.github.io/impls/server).

Remember to always format the code using `xo` once you're done.

### Step 5: Document

Once your changes are ready to go, begin the process of documenting your code. The code **must** be heavily commented, so future contributors can move around and make changes easily.

If you are adding new features, or making changes to the behaviour of existing features, make sure you create a separate pull request in the [user docs repository](https://github.com/dabbu-knowledge-platform/dabbu-knowledge-platform.github.io/), and add relevant info to the `impls/cli.md` page. Also add the same changes to the `readme.md` file.

The documentation uses jekyll. To set up jekyll on your computer and make changes to the documentation, follow [this](https://docs.github.com/en/github/working-with-github-pages/testing-your-github-pages-site-locally-with-jekyll) guide.

### Step 6: Test

Before submitting your changes, please run the linter (`xo`):

```
npm test
```

Please ensure that:

- your code passes all lint checks (`xo`)
- your code passes all format checks (`prettier` run by xo) 

If the linter points out errors, try fixing them automatically by running:

```
npm run format
```

The linter will try its best to fix all issues, but certain issues require you to fix them manually.

If you need to disable any lint rules, please make sure that it is really necessary and there is absolutely no better way of writing that piece of code. Disable lint checks for a certain line by entering typing the following before that line:

```
// eslint-disable-next-line some-lint-rule-id
```

To disable lint checks for an entire file (not recommended), enter the following at the top of the file:

```
/* eslint some-lint-rule-id: 0 */
```

All existing and added tests **MUST** pass for the PR to land. If existing tests are already failing on the `develop` branch, ensure that no additional tests fail due to your changes. Note that **no PRs will be merged until the tests on the `develop` branch are fixed and all of them pass**.

### Step 7: Commit

It is recommended to keep your changes grouped logically within individual commits. Many contributors find it easier to review changes that are split across multiple commits. There is no limit to the number of commits in a pull request.

```sh
$ git add my/changed/files
$ git commit
```

Note that multiple commits often get squashed when they are landed.

#### Commit message guidelines

A good commit message should describe what changed and why. This project uses [semantic commit messages](https://conventionalcommits.org/) to streamline
the release process.

Before a pull request can be merged, it **must** have a pull request title with a semantic prefix.

Examples of commit messages with semantic prefixes:

- `fix: don't reload config everytime`
- `feat: add MS OneDrive provider`
- `docs: fix typo in APIs.md`

Common prefixes:

- `fix`: A bug fix
- `feat`: A new feature
- `docs`: Documentation changes
- `perf`: A code change that improves performance
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: A change to the tests
- `style`: Changes that do not affect the meaning of the code (linting)
- `build`: Bumping a dependency like node or express

Other things to keep in mind when writing a commit message:

- The first line should:
  - contain a short description of the change (preferably 50 characters or less, and no more than 72 characters)
  - be entirely in lowercase with the exception of proper nouns, acronyms, and the words that refer to code, like function/variable names
- Keep the second line blank.
- Wrap all other lines at 72 columns.

**Breaking Changes**

A commit that has the text `BREAKING CHANGE:` at the beginning of its optional body or footer section introduces a breaking API change (correlating with Major in semantic versioning). A breaking change can be part of commits of any type, e.g., a `fix:`, `feat:` & `chore:` types would all be valid, in addition to any other type.

See [conventionalcommits.org](https://conventionalcommits.org) for more details.

### Step 8: Rebase

Once you have committed your changes, it is a good idea to use `git rebase` (NOT `git merge`) to synchronize your work with the develop branch.

```sh
$ git fetch upstream
$ git rebase upstream/develop
```

This ensures that your working branch has the latest changes from `dabbu-knowledge-platform/cli` develop. If any conflicts arise, resolve them and commit the changes again.

### Step 9: Push

Once you have documented your code as required, begin the process of opening a pull request by pushing your working branch to your fork on GitHub.

```sh
$ git push origin feature/add-awesome-new-feature
```

### Step 10: Opening the Pull Request

From within GitHub, opening a [new pull request](https://github.com/dabbu-knowledge-platform/cli/compare) will present you with a template that should be filled out.

### Step 11: Discuss and update

You will probably get feedback or requests for changes to your pull request. This is a big part of the submission process, so don't be discouraged! Some contributors may sign off on the pull request right away. Others may have detailed comments or feedback. This is a necessary part of the process in order to evaluate whether the changes are correct and necessary.

To make changes to an existing pull request, make the changes to your local branch, add a new commit with those changes, and push those to your fork. GitHub will automatically update the pull request.

```sh
$ git add my/changed/files
$ git commit
$ git push origin feature/add-awesome-new-feature
```

There are a number of more advanced mechanisms for managing commits using `git rebase` that can be used, but are beyond the scope of this guide. Also, any branch that is being merged must be merged without fast forward, i.e., `git merge --no-ff ...`.

Feel free to post a comment in the pull request to ping reviewers if you are awaiting an answer on something.

**Approval and Request Changes Workflow**

All pull requests require approval from at least one maintainer in order to land. Whenever a maintainer reviews a pull request they may request changes. These may be small, such as fixing a typo, or may involve substantive changes. Such requests are intended to be helpful, but at times may come across as abrupt or unhelpful, especially if they do not include concrete suggestions on _how_ to change them.

Try not to be discouraged. Try asking the maintainer for advice on how to implement it. If you feel that a review is unfair, say so or seek the input of another project contributor. Often such comments are the result of a reviewer having taken insufficient time to review and are not ill-intended. Such difficulties can often be resolved with a bit of patience. That said, reviewers should be expected to provide helpful feedback.

### Step 12: Landing

In order to land, a pull request needs to be reviewed and approved by at least one maintainer. After that, if there are no objections from other contributors, the pull request can be merged.

**Congratulations and thanks a lot for your contribution!**
