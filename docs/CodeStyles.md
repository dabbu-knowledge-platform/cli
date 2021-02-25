# Coding Style

These are the style guidelines for coding in Dabbu.

Run `npm run format` before committing changes to Github to make sure it passes style checks once pushed to the repository.

## General Code

- Heavily comment your code after it works, explaining exactly what each line does.
- End files with a newline.
- Use two spaces instead of tabs for indentation.
- Place requires in the following order:
  - Dependencies (such as `fs-extra`)
  - Built in Node Modules (such as `path`)
  - Local Modules (using relative paths) (include `.js` at the end of the module name)
- Avoid platform-dependent code:
  - Use the parsePath function in `utils.js` to parse a path (though the CLI only accepts forward slashes as a delimeter)
- Using a plain `return` when returning explicitly at the end of a function.
  - Not `return null`, `return undefined`, `null` or `undefined`

## JavaScript

- Write [standard](https://www.npmjs.com/package/standard) JavaScript style.
- File names and variables in JSON files should be concatenated with `_` instead of `-`, e.g.
  `provider_id.js` rather than `provider-id.js`.
- Use newer ES6/ES2015 syntax where appropriate
  - [`const`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const)
    for requires and other constants. If the value is a primitive, use uppercase naming (eg `const NUMBER_OF_RETRIES = 5`).
  - [Arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
    instead of `function () { }`
  - [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
    instead of string concatenation using `+`

## Naming Things

- When naming classes like `HardDriveClient`, use `PascalCase`.
- When naming variables like `authCode`, use `camelCase`.
- For constants like `REQ_TIMEOUT`, use `ALL_CAPS`.
