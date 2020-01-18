
/**
 * @BankApp
 * more practical integration of PRM framework with BankApp example
 * - simmulation funds transaction and proxy
 * - make a bank enquiry, then make enquiry to each client, update changes to the bank and the client
 * - finaly return results
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

            // NOTE can listen to changes on all available jobs, currently: {bank} and {clients}
            // this.prm.onModelStateChange((uid, model) => {
            //     notify.ulog({ message: '[onModelStateChange]', uid, model })
            // })

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
                onlyCompleteJob: true, // `resolution` will only return dataSets marked `complete`
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

        /**
         * @asyncData
         * simulated fetch delay
         */
        asyncData(time = 2000, data) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(data)
                }, time)
            })
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
                const { dataSet } = head(this.prm.get(uid))
                clientData.push(dataSet)
            }
            return { clientData }
        }

        async transaction() {
            this.prm.of(this.bank('ICBC'))
                .compute(async(d) => {
                    // wait for available clients
                    const { clientData } = await this.enquiryClientData(['google', 'amazon', 'microsoft', 'warren-buffett'])

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

                        // update own client balance to mirrow the bank
                        this.prm.updateSet(client.id, 0, client)
                    })
                    return d
                }, 'all')
                // .resolution()

            // NOTE if we do not set pipe id, it will lookup `lastUID`, due to async nature, order is not guaranteed, this is only the case when using `asAsync` option with `pipe's
            // this.prm.pipe(z => {
            //     // also this.prm.resData
            //     notify.ulog({ message: '-- transaction made', bank: 'ICBC', d: z })
            // }, 'ICBC')

            // NOTE we have to wait for bank to complete first! Since client jobs were called internaly
            // and will become available after
            await this.prm.async('ICBC')

            // NOTE check to see what job go set
            // this.prm.onSet(d => {
            //     console.log('onset', d)
            // }, 'all')

            // NOTE at this point all data for these jobs got cleared!
            this.prm
                .complete('google')
                .resolution()
                .complete('amazon')
                .resolution()
                .complete('microsoft')
                .resolution()
                .complete('warren-buffett')
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
            //     console.log('get promise', this.prm.get())
            // })

            // receive final callback on batch/id listed jobs
            this.prm.batchReady(['amazon', 'google', 'microsoft', 'warren-buffett'], 'grouped', (d) => {
                notify.ulog({ message: 'batchReady for clients', d })
            })

            // NOTE we still have 1 `john-doe`client that we didnt charge
            // if we dont call resolution on the bank we can still charge within this run/event
            this.prm
                .of('ICBC')
                .compute(async(d) => {
                    const clientID = `john-doe`

                    await this.prm.async(clientID)
                    const { dataSet } = head(this.prm.get(clientID))

                    const { amount, fee } = this.fee(dataSet.balance, this.charge)
                    dataSet.balance = amount

                    // update bank, then update client
                    const { clients } = head(d).dataSet
                    head(d).dataSet.clients = [].concat(clients, dataSet)
                    head(d).dataSet.value = head(d).dataSet.value + fee
                    this.prm.updateSet(clientID, 0, dataSet)

                    return d
                }, 'all')
                .complete()
                .resolution()

            // .pipe(z => {
            //     // also this.prm.resData
            //     notify.ulog({ message: '-- transaction made', bank: 'ICBC', d: z })
            // }, 'ICBC')

            // wait for bank update
            await this.prm.async('ICBC')

            this.prm
                .complete('john-doe')
                .resolution()
                .pipe(z => {
                    // also this.prm.resData
                    notify.ulog({ message: '-- transaction made', client: 'john-doe', d: z })
                }, 'john-doe')

            // NOTE perhaps john-doe is a special client of the BANK, we can do final batch together, since resolution for both has already been set!

            this.prm.batchReady(['ICBC', 'john-doe'], 'grouped', (d) => {
                notify.ulog({ message: 'batchReady for bank and client', d })
            })

            // all done
        }
    }
    return BankApp
}
