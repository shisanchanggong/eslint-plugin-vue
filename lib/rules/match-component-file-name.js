/**
 * @fileoverview Require component name property to match its file name
 * @author Rodrigo Pedra Brum <rodrigo.pedra@gmail.com>
 */
'use strict'

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

const utils = require('../utils')
const casing = require('../utils/casing')
const path = require('path')

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'require component name property to match its file name',
      category: undefined,
      url: 'https://github.com/vuejs/eslint-plugin-vue/blob/v5.0.0-beta.5/docs/rules/match-component-file-name.md'
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          extensions: {
            type: 'array',
            items: {
              type: 'string'
            },
            uniqueItems: true,
            additionalItems: false
          },
          shouldMatchCase: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ]
  },

  create (context) {
    const options = context.options[0]
    const shouldMatchCase = (options && options.shouldMatchCase) || false
    const extensionsArray = options && options.extensions
    const allowedExtensions = Array.isArray(extensionsArray) ? extensionsArray : ['jsx']

    const extension = path.extname(context.getFilename())
    const filename = path.basename(context.getFilename(), extension)

    const errors = []
    let componentCount = 0

    if (!allowedExtensions.includes(extension.replace(/^\./, ''))) {
      return {}
    }

    // ----------------------------------------------------------------------
    // Private
    // ----------------------------------------------------------------------

    function compareNames (name, filename) {
      if (shouldMatchCase) {
        return name === filename
      }

      return casing.pascalCase(name) === filename || casing.kebabCase(name) === filename
    }

    function verifyName (node) {
      let name
      if (node.type === 'TemplateLiteral') {
        const quasis = node.quasis[0]
        name = quasis.value.cooked
      } else {
        name = node.value
      }

      if (!compareNames(name, filename)) {
        errors.push({
          node: node,
          message: 'Component name `{{name}}` should match file name `{{filename}}`.',
          data: { filename, name }
        })
      }
    }

    function canVerify (node) {
      return node.type === 'Literal' || (
        node.type === 'TemplateLiteral' &&
        node.expressions.length === 0 &&
        node.quasis.length === 1
      )
    }

    return Object.assign({},
      {
        "CallExpression > MemberExpression > Identifier[name='component']" (node) {
          const parent = node.parent.parent
          const calleeObject = utils.unwrapTypes(parent.callee.object)

          if (calleeObject.type === 'Identifier' && calleeObject.name === 'Vue') {
            if (parent.arguments && parent.arguments.length === 2) {
              const argument = parent.arguments[0]
              if (canVerify(argument)) {
                verifyName(argument)
              }
            }
          }
        }
      },
      utils.executeOnVue(context, (object) => {
        const node = object.properties
          .find(item => (
            item.type === 'Property' &&
            item.key.name === 'name' &&
            canVerify(item.value)
          ))

        componentCount++

        if (!node) return
        verifyName(node.value)
      }),
      {
        'Program:exit' () {
          if (componentCount > 1) return

          errors.forEach((error) => context.report(error))
        }
      }
    )
  }
}