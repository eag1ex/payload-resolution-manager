
/**
 * @BankApp
 * more practical integration of PRM framework with BankApp example
 * - simmulation funds transaction and proxy
 */
module.exports = () => {
    const notify = require('../../libs/notifications')()
    const PRM = require('../../libs/prm/payload.resolution.manager')(notify)
    const { cloneDeep, head, isArray } = require('lodash')
    const { banks } = require('./bankData')
    const { clients } = require('./clientData')
    class BankApp {
        constructor(debug) {
            this.currency = 'USD'
            this.charge = 100
            this.debug = debug

            this.prm.onModelStateChange((uid, model) => {
                notify.ulog({ message: '[onModelStateChange]', uid, model })
            })
            this.initialize()
                .transaction()
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

        initialize() {
            this.clientsList.forEach((client, inx) => {
                // NOTE will populate individual clients by id, with initial data
                this.prm.set(this.asyncData(2000, [client]), client.id)
            })

            // set initial bank information
            this.bankList.forEach((bank, inx) => {
                // NOTE will populate individual banks by id, with initial data
                this.prm.set(this.asyncData(1000, [bank]), bank.id)
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

        client(id = '') {
            const validID = head(this.clientsList
                .filter(z => z.id.indexOf(id) !== -1 && z.id.length === id.length)) || {}

            return validID.id
        }

        fee(total = 0, charge = 0) {
            // simmulate price change
            const fee = Math.round(Math.random() * charge)
            const amount = total - fee
            return { amount, fee }
        }

        get clientsList() {
            return cloneDeep(clients)
        }

        // source # https://fxssi.com/top-20-largest-world-banks-in-current-year
        get bankList() {
            return cloneDeep(banks)
        }

        async enquiryClientData(clientList) {
            if (!isArray(clientList)) return

            // resolve client list first
            for (var x = 0; x < clientList.length; x++) {
                await this.prm.async(clientList[x])
            }

            var clientData = []

            for (var i = 0; i < clientList.length; i++) {
                const uid = clientList[i]
                // NOTE we only have one array for each client, grab first
                const { dataSet } = head(this.prm.getSet(uid))
                clientData.push(dataSet)
            }
            return { clientData }
        }

        async transaction() {
            this.prm.of(this.bank('ICBC'))
                .compute(async(d) => {
                    // wait for available clients
                    const { clientData } = await this.enquiryClientData(['john-doe', 'google', 'amazon'])

                    // we only have 1 array to loop
                    d.forEach((item, inx) => {
                        item.dataSet.clients = clientData
                    })
                    return d
                }, 'all')
                .compute(async(d) => {
                    // charge each client
                    head(d).dataSet.clients.forEach((client, inx) => {
                        const { amount, fee } = this.fee(client.balance, this.charge)
                        client.balance = amount // update internal clients
                        head(d).dataSet.value = head(d).dataSet.value + fee

                        // update cliend job set
                        this.prm.updateDataSet(client.id, 0, client) // update own client balance to mirrow the banks
                    })
                    return d
                }, 'all')
                .resolution()

            // NOTE if we do not set pipe id, it will lookup `lastUID`, due to async nature, order is not guaranteed, this is only the case when using `asAsync` option with `pipe's
            this.prm.pipe(z => {
                // also this.prm.resData
                notify.ulog({ message: '-- transaction made', bank: 'ICBC', d: z })
            }, 'ICBC')

            // NOTE we have to wait for bank to complete first! Since client jobs were called internaly
            // and will become available after
            await this.prm.async('ICBC')

            // NOTE check to see what job go set
            // this.prm.onSet(d => {
            //     console.log('onset', d)
            // }, 'all')

            this.prm
                .complete('google')
                .resolution()
                .complete('amazon')
                .resolution()
                .pipe(z => {
                    notify.ulog({ message: '-- client account', balance: 'google', d: z })
                }, 'google')
                .pipe(z => {
                    notify.ulog({ message: '-- client account', balance: 'amazon', d: z })
                }, 'amazon')

            // NOTE NOW bank/{clients}, and client job's, each include same data!
            /// ////////////////////////////

            // or as promise
            // .pipe(null, 'CCBC').then(z => {
            //     console.log('getSet promise', this.prm.getSet())
            // })
        }

        /**
         * @interTransfer
         * make international transfer
         */
        interTransfer() {

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
