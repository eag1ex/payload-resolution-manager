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

    const job_2 = require('./job_2')(resx, exampleData, notify)
    // const job_2 = require('./job_2')(resx,exampleData,notify)
    // notify.ulog({ job_2 })

    // const job_3 = require('./job_3')(resx,exampleData,notify)
    // notify.ulog({ job_3 })
    notify.ulog({ job_2 })
} // examplesINIT
    // examplesINIT()


const completionExample = require('./app.completion.example')








// example 1
// var uid = 'index1'
// var a = resx.set(exampleData(2), uid).d
// var b = resx.set(exampleData(1), uid).d
// notify.ulog({ b }) // will return combined for `a and b`
// resx.markDone(uid) // once marked cannot add anymore `set` of the same `index1`
// var resolution_index1Data = resx.resolution(null, uid) // return final data and delete from class
// notify.ulog({ resolution_index1Data })
// end

// example 2
// var uid = 'index5'
// var a = resx.set(exampleData(3), uid).d
// // notify.ulog({ a }) // will return only for `a`
// var b = resx.set(exampleData(2), 'index3').d
// // notify.ulog({ b }) // will return only for `b`
// resx.compute(item => {
//     // NOTE do some calculation, must pass same array size as initial data
//     item = [[], [], [], [], [], ['abc']]
//     return item
// }, 'all',uid)
// // updated value for `index5`
// var updated = resx.getSet(uid, true).d
// notify.ulog({ updated }) // return latest update from compute before calling resolution

// var resolution_index5Data = resx.resolution(null, uid) // return final data, only delete data for `index5`, `index3` will still remain
// notify.ulog({ resolution_index5Data })
// end

// example 2a
// var uid = 'index5'
// var a = resx.set(exampleData(5), uid).d
// // notify.ulog({ a }) // will return only for `a`
// // var b = resx.set(exampleData(2), 'index3').d
// // notify.ulog({ b }) // will return only for `b`
// // resx.compute(item => {
// //     // NOTE with `each` option callback runs thru each item, you must return 1 item
// //     //  item.dataSet.age += 20
// //     return item
// // }, 'each',uid)
// // updated value for `index5`
// var updated = resx.getSet(uid, true).d
// notify.ulog({ updated }) // return latest update from compute before calling resolution

// var resolution_index5Data = resx.resolution(null, uid) // return final data, only delete data for `index5`, `index3` will still remain
// notify.ulog({ resolution_index5Data })

// example 3
// var a = resx.set(exampleData(2), 'index6').d
// var b = resx.set(exampleData(1), 'index6').d
// var c = resx.set(exampleData(3), 'index6').d
// resx.markDone('index6') // if set, any set for the same `uid` will be ignored

// var d = resx.set(exampleData(0), 'index6').d // data from exampleData(0) is never added to `index6`
// notify.ulog({ d }) // will return from `a,b,c`. Data from `d`is ignored!

// var resolution_index6Data = resx.resolution(null, 'index6') // return final data and delete from class
// notify.ulog({ resolution_index6Data })
// end

// example 4, formated
// resx.set(exampleData(2), 'index7').d
// var d = exampleData(2) // correct array size
// var d = exampleData(3) // will produce an error since provided data is wrong array size!
// var formated = resx.formated(d, 'index7') // use this to return formated item before you call `resolution(...)` method
// notify.ulog({ formated })
// // end
// // example 5, itemData
// var d = resx.set(exampleData(2), 'index8').d
// notify.ulog({ index8_d: d })

// // above example looks like this:
// // NOTE set `dataRef` to `set` to ge the output
// // var d = exampleData(2).map((z, i) => {
// //     z.set = { name: z.name, age: z.age } // <<
// //     z._uid = `index8`
// //     z._ri = i
// //     return z
// // })

// var itemData = resx.itemData(d, 'index8' /** ,dataRef:`set`**/) // return data without  `_uid` `_ri` references
// notify.ulog({ itemData })
// end

// example 6, chaining
// NOTE you can chain methodes as well
// make sure that you update your `uid` when doing concurent chain with different `uid`
// var a = resx.set(exampleData(2), 'index9')
//     .set(exampleData(1))
//     // .set(exampleData(3), 'index1') // as explained above this would only produce resolution for `uid:index1`

//     .compute(item => {
//         // NOTE do some calculation, must pass same array size as initial data
//         // item = [[], [], [], [], [], [], [], []]
//         return item
//     },'all',/** ,uid */)

//     // set doDelete=false if you do not wish to delete you data from the arch
//     .resolution(/** customData, `index9`, doDelete=true */)

// notify.ulog({ index9_a: a })
// end

// example 7, chaining
// NOTE you can chain methodes as well
// make sure that you update your `uid` when doing concurent chain with different `uid`
// var a = resx.set(exampleData(2), 'index10')
//     .set(exampleData(1))
//     .set(exampleData(3)) // add data to this item
// // .set(exampleData(5), 'index11')
//     .compute(item => {
//         // NOTE do some calculation for `each` item, must return 1 item
//         item.dataSet.age += 20
//         return item
//     }, 'each',null) // we ignored `uid:null` since we are chaining only one job
//     // if we provided `index11` internal value will change, need to specify what to resolution!
//     // .markDone(/*uid*/) // will ignore set for uid:index10 from future updates
//     .set(exampleData(5))
//     .resolution()
//     // .resolution(/** customData, `index11`, doDelete=true */)
// notify.ulog({ index10_a: a })
