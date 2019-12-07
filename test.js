
// xpromise for testing
var xp = (() => {
    var xpromise = require('./libs/prm/x.promise')()
    const debug = true
    var uid = null
    const xproms = new xpromise(uid, debug)
    xproms.test()
})()
