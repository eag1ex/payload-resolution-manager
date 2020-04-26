require('module-alias/register') // required for javascript alias file name loading
const { notify, PRM } = require('@root')
const debug = true
const prm = new PRM(debug, {
    strictMode: true, // jobs of same uid cannot be called again
    onlyCompleteSet: true, // resolution will only return dataSets marked `complete`
    resSelf: true, // allow chaning multiple resolution's
    autoComplete: true // auto complete every compute(cb=>) iteration
})

const UID1 = 'job_1'
// NOTE dataSets
const a1 = [{ name: 'Tetraites', age: 20 }, { name: 'Priscus', age: 39 }]
const a2 = [{ name: 'Carpophorus', age: 50 }, { name: 'Commodus', age: 44, title: 'Roman Gladiator' }] // up to _ri:4

const UID2 = 'job_2'
const b1 = [{ name: 'Flamma', age: 44 }]
const b2 = [{ name: 'Crixus', age: 77 }]
const b3 = [{ name: 'Verus', age: 60 }] // up to _ri:2

// sets both UID1 and UID2
const assignment1 = prm.set(a1, UID1)
    .set(a2).set(b1, UID2).set(b2)
    .of(UID1)
    // NOTE selecting conditionally
    .filter(z => z.age >= 44)
    .compute(item => {
        // Commodus to Carpophorus
        item.dataSet.age += 20
        // item.complete = true //NOTE already selected `autoComplete:true` option
        return item
    }, 'each').resolution(UID1).d

const assignment2 = prm.set(b3, UID2)
    .from(2) // Verus
    .compute(item => {
        item.dataSet.name = 'Hermes' // change name
        // item.complete = true
        return item
    }, 'each', UID2).resolution(UID2).d

// output for `complete/=>autoComplete` jobs, all data is wiped

notify.ulog(assignment1)
/**
 * assignment1 output:
[ { name: 'Tetraites', age: 20 },
  { name: 'Priscus', age: 39 },
  { name: 'Carpophorus', age: 70 },
  { name: 'Commodus', age: 64, title: 'Roman Gladiator' } ]
 */

notify.ulog(assignment2)
/**
  * assignment2 output:
    [ { name: 'Flamma', age: 44 },
  { name: 'Crixus', age: 77 },
  { name: 'Hermes', age: 60 } ]

  */
