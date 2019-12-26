/**
 * Application, advance async chaining example with the help of Xpromise & Xpipe
 * Simple demonstration of a bank transaction using async data,
 * With the help of Xpipe we can chain events that will activate each method's once each data is update and piped down.
 */

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

const asyncData = (time = 2000, data) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(data)
        }, time)
    })
}

/// -- job one
const jobID1 = 'bank_1'
const bankCustomerList1a = [
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
]

const bankCustomerList1b = [
    { uid: 'warren_buffet_12345',
        accountName: 'Warren Buffet',
        bankName: 'Swiss Bank',
        accountNumber: '345546768789',
        accountType: 'investment',
        'SWIFT_BIC': '34575',
        portfolio: 100000000000
    } // _RI = 2
]

// -- job two
const jobID2 = 'bank_2'
const bankCustomerList2a = [
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
]

const bankCustomerList2b = [{ uid: `warren_buffet_12345`,
    accountName: 'Warren Buffet',
    bankName: 'ICBC',
    accountNumber: '345567898074',
    accountType: 'investment',
    'SWIFT_BIC': '89456',
    portfolio: 70000000000
}] // _RI = 5

const broker = {
    fee: 10000,
    name: 'Hongkong Investmonts',
    code: 'ABC1246'
}

prm.set(bankCustomerList1a, jobID1)
    .set(asyncData(1000, bankCustomerList1b)) // add more customers to `jobID1`
    // .updateDataSet(null, 0, { data2: 123 }, 'merge')
    // .pipe(d => {
    //     var nn = prm.getSet('job1')
    //     for (var i = 0; i < nn.length; i++) {
    //         nn[i].dataSet = Object.assign({}, { sex: 'male' }, nn[i].dataSet)
    //     }
    //     prm.updateSet(nn, 'job1')
    // })
    // .from(1) // select from `_ri` index
    .filter((v, index) => { // filter all starting  from selected `_ri` index (if any)
        // bill gates account number
        if (v.dataSet.accountNumber === '23497344567867') return true
    })
    // compute some logic based on previous selection
    .compute(d => {
        d.dataSet.portfolio = d.dataSet.portfolio - broker.fee
        delete broker.fee
        d.dataSet.broker = broker
        return asyncData(1500, d)
    }, 'each')
    .resolution()
    .pipe((d) => {
        // pipe final resolution
        console.log('resolution jobID1', d)
    }, jobID1)
    .set(bankCustomerList2a, jobID2)
    .set(bankCustomerList2b)
    .of(jobID2)
// .from(5) // select from `_ri` index // TODO fix from need to set uid for each from ri, when multiple jobs
    .filter((v, index) => { // filter all starting  from selected `_ri` index (if any)
        // Warren Buffet account number
        if (v.dataSet.accountNumber === '345567898074') return true
    })
    .compute(d => {
        d.dataSet.portfolio = d.dataSet.portfolio - broker.fee
        delete broker.fee
        d.dataSet.broker = broker
        return asyncData(1500, d)
    }, 'each')
    .resolution(jobID2)
    .pipe((d) => {
        // pipe final resolution
        console.log('resolution for jobID2', d)
    }, jobID2)
//  .of(jobID2) // select job
    // .filter((v, index) => { // filter all starting  from selected `_ri` index (if any)
    // // warren buffet account number
    //     if (v.dataSet.accountNumber === '345567898074') return true
    // })

prm.batchRes([jobID1, jobID2], 'flat', d => {
    notify.ulog({ batch: d, message: 'delayed results' })
})
