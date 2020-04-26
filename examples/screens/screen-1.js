require('module-alias/register') // required for javascript alias file name loading
const { notify, PRM } = require('@root')
let debug = true
const prm = new PRM(debug, {
    strictMode: true, // jobs of same uid cannot be called again
    onlyCompleteSet: true, // resolution will only return dataSets marked `complete`
    resSelf: true // allow chaning multiple .resolution().resolution()
    // autoComplete: true // auto complete every compute(cb=>) iteration
})

const UID = 'job_1'
// NOTE dataSets
const d1 = [{ name: 'Tetraites', age: 20 }, { name: 'Priscus', age: 39 }]
const d2 = [{ name: 'Spiculus', age: 25, title: 'Roman Gladiator' }]
const d3 = [{ name: 'Carpophorus', age: 50 }, { name: 'Commodus', age: 25 }] // up to _ri:4

const assignment = prm.set(d1, UID).set(d2).set(d3)
    // NOTE logical operators
    // .from(0)
    // .range(1, 2)
    // .only(1)
    .filter(z => z.age === 25)
    .compute(item => {
        // NOTE for `Spiculus` and `Commodus`
        item.dataSet.age += 20
        item.complete = true
        return item
    }, 'each')
    // filter again from dataSet tree
    .filter(z => z.name === 'Commodus')
    .compute(item => {
        // NOTE for `Commodus`
        // item.dataSet.name = 'Marcus'
        item.dataSet.surname = 'Attilius'
        item.complete = true
        return item
    }, 'each')
    // .complete() NOTE  mark all dataSet's complete
    .resolution().d

// output for `complete` jobs only, all data is wiped
notify.ulog(assignment)
/**
 * [ { name: 'Spiculus', age: 45 },
  { name: 'Marcus', age: 45, surrname: 'Attilius' } ]
 */
