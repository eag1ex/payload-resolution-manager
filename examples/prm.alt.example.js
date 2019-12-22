const notify = require('../libs/notifications')()
const PRM = require('../libs/prm/payload.resolution.manager')(notify)

const options = {
    asAsync: true, // to allow async returns, when set all data is passed asyncronously and need to use `pipe` to get each new update
    strictMode: true, // make sure jobs of the same uid cannot be called again!
    onlyComplete: true, // `resolution` will only return dataSets marked `complete`
    batch: true, // after running `resolution` method, each job that is batched using `batchRes([jobA,jobB,jobC])`, only total batch will be returned when ready
    resSelf: true, // allow chaning multiple resolution
    autoComplete: true // auto set complete on every compute iteration within `each` call
}

const debug = true
const prm = new PRM(debug, options)

prm.set([{ data: 'abc', age: 10 }], 'job1')
    .set([{ data: 'def', age: 50 }])
    .updateDataSet(null, 0, { data2: 123 }, 'merge')
    .pipe(d => {
        var nn = prm.getSet('job1')
        for (var i = 0; i < nn.length; i++) {
            nn[i].dataSet = Object.assign({}, { sex: 'male' }, nn[i].dataSet)
        }
        prm.updateSet(nn, 'job1')
    })
    .from(1) // from what `_ri` index
    .filter((v, index) => { // will return filtered results for compute to manage, leaving the rest unchanged
        if (v.dataSet.age < 60) return true
    })
    .compute(d => {
        d.dataSet = 'hello promise'
        return Promise.reject(d)
    }, 'each')
    .resolution()
    .pipe((d) => {
        console.log('resolution', d)
    })

prm.batchRes(['job1'], 'flat', d => {
    notify.ulog({ batch: d, message: 'delayed results' })
})
