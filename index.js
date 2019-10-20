const notify = require('./libs/notifications')()

const PayloadResolutioManager = require('./pl.resolution.manager')(notify)
var debug = true
const resx = new PayloadResolutioManager(debug)

var exampleData = (id = 0) => {
    var data = {
        // each item in array is 1 payload
        0: [{ name: 'mike', age: 20 }, { name: 'alex', age: 50 }, { name: 'john', age: 25 }, { name: 'cris', age: 22 }],
        1: [{ name: 'john', age: 22 }, { name: 'mary', age: 15 }, { name: 'denny', age: 19 }, { name: 'gery', age: 55 }, { name: 'greg', age: 66 }],
        2: [{ name: 'daniel', age: 35 }, { name: 'lary', age: 65 }, { name: 'andy', age: 54 }],
        3: [{ name: 'jamie', age: 31 }, { name: 'derick', age: 44 }, { name: 'lily', age: 21 }, { name: 'marcus', age: 68 }, { name: 'alexander', age: 44 }, { name: 'derick', age: 77 }],
        4: [[1], [2]]
    }
    if (data[id] === undefined) throw (`invalid id provided ${id}`)
    return data[id]
}

// example 1
// var uid = 'index1'
// var a = resx.setupData(exampleData(2), uid).d
// var b = resx.setupData(exampleData(1), uid).d
// notify.ulog({ ab }) // will return combined for `a and b`
// resx.markData(uid) // once marked cannot add anymore `setupData` of the same `index1`
// var finalize_index1Data = resx.finalize(null, uid) // will also delete all data uppon finish
// notify.ulog({ finalize_index1Data })
// end

// example 2
// var uid = 'index5'
// var a = resx.setupData(exampleData(3), uid).d
// // notify.ulog({ a }) // will return only for `a`
// var b = resx.setupData(exampleData(2), 'index3').d
// notify.ulog({ b }) // will return only for `b`
// var finalize_index5Data = resx.finalize(null, uid) // only delete data for `index5`, `index3` will still remain
// notify.ulog({ finalize_index5Data })
// end

// example 3
// var a = resx.setupData(exampleData(2), 'index6').d
// var b = resx.setupData(exampleData(1), 'index6').d
// var c = resx.setupData(exampleData(3), 'index6').d
// resx.markData('index6') // if you remove this mark then below exampleData(0) will then be included in `index6`!

// var d = resx.setupData(exampleData(0), 'index6').d // data from exampleData(0) is never added to `index6`
// notify.ulog({ d }) // will return from `a,b,c`. Data from `d` will be ignored!

// var finalize_index6Data = resx.finalize(null, 'index6') // only delete data for `index5`, `index3` will still remain
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

// example 5, chaining
// NOTE you can chain methodes as well
// make sure that you update your `uid` when doing concurent chain with different `uid`
var a = resx.setupData(exampleData(2), 'index9')
    .setupData(exampleData(1))
    // .setupData(exampleData(3), 'index1') // as explained above this would only produce finalize for `uid:index1`

    // set doDelete=false if you do not wish to delete you data from the arch
    .finalize(/** customData, `index9`, doDelete=true */)

notify.ulog({ index9_a: a })
// end