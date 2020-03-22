require('module-alias/register') // required for javascript alias file name loading

exports.PayloadResolutioManager = require('./prm/payload.resolution.manager')
exports.XPromise = require('./xpromise/XPromise.app').Xpromise
exports.PRM = require('./prm/prm.app').PRM
exports.notify = require('./notifications')()
