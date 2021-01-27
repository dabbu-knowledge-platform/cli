// MARK - Utility functions, imports and exports

// This runs async/promise returning functions one after the other insted of simultaneously, like Promise.all() would do
function waterfall(functions) {
  let promise = Promise.resolve()

  functions.forEach(func => {
    promise = promise.then(result => func(result)).catch(err => { error(err.message); exit(1) })
  })

  return promise
}

// Asks a question using Enquirer
function ask(prompt) {
  return prompt.run()
}

// Replaces all occurrences of the given substrings with another set of substrings
function replaceAll(string, replaceObj) {
  let replacedString = string
  Object.keys(replaceObj).forEach((key) => {
    const replaceWhat = key
    const replaceWith = replaceObj[key]

    if (replacedString.includes(replaceWhat)) {
      replacedString = replacedString.split(replaceWhat).join(replaceWith)
    }
  })
  return replacedString
}

// Return a path from the current path and relative input path
function parsePath(currentPath, inputPath) {
  if (inputPath === "/") return ""

  const splitInputPath = inputPath.split("/")
  
  let finalPath = currentPath.split("/")
  for (let i = 0, length = splitInputPath.length; i < length; i++) {
    const folder = splitInputPath[i]
    if (folder) {
      if (folder === ".") {
        continue
      } else if (folder === "..") {
        finalPath.pop()
      } else {
        finalPath.push(`/${folder}`)
      }
    } else {
      continue
    }
  }
  
  return replaceAll(finalPath.join("/"), {"////": "/", "///": "/", "//": "/"})
}

