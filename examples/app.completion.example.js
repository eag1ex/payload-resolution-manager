require('module-alias/register') // required for javascript alias file nale loading

/**
 * Application, advance chaining, completion example
 * for example you have delayed job process, it is not async, but you only want jobs in que marked complete to return in final `batchReady` call.
 */

const { PRM, notify } = require('@root')
const options = {
    strictMode: true, // make sure jobs of same uid cannot be called again!
    onlyCompleteSet: true, // (this)`resolution` will only return dataSets marked `complete`
    // onlyCompleteJob: true, // (or this)  `resolution` will only complete whole job marked complete
    batch: true, // after running `resolution` method, each job that is batched using `batchReady([jobA,jobB,jobC])`, only total batch will be returned when ready
    resSelf: true, // allow chaning multiple resolution
    autoComplete: true // auto set complete on every compute iteration within `each` call
}
const debug = true
const prm = new PRM(debug, options)
var job50 = 'job_50'
var job60 = 'job_60'

var d1 = [{ name: 'alex', age: 20 }, { name: 'jackie', age: 32 }] // _ri = 0,1
var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 2,3
var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 4,5,6

// prm.onModelStateChange((uid, model) => {
//     notify.ulog({ uid, model })
// })
prm.set(d1, job50)
    .set(d2)
    .compute(item => {
        item.dataSet.age = 70
        item.dataSet.occupation = 'retired'
        // item.complete = true // NOTE if `autoComplete` is not set you must mark it your self
        return item
    }, 'each')
    .resolution()
    .set(d3, job60)

// .of(job50) // of what job
// .from(0) // from what `_ri` index

    .filter((v, index) => { // filtered results for compute to manage, leaving rest unchanged
        return v.age < 36
    })

// .complete(/**uid*/) // mark job as `complete`
// .resolution()

setTimeout(() => {
    prm.of(job60).compute(item => {
        item.dataSet.occupation = 'senior'
        return item
    }, 'each')
        .markDone()
        .set(d1)// addition would be ignored, we set it as `markDone`
        .resolution()
}, 3000)

/**
 * @batchReady
 * is waiting for resolution, then checks if jobs are compelted, and initiates final callback
 */
prm.batchReady([job50, job60], 'grouped', d => {
    notify.ulog({ batch: d, message: 'delayed results' })
})

/**
 * NOTE batchReady, example return:
    { job_50:
      [ { name: 'alex', age: 70, occupation: 'retired' },
        { name: 'jackie', age: 70, occupation: 'retired' },
        { name: 'daniel', age: 70, occupation: 'retired' },
        { name: 'john', age: 70, occupation: 'retired' } ],
     job_60:
      [ { name: 'max', age: 44 },
        { name: 'smith', age: 66 },
        { name: 'jane', age: 35, occupation: 'senior' } ] },
 */

module.export = true
