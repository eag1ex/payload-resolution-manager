require('module-alias/register') // required for javascript alias file name loading

const { notify, PRM } = require('@root')
const debug = true

const prm = new PRM(debug, {
    sandbox: true, // handle errors without crashing application
    asAsync: true, // allow async return, data is passed asyncronously and need to use `pipe` to get each update
    strictMode: true, // jobs of same uid cannot be called again!
    onlyCompleteJob: true, // resolution will only return dataSets marked `complete`
    resSelf: true, // allow chaning multiple resolutions
    batch: true // when `resolution` is called, complete job is batched through `batchReady([UID1,UID2])`
})

const UID1 = 'ICBC'
const a1 = [{
    currency: 'CNY',
    bankName: 'Industrial and Commercial Bank of China',
    asset: '$4,000 bln'
}]
const a2 = [{
    value: 0,
    country: 'China'
}]

const asyncData = (d, delay = 2000) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(d)
        }, delay)
    })
}

(async() => {
    prm.set(asyncData(a1), UID1)
        .set(a2) // NOTE no async data for `_ri:1`
        .filter(z => z.value === 0)
        .compute(async(item) => {
            const { value } = await asyncData({ value: 2000000000 })
            item.dataSet.value += value
            item.complete = true
            return item
        }, 'each').resolution(UID1)

    // wait for change
    await prm.async('ICBC')

    prm.complete('ICBC')
        .resolution()
        .pipe(item => {
            return item.forEach(element => {
                console.log({ message: '-- client approved', item })
                element.approved = true
            })
        }, 'ICBC') // .pipe().pipe() // and so on

    await prm.async('ICBC') // wait for adjustnemt

    // NOTE  final output is carried out via `batchReady` and all data is wiped
    prm.batchReady([UID1], 'grouped', data => {
        /** data output:
             { ICBC:
                [ { currency: 'CNY',
                    bankName: 'Industrial and Commercial Bank of China',
                    asset: '$4,000 bln',
                    approved: true },
                    { value: 2000000000, country: 'China', approved: true }
                ] }
         */
    })
    // prm.pipe(z => {
    //     console.log('will nof fire', z)
    // })
})().catch(err => {
    console.log(err)
})
