
/**
 * @BankApp
 * more practical integration of PRM framework with BankApp example
 * - simmulation funds transaction and proxy
 */
module.exports = () => {
    const notify = require('../../libs/notifications')()
    const PRM = require('../../libs/prm/payload.resolution.manager')(notify)
    const { cloneDeep, head } = require('lodash')
    const { banks } = require('./bankData')

    class BankApp {
        constructor(debug) {
            this.currency = 'USD'
            this.fee = 100
            this.debug = debug
            // source # https://fxssi.com/top-20-largest-world-banks-in-current-year

            this.initialize()
                .transaction()
        }

        initialize() {
            // set initial bank information
            this.bankList.forEach((bank, inx) => {
                // NOTE will populate individual banks by id, with initial data
                this.prm.set(this.asyncData(3000, [bank]), bank.id)
            })
            // NOTE onSet returns one callback for all/last when prm data's are set
            // this.prm.onSet(d => {
            //     return null
            // })
            // or check to see when one bank is ready!
            // this.prm.pipe(d => {
            //     notify.ulog({ message: '-- data set', bank: 'CCBC', d })
            //     return d
            // }, this.bank('CCBC'))

            return this
        }

        /**
         * @bank
         * test vailid ID
         */
        bank(id = '') {
            const validID = head(this.bankList
                .filter(z => z.id.indexOf(id) !== -1 && z.id.length === id.length)) || {}

            return validID.id
        }

        fee(total = 0, charge = 0) {
            // simmulate price change
            const amount = total - Math.round(Math.random() * charge)
            const diff = total - amount
            return { total, diff }
        }

        /**
         * @prm
         * new PRM instance
        */
        get prm() {
            if (this._prm) return this._prm
            this._prm = new PRM(this.debug, this.prmSettings)
            return this._prm
        }

        get prmSettings() {
            return {
                asAsync: true, // to allow async return, data is passed asyncronously and need to use `pipe` to get each new update
                strictMode: true, // make sure jobs of the same uid cannot be called again!
                onlyCompleteSet: true, // `resolution` will only return dataSets marked `complete`
                batch: true, // after running `resolution` method, each job that is batched using `batchReady([jobA,jobB,jobC])`, only total batch will be returned when ready
                resSelf: true, // allow chaning multiple resolution
                autoComplete: true // auto set complete on every compute iteration within `each` call
            }
        }

        get bankList() {
            return cloneDeep(banks)
        }

        get clientList() {
            return [{ name: 'John Doe', portfolio: 100000000 },
                { name: 'Google', portfolio: 100000 },
                { name: 'Amazon', portfolio: 20000 },
                { name: 'Microsoft', portfolio: 30000 },
                { name: 'Warren Buffett', portfolio: 5000000 }]
        }

        transaction() {
            this.prm.of(this.bank('ICBC'))
                .compute(d => {
                    d.dataSet.clients = this.clientList

                    return d
                }, 'each')
                // .compute(d => {
                //     // charge each client
                //     d.dataSet.clients.forEach((client, inx) => {
                //         const { total, diff } = this.fee(client.portfolio, 200)
                //         client.portfolio = total
                //         d.dataSet.value = d.dataSet.value + diff
                //     })
                //     return d
                // }, 'each')

            // NOTE if we do not set pipe id, it will lookup `lastUID`, due to async nature, order is not guaranteed, this is only the case when using `asAsync` option with `pipe's
                .pipe(z => {
                    notify.ulog({ message: '-- transaction made', bank: 'ICBC', d: this.prm.getSet() })
                }, 'ICBC')
            // or as promise
                // .pipe(null, 'CCBC').then(z => {
                //     console.log('getSet promise', this.prm.getSet())
                // })
        }

        asyncData(time = 2000, data) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(data)
                }, time)
            })
        }
    }
    return BankApp
}
