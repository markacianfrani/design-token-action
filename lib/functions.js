
const diff = require('deep-diff')

function filterByLastItemIsValue(paths) {
  if (paths.length === 0 || paths[paths.length - 1] !== 'value') {
    // If the last element is not "value" or the array is empty, return an empty array
    return []
  }
  return paths.slice(0, -1)
}


function getName(item) {
  if (item.path) {
    const lastItem = item.path[item.path.length - 1]

    if (lastItem === 'value' || lastItem === '$value') {
      return item?.path?.slice(0, -1).join('-')
    }
  }
  return item.path?.join('-')
}

function getValue(token) {
  if (!token) {
    return 'N/A'
  }
  if (typeof token === 'object') {
    return token.value
  }
  return token
}

function parseCompare(mainTokens, branchTokens) {
  const output = []
  try {
    const result = diff(mainTokens, branchTokens)

    if (result) {
      for (const item of result) {
        const types = {
          E: 'edited',
          N: 'added',
          D: 'deleted'
        }


        if (item.kind === 'E') {
          const itemsOnly = filterByLastItemIsValue(item.path)
          if (itemsOnly.length > 0) {
            output.push({
              //@ts-ignore
              type: types[item.kind],
              name: getName(item),
              old: getValue(item.lhs),
              new: getValue(item.rhs)
            })
          }
        } else {
          output.push({
            //@ts-ignore
            type: types[item.kind],
            name: getName(item),
            old: getValue(item.lhs),
            new: getValue(item.rhs)
          })
        }
      }
    }
    return output
  } catch (e) {
    console.error(e)
    return output
  }
}

module.exports = {
  parseCompare: parseCompare
}
