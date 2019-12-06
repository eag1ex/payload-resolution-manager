
var xpromise = require('./libs/prm/x.promise')()

const xp = new xpromise()

xp.test()

setTimeout(() => {
    xp.test()
}, 4000)
