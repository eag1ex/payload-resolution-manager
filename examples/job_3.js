
// update  example
module.exports = (notify) => {
    const PRM = require('@root').PRM
    var debug = true
    const prm = new PRM(debug, {
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

    var uid = 'job_3'
    var dd = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri= 0,1

    prm.set(dd, uid)
    var nn = prm.get(uid)

    // add {sex:...}
    for (var i = 0; i < nn.length; i++) {
        nn[i].dataSet = Object.assign({}, { sex: 'male' }, nn[i].dataSet)
    }
    prm.updateJob(nn, uid)

    // update second item via updateSet
    prm.updateSet(uid, 1, { sex: 'any' }, 'merge')

    // notify.ulog({ uid_list: prm.getUIDS() })

    notify.ulog({ job_3: prm.get(uid) })
}
