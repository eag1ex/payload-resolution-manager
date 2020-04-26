require('module-alias/register') // required for javascript alias file name loading

const { notify, PRM } = require('@root')
const debug = true
const prm = new PRM(debug, {
    strictMode: true, // jobs of same uid cannot be called again!
    onlyCompleteSet: true, // resolution will only return dataSets marked `complete`
    resSelf: true, // allow chaning multiple resolutions
    // autoComplete: true, // auto complete every compute(cb=>) iteration,
    batch: true // when `resolution` is called, complete job is batched through `batchReady([UID1,UID2])`
})

const UID1 = 'job_1'
// NOTE dataSets
const a1 = [{ name: 'Flamma', age: 20 }]
const a2 = [{ name: 'Commodus', age: 25 }] // up to _ri:1

const UID2 = 'job_2'
const b1 = [{ name: 'little joe', age: 99 }, { name: 'Carpophorus', age: 44 }]
const b2 = [{ name: 'Verus', age: 77 }]
const b3 = [{ name: 'Tetraites', age: 60 }] // up to _ri:3

// sets both UID1 and UID2
prm.set(a1, UID1)
    .set(a2).set(b1, UID2).set(b2)
    .of(UID1)
    // NOTE selecting conditionally
    .filter(z => z.name === 'Flamma' || z.age >= 20)
    .compute(item => {
        // NOTE Flamma to Commodus
        item.dataSet.age += 20
        item.complete = true
        return item
    }, 'each').resolution()

// NOTE async response for UID2
setTimeout(() => {
    prm.set(b3, UID2)
        .range(1, 3) // Carpophorus to  Tetraites
        .compute(item => {
            item.dataSet.title = 'Roman Gladiator'
            item.complete = true
            return item
        }, 'each').resolution()
}, 2000)

// NOTE on `complete` jobs only, final output is carried out via `batchReady` and all data is wiped
prm.batchReady([UID1, UID2], 'grouped', data => {
    notify.ulog(data)
    /**
    { job_1:
        [ { name: 'Flamma', age: 40 }, { name: 'Commodus', age: 45 } ],
        job_2:
        [ { name: 'Carpophorus', age: 44, title: 'Roman Gladiator' },
            { name: 'Verus', age: 77, title: 'Roman Gladiator' },
            { name: 'Tetraites', age: 60, title: 'Roman Gladiator' } ] }

     */
})
