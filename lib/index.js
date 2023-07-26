const core = require('@actions/core')
const fs = require('fs')
const github = require('@actions/github')
const {exec} = require('child_process')
const { promisify } = require('util');
const {parseCompare} = require('./functions')
const glob = require('glob')

async function readBranchFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, data) => {
      if (error) {
        console.error(`Error reading file: ${filePath}`)
        return {}
      }

      try {
        const jsonObject = JSON.parse(data.toString())
        resolve(jsonObject)
      } catch (parseError) {
        console.error('Error parsing file on branch')
        reject(parseError)
      }
    })
  })
}


async function readDefaultFile(tokenPath, defaultBranch) {
  // Sanitize user inputs to avoid command injection
  const sanitizedTokenPath = tokenPath.replace(/[^a-zA-Z0-9_-]/g, ''); // Remove any characters not allowed in the token path
  const sanitizedDefaultBranch = defaultBranch.replace(/[^a-zA-Z0-9_-]/g, ''); // Remove any characters not allowed in the default branch name

  const command = `git show origin/${sanitizedDefaultBranch}:${sanitizedTokenPath}`;

  // Use promisify to convert exec to a promise-based function
  const execPromise = promisify(exec);

  try {
    const { stdout } = await execPromise(command);

    // Since we're parsing JSON, also sanitize the JSON data to prevent potential JSON injections
    const safeJsonObject = JSON.parse(sanitizeJson(stdout));
    return safeJsonObject;
  } catch (error) {
    console.error(`Error reading ${tokenPath}:`);
    return {};
  }
}

function sanitizeJson(jsonString) {
  // Replace any unsafe characters in the JSON string
  return jsonString.replace(/[^a-zA-Z0-9{}[\]:,".\-_ ]/g, '');
}


function createChangeRow(change) {
  return `
| ${change.type} | ${change.name} | \`${change.old}\` | \`${change.new}\` |`
}

async function writeComment(body) {
  const repoToken = core.getInput('repo-token', {required: true})
  const octokit = github.getOctokit(repoToken)
  const context = github.context
  const {pull_request} = context.payload
  await octokit.rest.issues.createComment({
    ...context.repo,
    issue_number: pull_request.number,
    body: body
  })
}
async function compare() {
  console.log('start compare');
  
  core.debug('running')
  try {
    const defaultBranch = core.getInput('default-branch', {required: false})
    const fileList = core.getInput('files', {required: true})
    let files = []
    const filePatterns = fileList.split(',')
    for (const filePattern of filePatterns) {
      const matchedFiles = glob.sync(filePattern.trim())
      files.push(...matchedFiles)
    }

    let body = `
  | Type | Token Name | Old Value | New Value |
  | ---- | ---- | ----- | --- |`

    let changes = []

    core.debug(`Files: ${files}`)
    for (const file of files) {
      const mainTokens = await readDefaultFile(file, defaultBranch)
      const branchTokens = await readBranchFile(file)
      core.debug(`comparing main: ${mainTokens}`)
      core.debug(`comparing branch: ${branchTokens}`)
      const output = parseCompare(mainTokens, branchTokens)
      output.map((change) => {
        changes.push(change)
        const newLine = createChangeRow(change)
        body += newLine
      })
    }

    if (changes.length > 0) {
      await writeComment(body)
    } else {
      core.info('No changes found')
    }

    core.setOutput('changes', changes)
  } catch (error) {
    core.setFailed(error)
  }
}

console.log('before compare')
compare()