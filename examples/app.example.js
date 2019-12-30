
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
var job60 = 'job_60'
var job70 = 'job_70'
var d1 = [{ name: 'alex', age: 20 }, { name: 'jackie', age: 32 }] // _ri = 0,1
var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 2,3
var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 4,5,6
var d4 = [{ name: 'mayson', age: 27 }, { name: 'bradly', age: 72 }, { name: 'andrew', age: 63 }] // _ri = 0,1,2

var d = prm.set(d1, job50)
    .set(d2)
    .set(d3)
    .from(3) // will only make computes starting from(number)  < `_ri` index
    .compute(item => {
        // if (item._ri === 3) {
        //  item._uid = '10000_error' // protected cannot be changed
        //  item._ri = '-50'  // protected cannot be changed
        item.dataSet.age = 70
        item.dataSet.occupation = 'retired'
        // } else item.dataSet.occupation = 'stock broker'
        //  item.complete = true // because we set an option for `onlyCompleteSet` we have to set when we are ready, otherwise `resolution` will not return this change and data will still exist
        return item
    }, 'each')
// .markDone() // no future changes are allowed to `job_50`
    .set(d1, job60)
    .compute(items => {
        var allNewItems = items.map((zz, inx) => {
            return { name: zz.dataSet.name, surname: 'anonymous', age: zz.dataSet.age + inx + 1 }
        })
        // return value need to match total length of initial job
        return allNewItems
    }, 'all')

    .of(job50) // of what job
    .from(0) // from what `_ri` index
    .filter((v, index) => { // will return filtered results for compute to manage, leaving the rest unchanged
        return v.dataSet.age < 30
    })
    .compute(item => {
        // make more changes to job_50, starting from `_ri` index
        return item
    }, 'each')
// .resolution(null, job50) // NOTE  since job is not resolved we can see work on it
    .resolution(null, job60).d // since last resolution was `job_60` this job will be returned first
    /**
     * if you prefer to return each resolution seperatry:
     * var d1 = prm.resolution(null,job50).d
     * var d2 = prm.resolution(null,job60).d
     */

notify.ulog({ job60: d })

/**
* PRM Framework can handle delayed jobs very well
* below is an async job uid:`job_50` which hasnt resolved, so we can make more changes
*/
/// update job50 again
setTimeout(() => {
    var d = [{ name: 'danny', age: 15 }, { name: 'jane', age: 33 }, { name: 'rose', age: 25 }] // _ri =  7, 8 ,9
    prm.set(d, job50)
        .compute(item => {
            if (item._ri >= 7) {
                item.dataSet.message = 'job delayed and updated'
            }
            return item
        }, 'each')
        .resolution()
}, 2000)

var delayedJob = (() => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            prm.set(d4, job70)
                .compute(items => {
                    return items.map((zz, inx) => {
                        var orVals = zz.dataSet
                        return Object.assign({}, orVals, { status: 'updated', age: orVals.age + 10 + inx })
                    })
                }, 'all')
                .resolution()
            resolve(true)
        }, 500)
    })
})()

prm.batchReady([job50, job60, job70], 'flat', d => {
    notify.ulog({ batch: d, message: 'delayed results' })
    // NOTE PRM instance cache should be now be cleared/reset
    // notify.ulog({ dataArch: prm.dataArch, grab_ref: prm.grab_ref })
})

/**
     * returns..
    [ { name: 'alex', age: 20 },
     { name: 'jackie', age: 32 },
     { name: 'daniel', age: 55 },
     { name: 'john', age: 70, occupation: 'retired' },
     { name: 'max', age: 70, occupation: 'retired' },
     { name: 'smith', age: 70, occupation: 'retired' },
     { name: 'jane', age: 70, occupation: 'retired' },
     { name: 'danny', age: 15, message: 'job delayed and updated' },
     { name: 'jane', age: 33, message: 'job delayed and updated' },
     { name: 'rose', age: 25, message: 'job delayed and updated' },
     { name: 'mayson', age: 37, status: 'updated' },
     { name: 'bradly', age: 83, status: 'updated' },
     { name: 'andrew', age: 75, status: 'updated' },
     { name: 'alex', surname: 'anonymous', age: 21 },
     { name: 'jackie', surname: 'anonymous', age: 34 } ],
     */

/// //////////////////////////
module.export = true
