# v1.3.0 - (2021-11-15)

- Uses a different iv for every encryption to guarantee the GCM security
- Terminates execution if the sources fodler does not exists
- Adds quiet option parameter to print only relevant messages to console
- Adds counters for copied and encrypted files and shows amounts at the end
- Uses native transform stream in place of through2 for encrypting chunks
- Encrypts each individual chunk using copy-recursive transform
- Adds parameter to specify the index page to load for the app or website
- Fixes regexp to account for the presence of internal anchor links
- Adds references to the demo on github pages
- Explains issues with absolute URLs after protect-static and how to solve them
- Adds new utility for password generation with its test coverage
- Ensures source and destination are not the same
- Refactoring of settings module to support test coverage
- Creates info-diagram for protect-static

# v1.2.0-beta.1 - (2021-11-10)

- Adds keywords for npm search

# v1.2.0-beta.0 - (2021-11-10)

- Uses terminal-link package to support clickable URL in console output
- Adds support for hostUrl option to generate protected app URL in output
- Pins rc to 1.2.8
- Updates install instruction with new package name

# v1.1.0-0 - (2021-11-06)

- Adds y option to skip promots and relative updates
- Adds prompt to confirm deletion of destination folder
- Updates documentation relative to command line options and default values
- Adds support for arguments parsing in combination with the rc file
- Renames parameters for source and destination folders
- Adds checks on files existence and terminates accordingly

# v1.0.1-0 - (2021-11-05)

- Adds support for bin file to run from npm scripts of app using the package
- Gives messages during copy operations
- Implements copy via ncp and streams via transform function
- Adds password generator
- Starts creation of npm package with settings read setup
- Adds initial instructions
- Uses an md5 to validate the password at login
- Reads password for encyption from env PROTECT_STATIC_KEY
- Uses message events to pass the password to the service worker and get confirmation
- Styles the login page and starts adding logic to handle password
- Copies the login assets under dist folder for release
- Implements decryption routine in service worker using sample password
- First implementation of encryption using sample password
- Creates initial proof of concept using service worker to decode clear data
