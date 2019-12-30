/**
 * Application, advance async chaining example with the help of Xpromise & Xpipe
 * Simple demonstration of a bank transaction using async data,
 * With the help of Xpipe we can chain events that will activate each method's once each data is update and piped down.
 */

const notify = require('../libs/notifications')()
const PRM = require('../libs/prm/payload.resolution.manager')(notify)
const { cloneDeep } = require('lodash')
const options = {
    asAsync: true, // to allow async return, data is passed asyncronously and need to use `pipe` to get each new update
    strictMode: true, // make sure jobs of the same uid cannot be called again!
    onlyCompleteSet: true, // `resolution` will only return dataSets marked `complete`
    batch: true, // after running `resolution` method, each job that is batched using `batchReady([jobA,jobB,jobC])`, only total batch will be returned when ready
    resSelf: true, // allow chaning multiple resolution
    autoComplete: true // auto set complete on every compute iteration within `each` call
}

const debug = true
const prm = new PRM(debug, options)

const asyncData = (time = 2000, data) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(data)
        }, time)
    })
}
const { assignONE, assignTWO } = require('./app.async.data')

const BROKER = {
    fee: 10000,
    name: 'Hongkong Investmonts',
    code: 'ABC1246'
}

// NOTE setting job jobID1
prm.set(assignONE.cusListA, assignONE.jobID)
    .set(asyncData(1000, assignONE.cusListB)) // add more customers to `jobID1`
    .filter((v, index) => {
        // bill gates account number
        return (v.dataSet.accountNumber === '23497344567867')
    })
    // compute some logic based on previous selection
    .compute(async(d) => {
        var brokerData = await asyncData(1500, cloneDeep(BROKER))
        d.dataSet.portfolio = d.dataSet.portfolio - brokerData.fee
        delete brokerData.fee
        d.dataSet.BROKER = brokerData
        return d
    }, 'each')
    .resolution()
    .pipe((d) => {
        // NOTE pipe final resolution for >> this.lastUID
        console.log('resolution() jobID1', d)
    }, assignONE.jobID)

    // NOTE setting job jobID2
    .set(assignTWO.cusListA, assignTWO.jobID)
    .set(assignTWO.cusListB)
    .filter((v, index) => {
        // Warren Buffet account number
        return (v.dataSet.accountNumber === '345567898074')
    })
    // .markDone(assignTWO.jobID) NOTE when set, can ignore future changes to this job
// compute some logic based on previous selection
    .compute(async(d) => {
        var brokerData = await asyncData(1500, cloneDeep(BROKER))
        d.dataSet.portfolio = d.dataSet.portfolio - brokerData.fee
        delete brokerData.fee
        d.dataSet.BROKER = brokerData
        return d
    }, 'each')
    .resolution()
    .pipe((d) => {
        // NOTE pipe final resolution for >> this.lastUID
        console.log('resolution() for jobID2', d)
    }, assignTWO.jobID)

// NOTE return both when `resolution()` for each job is complete
prm.batchReady([assignONE.jobID, assignTWO.jobID], 'flat', data => {
    notify.ulog({ message: 'batchReady results', data })
})
