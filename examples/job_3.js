
// update  example
module.exports = (PRM, exampleData, notify) => {
    var uid = 'job_3'
    var dd = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri= 0,1

    PRM.set(dd, uid)
    var nn = PRM.get(uid)

    // add {sex:...}
    for (var i = 0; i < nn.length; i++) {
        nn[i].dataSet = Object.assign({}, { sex: 'male' }, nn[i].dataSet)
    }
    PRM.updateJob(nn, uid)

    // update second item via updateSet
    PRM.updateSet(uid, 1, { sex: 'any' }, 'merge')

    notify.ulog({ uid_list: PRM.getUIDS() })
    return PRM.get(uid)
}
