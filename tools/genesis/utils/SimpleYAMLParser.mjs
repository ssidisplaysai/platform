/**
 * SimpleYAMLParser
 *
 * Basic YAML parser for Genesis entity definitions.
 * Handles simple YAML structure without external dependencies.
 *
 * @module tools/genesis/utils/SimpleYAMLParser
 */

/**
 * Parse simple YAML string to object
 * @param {string} yamlString - YAML content
 * @returns {Object} Parsed object
 */
export function parseYAML(yamlString) {
  const lines = yamlString.split('\n');
  const result = {};
  const stack = [result];
  let current = result;
  const indentMap = new Map();
  indentMap.set(0, result);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Get indentation level
    const indent = line.match(/^( *)/)[1].length;
    const content = line.trim();

    // Handle key-value pairs
    if (content.includes(':')) {
      const [key, ...valueParts] = content.split(':');
      const keyTrimmed = key.trim();
      let value = valueParts.join(':').trim();

      // Get parent object based on indentation
      if (indent === 0) {
        current = result;
      } else {
        current = indentMap.get(indent - 2) || result;
      }

      // Handle array values (starting with -)
      if (!current[keyTrimmed]) {
        if (value === '' || value.startsWith('[')) {
          // Look ahead for array items
          const items = [];
          let j = i + 1;
          let arrayIndent = -1;

          while (j < lines.length) {
            const nextLine = lines[j];
            if (!nextLine.trim() || nextLine.trim().startsWith('#')) {
              j++;
              continue;
            }

            const nextIndent = nextLine.match(/^( *)/)[1].length;
            const nextContent = nextLine.trim();

            if (nextContent.startsWith('-')) {
              if (arrayIndent === -1) {
                arrayIndent = nextIndent;
              }
              if (nextIndent !== arrayIndent) {
                break;
              }

              const itemValue = nextContent.slice(1).trim();
              // Check if it's a nested object
              if (j + 1 < lines.length) {
                const peekLine = lines[j + 1];
                if (peekLine.trim() && !peekLine.trim().startsWith('#')) {
                  const peekIndent = peekLine.match(/^( *)/)[1].length;
                  if (peekIndent > arrayIndent && !peekLine.trim().startsWith('-')) {
                    // Nested object in array - parse it
                    const obj = {};
                    let nested = j + 1;
                    while (nested < lines.length) {
                      const nestedLine = lines[nested];
                      if (!nestedLine.trim() || nestedLine.trim().startsWith('#')) {
                        nested++;
                        continue;
                      }
                      const nestedIndent = nestedLine.match(/^( *)/)[1].length;
                      if (nestedIndent <= arrayIndent) {
                        break;
                      }
                      if (nestedLine.trim().startsWith('-')) {
                        break;
                      }
                      const nestedContent = nestedLine.trim();
                      if (nestedContent.includes(':')) {
                        const [nkey, ...nvalues] = nestedContent.split(':');
                        obj[nkey.trim()] = nvalues.join(':').trim();
                      }
                      nested++;
                      j = nested - 1;
                    }
                    items.push(obj);
                  } else {
                    items.push(itemValue);
                  }
                } else {
                  items.push(itemValue);
                }
              } else {
                items.push(itemValue);
              }
              j++;
            } else if (nextIndent > arrayIndent && arrayIndent !== -1) {
              j++;
            } else {
              break;
            }
          }

          if (items.length > 0) {
            current[keyTrimmed] = items;
            i = j - 1;
          } else {
            current[keyTrimmed] = value || {};
          }
        } else {
          // Handle value that could be a boolean or number
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (value === 'null') value = null;
          else if (!isNaN(value) && value !== '') value = Number(value);

          current[keyTrimmed] = value;
        }
      }

      // Mark this level in indentMap for nested objects
      indentMap.set(indent, current[keyTrimmed]);
    }
  }

  return result;
}
