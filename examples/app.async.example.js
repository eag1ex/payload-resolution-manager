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
    onlyComplete: true, // `resolution` will only return dataSets marked `complete`
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

const assignONE = {
    jobID: 'bank_1',
    cusListA: [
        {
            uid: 'steve_jobs_12345',
            accountName: 'Steve Jobbs',
            bankName: 'Swiss Bank',
            accountNumber: '2346547435',
            accountType: 'investment',
            'SWIFT_BIC': '34575',
            portfolio: 20000000000
        }, // _RI = 0
        {
            uid: 'bill_gates_12345',
            accountName: 'Bill Gates',
            bankName: 'Swiss Bank',
            accountNumber: '23497344567867',
            accountType: 'investment',
            'SWIFT_BIC': '34575',
            portfolio: 50000000000
        } // _RI = 1
    ],
    cusListB: [
        { uid: 'warren_buffet_12345',
            accountName: 'Warren Buffet',
            bankName: 'Swiss Bank',
            accountNumber: '345546768789',
            accountType: 'investment',
            'SWIFT_BIC': '34575',
            portfolio: 100000000000
        } // _RI = 2
    ]
}

const assignTWO = {
    jobID: 'bank_2',
    cusListA: [
        {
            uid: 'steve_jobs_12345',
            accountName: 'Steve Jobbs',
            bankName: 'ICBC',
            accountNumber: '32456767876',
            accountType: 'investment',
            'SWIFT_BIC': '237687',
            portfolio: 50000000000
        }, // _RI = 3
        {
            uid: 'bill_gates_12345',
            accountName: 'Bill Gates',
            bankName: 'ICBC',
            accountNumber: '3247890890',
            accountType: 'investment',
            'SWIFT_BIC': '4565',
            portfolio: 90000000000
        } // _RI = 4
    ],
    cusListB: [{ uid: `warren_buffet_12345`,
        accountName: 'Warren Buffet',
        bankName: 'ICBC',
        accountNumber: '345567898074',
        accountType: 'investment',
        'SWIFT_BIC': '89456',
        portfolio: 70000000000
    }] // _RI = 5
}

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
        if (v.dataSet.accountNumber === '23497344567867') return true
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
        if (v.dataSet.accountNumber === '345567898074') return true
    })
    .markDone(assignTWO.jobID)
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

// NOTE return both jobs when `resolution()` is complete
prm.batchReady([assignONE.jobID, assignTWO.jobID], 'flat', data => {
    notify.ulog({ message: 'batchReady results', data })
})
