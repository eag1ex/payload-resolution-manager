'use strict'
/* eslint-disable */
const examplesINIT = () => {
    const notify = require('../libs/notifications')()
    const PayloadResolutioManager = require('../libs/prm/payload.resolution.manager')(notify)
    var debug = true
    const resx = new PayloadResolutioManager(debug, {
        strictMode: true, // make sure jobs of the same uid cannot be called again!
        // onlyCompleteSet: true, // `resolution` will only return dataSets marked `complete`
        // batch: true, // after running `resolution` method, each job that is batched using `batchReady([jobA,jobB,jobC])`, only total batch will be returned when ready
        resSelf: true, // allow chaning multiple resolution
        autoComplete: true // auto set complete on every compute iteration within `each` call
    })

    var exampleData = (id = 0) => {
        var data = {
            // each item in array is 1 payload
            0: [{ name: 'mike', age: 20 }, { name: 'alex', age: 50 }, { name: 'john', age: 25 }, { name: 'cris', age: 22 }],
            1: [{ name: 'john', age: 22 }, { name: 'mary', age: 15 }, { name: 'denny', age: 19 }, { name: 'gery', age: 55 }, { name: 'greg', age: 66 }],
            2: [{ name: 'daniel', age: 35 }, { name: 'lary', age: 65 }, { name: 'andy', age: 54 }],
            3: [{ name: 'jamie', age: 31 }, { name: 'derick', age: 44 }, { name: 'lily', age: 21 }, { name: 'marcus', age: 68 }, { name: 'alexander', age: 44 }, { name: 'derick', age: 77 }],
            4: [[1], [2]],
            5: ['a', [], {}, null, false, 1, new Function()]
        }
        if (data[id] === undefined) throw (`invalid id provided ${id}`)
        return data[id]
    }

    notify.ulog(`uncomment each example to see the output in console`)
    const job_1 = require('./job_1')(resx, exampleData, notify)
    // const job_2 = require('./job_2')(resx, exampleData, notify)
    // const job_2 = require('./job_2')(resx,exampleData,notify)
    // notify.ulog({ job_2 })

    // const job_3 = require('./job_3')(resx,exampleData,notify)
    // notify.ulog({ job_3 })
    notify.ulog({ job_1 })
} // examplesINIT
examplesINIT()

const APP_PROJECT = () => {
    const AppProject = require('./app.project.example/app')()
    new AppProject(false)
}
//APP_PROJECT()
//const completionExample = require('./app.completion.example')
//const asyncExample = require('./app.async.example')
//const mixedExample = require('./app.example')

