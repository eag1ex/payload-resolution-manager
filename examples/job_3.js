
// update  example
module.exports = (PRM, exampleData, notify) => {
    var uid = 'job_3'
    var dd = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri= 0,1

    PRM.setupData(dd, uid)
    var nn = PRM.getItem(uid)

    // add {sex:...}
    for (var i = 0; i < nn.length; i++) {
        nn[i].dataSet = Object.assign({}, { sex: 'male' }, nn[i].dataSet)
    }
    PRM.updateSetup(nn, uid)

    // update second item via updateDataSet
    PRM.updateDataSet(uid, 1, { sex: 'any' }, 'merge')

    notify.ulog({ uid_list: PRM.getUIDS() })
    return PRM.getItem(uid)
}
