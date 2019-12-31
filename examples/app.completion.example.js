
/**
 * Application, advance chaining example
 * We declared 3 jobs and did some compute to update original data states, the 3rd jobs is delayed. all jobs are returned
 * using `batchReady`
 */
const notify = require('../libs/notifications')()
const PRM = require('../libs/prm/payload.resolution.manager')(notify)

const options = {
    strictMode: true, // make sure jobs of same uid cannot be called again!
    onlyCompleteJob: true, // `resolution` will only return dataSets marked `complete`
    batch: true, // after running `resolution` method, each job that is batched using `batchReady([jobA,jobB,jobC])`, only total batch will be returned when ready
    resSelf: true, // allow chaning multiple resolution
    autoComplete: true // auto set complete on every compute iteration within `each` call
}
const debug = true
const prm = new PRM(debug, options)
var job50 = 'job_50'
// var job60 = 'job_60'

var d1 = [{ name: 'alex', age: 20 }, { name: 'jackie', age: 32 }] // _ri = 0,1
var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 2,3
var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 4,5,6

prm.onUpdate((uid, model) => {
    notify.ulog({ uid, model })
})
var d = prm.set(d1, job50)
    .set(d2)
    .from(3) // will only make computes starting from(number)  < `_ri` index
    .compute(item => {
        item.dataSet.age = 70
        item.dataSet.occupation = 'retired'
        return item
    }, 'each')
    // .set(d3)
    .resolution(null, job50).d // NOTE  since job is not resolved we can see work on it

// .of(job50) // of what job
// .from(0) // from what `_ri` index
// .filter((v, index) => { // will return filtered results for compute to manage, leaving the rest unchanged
//     return v.dataSet.age < 30
// })
// .compute(item => {
//     // make more changes to job_50, starting from `_ri` index
//     return item
// }, 'each')
//

notify.ulog({ job50: d })

prm.batchReady([job50], 'flat', d => {
    notify.ulog({ batch: d, message: 'delayed results' })
    // NOTE PRM instance cache should be now be cleared/reset
    // notify.ulog({ dataArch: prm.dataArch, grab_ref: prm.grab_ref })
})

/// //////////////////////////
module.export = true
