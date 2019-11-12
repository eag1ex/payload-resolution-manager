
// NOTE base chaining example
// update your `uid` when doing concurent chaining
module.exports = (PRM, exampleData, notify) => {
    var uid = 'job_1'
    var d1 = [{ name: 'alex', age: 20 }] // _ri = 0
    var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
    var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
    var d4 = ['a', null, false] // _ri = 6,7,8

    var nn = PRM.setupData(d1, uid)
        .setupData(d2)
        .setupData(d3) // add data to this item
        // .setupData(exampleData(5), 'index11')
        .computation(item => {
            // NOTE do some calculation for `each` item, must return 1 item
            // if (item._ri===0) // do something
            item.dataSet.age += 20
            item.dataSet.status = 'single'
            return item
        }, 'each') // ignored.. We are chaining only one job
        // if provided `index11` internal value will change, need to specify what to finalize
        .markDone(/* uid */) // ignore setupData for uid:job_1 from future updates
        .setupData(d4)
        .finalize()
        // .finalize(/** customData, `index11`, doDelete=true */)
        // notify.ulog({ job_1: nn })

    // returns:
    // [ { name: 'alex', age: 40, status: 'single' },
    //      { name: 'daniel', age: 75, status: 'single' },
    //      { name: 'john', age: 64, status: 'single' },
    //      { name: 'max', age: 64, status: 'single' },
    //      { name: 'smith', age: 86, status: 'single' },
    //      { name: 'jane', age: 55, status: 'single' } ] }
    return nn
}
