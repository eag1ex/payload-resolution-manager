
const util = require('util')
const { isObject } = require('lodash')
var notify = {}
var color = require('bash-color')
module.exports = function() {
    notify.ulog = (l = false, err = false, strongMessage) => {
        if (err) {
            if (isObject(l) && strongMessage) {
                if (l.message) console.log(color.red(l.message))
            }
            console.log(util.inspect(l, false, null, true), (color.red('ERROR'))) // enable colros
            console.log(color.red('-----------------------'))
            console.log('  ')
        } else {
            if (isObject(l) && strongMessage) {
                if (l.message) console.log(color.blue(l.message))
            }
            console.log(util.inspect(l, false, null, true)) // enable colros
            console.log(color.blue('----'))
        }
    }

    notify.log = (log = false, err = false) => {
        if (err) {
            console.log(color.wrap('ERROR', color.colors.RED, color.styles.hi_background))
            console.log(err)
            console.log(color.red('----'))
        } else {
            console.log(color.green('----'))
            console.log(color.wrap(log, color.colors.GREEN, color.styles.hi_background))
            console.log(color.green('----'))
        }
    }

    return notify
}
