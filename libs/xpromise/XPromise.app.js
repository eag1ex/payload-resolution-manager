
/**
 * @Xpromise Application
 */
const notify = require('../notifications')()
const Xpromise = require('./x.promise')(notify)
exports.Xpromise = Xpromise
