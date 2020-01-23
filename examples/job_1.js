
// NOTE base chaining example
// update your `uid` when doing concurent chaining
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

    var uid = 'job_1'
    var d1 = [{ name: 'alex', age: 20 }] // _ri = 0
    var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
    var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
    var d4 = ['a', null, false] // _ri = 6,7,8

    var nn = prm.set(d1, uid)
        .set(d2)
        .set(d3) // add data to this item
        // .set(exampleData(5), 'index11')
    // .of(uid)

        .from(0)
        .range(1, 4)
        // .only(1)
        // .filter(z => {
        //     return z.dataSet.age === 66
        // })
        .compute(item => {
            // NOTE do some calculation for `each` item, must return 1 item
            // if (item._ri===0) // do something
            item.dataSet.age += 20
            item.dataSet.status = 'single'

            item.complete = true // when set will force to delete uppon resolution, only if all of `job_1` are complete

            return item
        }, 'each') // ignored.. We are chaining only one job
        // if provided `index11` internal value will change, need to specify what to resolution
        .markDone(uid) // ignore set for uid:job_1 from future updates
        .set(d3, 'job_2')
        .filter(z => {
            return z.age < 36
        })
        .compute(item => {
            item.dataSet = 50
            item.complete = true
            return item
        }, 'each')
        .resolution(null, 'job_1').d
    const n2 = prm.resolution(null, 'job_2').d

    notify.ulog({ job_2: n2 })
}
