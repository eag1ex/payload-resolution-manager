'use strict'
/* eslint-disable */
const notify = require('./libs/notifications')()

const PayloadResolutioManager = require('./payload.resolution.manager')(notify)
var debug = true
const resx = new PayloadResolutioManager(debug)

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

// NOTE base chaining example

// make sure that you update your `uid` when doing concurent chain with different `uid`
var uid = 'job_1'

var d1 = [{ name: 'alex', age: 20 }] // _ri = 0
var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
var d4 = ['a', null, false] // _ri = 6,7,8

var nn = resx.setupData(d1, uid)
    .setupData(d2)
    .setupData(d3) // add data to this item
// .setupData(exampleData(5), 'index11')
    .computation(item => {
        // NOTE do some calculation for `each` item, must return 1 item

        // if (item._ri===0) // do something
        item.dataSet.age += 20
        item.dataSet.status = 'single'
        return item
    }, null, 'each') // we ignored `uid:null` since we are chaining only one job
    // if we provided `index11` internal value will change, need to specify what to finalize!
    .markDone(/*uid */) // will ignore setupData for uid:job_1 from future updates
    .setupData(d4) // ignored
    .finalize()
    // .finalize(/** customData, `index11`, doDelete=true */)
notify.ulog({ job_1_nn: nn })
// returns:
// [ { name: 'alex', age: 40, status: 'single' },
//      { name: 'daniel', age: 75, status: 'single' },
//      { name: 'john', age: 64, status: 'single' },
//      { name: 'max', age: 64, status: 'single' },
//      { name: 'smith', age: 86, status: 'single' },
//      { name: 'jane', age: 55, status: 'single' } ] }

/// update  example
var uid = 'job_2'
var dd = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri= 0,1

resx.setupData(dd, uid)
var nn = resx.getItem(uid)

// add {sex:...}
for (var i = 0; i < nn.length; i++) {
    nn[i].dataSet = Object.assign({}, { sex: 'male' }, nn[i].dataSet)
}
resx.updateSetup(nn, uid)

// update second item via updateDataSet
resx.updateDataSet(uid, 1, { sex: 'any' }, 'merge')
notify.ulog({ job_2_nn: resx.getItem(uid) })

// example 1
// var uid = 'index1'
// var a = resx.setupData(exampleData(2), uid).d
// var b = resx.setupData(exampleData(1), uid).d
// notify.ulog({ b }) // will return combined for `a and b`
// resx.markDone(uid) // once marked cannot add anymore `setupData` of the same `index1`
// var finalize_index1Data = resx.finalize(null, uid) // return final data and delete from class
// notify.ulog({ finalize_index1Data })
// end

// example 2
// var uid = 'index5'
// var a = resx.setupData(exampleData(3), uid).d
// // notify.ulog({ a }) // will return only for `a`
// var b = resx.setupData(exampleData(2), 'index3').d
// // notify.ulog({ b }) // will return only for `b`
// resx.computation(item => {
//     // NOTE do some calculation, must pass same array size as initial data
//     item = [[], [], [], [], [], ['abc']]
//     return item
// }, uid)
// // updated value for `index5`
// var updated = resx.getItem(uid, true).d
// notify.ulog({ updated }) // return latest update from computation before calling finalize

// var finalize_index5Data = resx.finalize(null, uid) // return final data, only delete data for `index5`, `index3` will still remain
// notify.ulog({ finalize_index5Data })
// end

// example 2a
// var uid = 'index5'
// var a = resx.setupData(exampleData(5), uid).d
// // notify.ulog({ a }) // will return only for `a`
// // var b = resx.setupData(exampleData(2), 'index3').d
// // notify.ulog({ b }) // will return only for `b`
// // resx.computation(item => {
// //     // NOTE with `each` option callback runs thru each item, you must return 1 item
// //     //  item.dataSet.age += 20
// //     return item
// // }, uid, 'each')
// // updated value for `index5`
// var updated = resx.getItem(uid, true).d
// notify.ulog({ updated }) // return latest update from computation before calling finalize

// var finalize_index5Data = resx.finalize(null, uid) // return final data, only delete data for `index5`, `index3` will still remain
// notify.ulog({ finalize_index5Data })

// example 3
// var a = resx.setupData(exampleData(2), 'index6').d
// var b = resx.setupData(exampleData(1), 'index6').d
// var c = resx.setupData(exampleData(3), 'index6').d
// resx.markDone('index6') // if set, any setupData for the same `uid` will be ignored

// var d = resx.setupData(exampleData(0), 'index6').d // data from exampleData(0) is never added to `index6`
// notify.ulog({ d }) // will return from `a,b,c`. Data from `d`is ignored!

// var finalize_index6Data = resx.finalize(null, 'index6') // return final data and delete from class
// notify.ulog({ finalize_index6Data })
// end

// example 4, itemFormated
// resx.setupData(exampleData(2), 'index7').d
// var d = exampleData(2) // correct array size
// // var d = exampleData(3) // will produce an error since provided data is wrong array size!
// var itemFormated = resx.itemFormated(d, 'index7') // use this to return formated item before you call `finalize(...)` method
// notify.ulog({ itemFormated })
// end

// example 5, itemData
// var d = resx.setupData(exampleData(2), 'index8').d
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
// var a = resx.setupData(exampleData(2), 'index9')
//     .setupData(exampleData(1))
//     // .setupData(exampleData(3), 'index1') // as explained above this would only produce finalize for `uid:index1`

//     .computation(item => {
//         // NOTE do some calculation, must pass same array size as initial data
//         // item = [[], [], [], [], [], [], [], []]
//         return item
//     }/** ,uid */)

//     // set doDelete=false if you do not wish to delete you data from the arch
//     .finalize(/** customData, `index9`, doDelete=true */)

// notify.ulog({ index9_a: a })
// end

// example 7, chaining
// NOTE you can chain methodes as well
// make sure that you update your `uid` when doing concurent chain with different `uid`
// var a = resx.setupData(exampleData(2), 'index10')
//     .setupData(exampleData(1))
//     .setupData(exampleData(3)) // add data to this item
// // .setupData(exampleData(5), 'index11')
//     .computation(item => {
//         // NOTE do some calculation for `each` item, must return 1 item
//         item.dataSet.age += 20
//         return item
//     }, null, 'each') // we ignored `uid:null` since we are chaining only one job
//     // if we provided `index11` internal value will change, need to specify what to finalize!
//     // .markDone(/*uid*/) // will ignore setupData for uid:index10 from future updates
//     .setupData(exampleData(5))
//     .finalize()
//     // .finalize(/** customData, `index11`, doDelete=true */)
// notify.ulog({ index10_a: a })