// Get the extension of a file based on its mime type
function getExtFromMime(mimeType) {
  let exts = { 
		"video/3gpp": "3gp",
		"application/octet-stream": "a",
		"application/postscript": "ai",
		"audio/x-aiff": "aif",
		"audio/x-aiff": "aiff",
		"application/pgp-signature": "asc",
		"video/x-ms-asf": "asf",
		"text/x-asm": "asm",
		"video/x-ms-asf": "asx",
		"application/atom+xml": "atom",
		"audio/basic": "au",
		"video/x-msvideo": "avi",
		"application/x-msdownload": "bat",
		"application/octet-stream": "bin",
		"image/bmp": "bmp",
		"application/x-bzip2": "bz2",
		"text/x-c": "c",
		"application/vnd.ms-cab-compressed": "cab",
		"text/x-c": "cc",
		"application/vnd.ms-htmlhelp": "chm",
		"application/octet-stream": "class",
		"application/x-msdownload": "com",
		"text/plain": "conf",
		"text/x-c": "cpp",
		"application/x-x509-ca-cert": "crt",
		"text/css": "css",
		"text/csv": "csv",
		"text/x-c": "cxx",
		"application/x-debian-package": "deb",
		"application/x-x509-ca-cert": "der",
		"text/x-diff": "diff",
		"image/vnd.djvu": "djv",
		"image/vnd.djvu": "djvu",
		"application/x-msdownload": "dll",
		"application/octet-stream": "dmg",
		"application/msword": "doc",
		"application/msword": "dot",
		"application/xml-dtd": "dtd",
		"application/x-dvi": "dvi",
		"application/java-archive": "ear",
		"message/rfc822": "eml",
		"application/postscript": "eps",
		"application/x-msdownload": "exe",
		"text/x-fortran": "f",
		"text/x-fortran": "f77",
		"text/x-fortran": "f90",
		"video/x-flv": "flv",
		"text/x-fortran": "for",
		"application/octet-stream": "gem",
		"text/x-script.ruby": "gemspec",
		"image/gif": "gif",
		"application/x-gzip": "gz",
		"text/x-c": "h",
		"text/x-c": "hh",
		"text/html": "htm",
		"text/html": "html",
		"image/vnd.microsoft.icon": "ico",
		"text/calendar": "ics",
		"text/calendar": "ifb",
		"application/octet-stream": "iso",
		"application/java-archive": "jar",
		"text/x-java-source": "java",
		"application/x-java-jnlp-file": "jnlp",
		"image/jpeg": "jpeg",
		"image/jpeg": "jpg",
		"application/javascript": "js",
		"application/json": "json",
		"text/plain": "log",
		"audio/x-mpegurl": "m3u",
		"text/troff": "man",
		"application/mathml+xml": "mathml",
		"application/mbox": "mbox",
		"text/troff": "mdoc",
		"text/troff": "me",
		"audio/midi": "mid",
		"audio/midi": "midi",
		"message/rfc822": "mime",
		"application/mathml+xml": "mml",
		"video/x-mng": "mng",
		"video/quicktime": "mov",
		"audio/mpeg": "mp3",
		"video/mp4": "mp4",
		"video/mpeg": "mpeg",
		"text/troff": "ms",
		"application/x-msdownload": "msi",
		"application/vnd.oasis.opendocument.presentation": "odp",
		"application/vnd.oasis.opendocument.spreadsheet": "ods",
		"application/vnd.oasis.opendocument.text": "odt",
		"application/ogg": "ogg",
		"text/x-pascal": "p",
		"text/x-pascal": "pas",
		"image/x-portable-bitmap": "pbm",
		"application/pdf": "pdf",
		"application/x-x509-ca-cert": "pem",
		"image/x-portable-graymap": "pgm",
		"application/pgp-encrypted": "pgp",
		"application/octet-stream": "pkg",
		"text/x-script.perl": "pl",
		"text/x-script.perl-module": "pm",
		"image/png": "png",
		"image/x-portable-anymap": "pnm",
		"image/x-portable-pixmap": "ppm",
		"application/vnd.ms-powerpoint": "pps",
		"application/vnd.ms-powerpoint": "ppt",
		"application/postscript": "ps",
		"image/vnd.adobe.photoshop": "psd",
		"text/x-script.python": "py",
		"video/quicktime": "qt",
		"audio/x-pn-realaudio": "ra",
		"text/x-script.ruby": "rake",
		"audio/x-pn-realaudio": "ram",
		"application/x-rar-compressed": "rar",
		"text/x-script.ruby": "rb",
		"application/rdf+xml": "rdf",
		"text/troff": "roff",
		"application/x-redhat-package-manager": "rpm",
		"application/rss+xml": "rss",
		"application/rtf": "rtf",
		"text/x-script.ruby": "ru",
		"text/x-asm": "s",
		"text/sgml": "sgm",
		"text/sgml": "sgml",
		"application/x-sh": "sh",
		"application/pgp-signature": "sig",
		"audio/basic": "snd",
		"application/octet-stream": "so",
		"image/svg+xml": "svg",
		"image/svg+xml": "svgz",
		"application/x-shockwave-flash": "swf",
		"text/troff": "t",
		"application/x-tar": "tar",
		"application/x-bzip-compressed-tar": "tbz",
		"application/x-tcl": "tcl",
		"application/x-tex": "tex",
		"application/x-texinfo": "texi",
		"application/x-texinfo": "texinfo",
		"text/plain": "text",
		"image/tiff": "tif",
		"image/tiff": "tiff",
		"application/x-bittorrent": "torrent",
		"text/troff": "tr" ,
		"text/plain": "txt",
		"text/x-vcard": "vcf",
		"text/x-vcalendar": "vcs",
		"model/vrml": "vrml",
		"application/java-archive": "war",
		"audio/x-wav": "wav",
		"audio/x-ms-wma": "wma",
		"video/x-ms-wmv": "wmv",
		"video/x-ms-wmx": "wmx",
		"model/vrml": "wrl",
		"application/wsdl+xml": "wsdl",
		"image/x-xbitmap": "xbm",
		"application/xhtml+xml": "xhtml",
		"application/vnd.ms-excel": "xlsx",
		"application/xml": "xml",
		"image/x-xpixmap": "xpm",
		"application/xml": "xsl",
		"application/xslt+xml": "xslt",
		"text/yaml": "yaml",
		"text/yaml": "yml",
    "application/zip": "zip",
    "application/vnd.android.package-archive": "apk",
    "application/vnd.google-apps.document": "docx",
    "application/vnd.google-apps.spreadsheet": "xlsx",
    "application/vnd.google-apps.presentation": "pptx",
    "application/vnd.google-apps.drawing": "png",
    "application/vnd.google-apps.script+json": "json"
  }
  return exts[mimeType]
}

// Print out a message in red
const chalk = require("chalk")
function error(message) {
  console.log(chalk.redBright(`${message}`))
}

// Kill this process with an exit code
function exit(code) {
  process.exit(code)
}

// Handle an axios request error
function handleError(err) {
  if (err.response) {
    // Request made and server responded
    error(`An error occurred: ${err.response.data ? err.response.data.error.message : "Unkown Error"}`)
  } else if (err.request) {
    // The request was made but no response was received
    error(`An error occurred: No response was received from the server: ${err.message}`)
  } else {
    // Something happened in setting up the request that triggered an Error
    error(`An error occurred while sending a request to the server: ${err.message}`)
  }
}

// MARK: Exports

// Export all the functions declared in this file
module.exports = {
  waterfall, ask, replaceAll, parsePath, getExtFromMime, error, exit, handleError
}