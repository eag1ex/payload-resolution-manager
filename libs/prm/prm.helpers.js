
/**
 * @PRMHelpers
 */
module.exports = (notify, PayloadResolutioManager) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isArray, isString, cloneDeep, reduce, isUndefined, omit, isObject, omitBy } = require('lodash')
    const PrmProto = require('./prm.proto')(notify)
    class PRMHelpers extends PayloadResolutioManager {
        constructor(debug, opts) {
            super(debug, opts)
        }
        /**
         * @assingMod
         * assing prototype to each dataSet item
         * `dataSetItem`: must provide valid object
         * `config`: available options are: enumerable, writable configurable, and assigneld to `_uid` and `_ri`
         * `strip`: strip prototype from model
         */
        assingMod(dataSetItem, config = {}, strip = null, lock = null) {
            var isInstance = dataSetItem instanceof PrmProto
            if (!isEmpty(config)) {
                return new PrmProto(this.debug).assign(dataSetItem, config, strip, lock)
            } else {
                if (strip) return new PrmProto(this.debug).assign(dataSetItem, null, strip)
                else {
                    if (isInstance) return dataSetItem
                    else return new PrmProto(this.debug).assign(dataSetItem, null, null, lock)
                }
            }
        }

        /**
         * @purgeEmpty
         * purge undefined object elms, and remove empty error if any
         */
        purgeEmpty(obj = {}) {
            if (isObject(obj) && isArray(obj)) return null
            var copy = omitBy(cloneDeep(obj), isUndefined)
            return reduce(copy, (n, el, k) => {
                n[k] = el
                if (k === 'error' && isEmpty(n[k])) delete n[k]
                return n
            }, {})
        }

        /**
         * @isPromise
         * check if we are dealing with promise
         */
        isPromise(d) {
            if (!d) return false
            var is_promise = (d || {}).__proto__
            if (typeof (is_promise || {}).then === 'function') return true

            return false
        }

        asPromise(uid, cb = null) {
            if (this.lastAsync[uid] !== undefined) {
                if (this.lastAsync[uid].then !== undefined) {
                    if (typeof cb === 'function') {
                        this.lastAsync[uid].then(() => {
                            cb()
                            delete this.lastAsync[uid]
                        })
                        return true
                    }
                    return this.lastAsync[uid]
                }

                if (typeof this.lastAsync[uid] === 'function') {
                    if (typeof cb === 'function') {
                        this.lastAsync[uid].then(() => {
                            cb()
                            delete this.lastAsync[uid]
                        })
                        return true
                    }
                    return this.lastAsync[uid]
                }
            }
            return false
        }

        /**
         * @whenTrue
         * resolve on ok, only resolves to true
         * `maxWait` time in ms, max time to wait for something or fail
         * `ok`: when true, resolve!
         *
         */
        whenTrue(maxWait, ok) {
            return new Promise((resolve, reject) => {
                var checkEvery = 20
                maxWait = maxWait !== undefined ? maxWait : 100
                var counter = 0
                var timer = setInterval(() => {
                    // resolve when either meets true
                    if (ok === true || counter >= maxWait) {
                        clearInterval(timer)
                        resolve(true)
                        return
                    }
                    counter = counter + checkEvery
                }, checkEvery)
            })
        }

        /**
         * @loopAssingMod
         * loop thru each item in jobs array and assing prototypes
         * `config` refer to assingMod
         * return mods Arr / null
         */
        loopAssingMod(jobArr, config, lock) {
            if (!isArray(jobArr)) return null
            var total = jobArr.length

            var modsArr = []
            for (var i = 0; i < jobArr.length; i++) {
                var d
                var isInstance = jobArr[i] instanceof PrmProto
                if (!isEmpty(config)) {
                    d = this.assingMod(jobArr[i], config, null, lock)
                } else {
                    if (!isInstance) d = this.assingMod(jobArr[i], null, null, lock)
                    else d = jobArr[i]
                }
                modsArr.push(d)
            }
            if (modsArr.length === total) return modsArr
            else return null
        }

        /**
         * @validJobDataSet
         * test `PRM` data attributes is valid
         * return true/false
         */
        validJobDataSet(data) {
            if (isEmpty(data)) return false
            if (isArray(data)) return false

            var attrsFiltered = this.dataArchAttrs.filter(z => z !== 'error' && z !== 'complete')
            var dataCopy = omit(data, ['complete', 'error'])
            return attrsFiltered.length === Object.keys(dataCopy).length
        }

        availRef(uid) {
            var a = this.dataArchSealed[uid] !== undefined
            var b = this.dataArch[uid] !== undefined
            var c = this.resIndex[uid] !== undefined
            var valid = a && b && c
            if (!valid) {
                if (this.debug) notify.ulog(`seams that uid provided does not match any available data by reference`, true)
            }
            return valid
        }

        /**
         * @strictJob
         * make sure that we do not repeat same jobs if set to `strictMode`
         */
        strictJob(uid) {
            // track job history in strict mode
            if (this.strictMode) {
                if (this.jobUID_history[uid] === true) {
                    if (this.debug) notify.ulog(`since we are in strictMode, this job was already completed once before!, job ignored!`, true)
                    return true
                }
                if (this.jobUID_history[uid] === undefined) this.jobUID_history[uid] = false
                return false
            }
            return false
        }

        /**
         * @dataAssesment
         * check to see if all of jobs dataSets are marked `complete`, when they are issue delete of job uppon resolution
         * returns true/false/null
         */
        dataAssesment(uid, data) {
            this.valUID(uid)
            if (isEmpty(data)) return null
            if (!isArray(data)) return null
            if (!this.onlyComplete) return null

            var archJobSetCount = (this.dataArch[uid] || []).length
            var finalDataComplCount = 0

            for (var i = 0; i < data.length; i++) {
                var job = data[i]

                if (!this.validJobDataSet(job)) {
                    if (this.debug) notify.ulog(`[dataAssesment] dataSet is not valid for ${uid}`, true)
                    continue
                }
                if (job.complete) finalDataComplCount++
            }

            return archJobSetCount === finalDataComplCount
        }

        /**
         * @valUID
         * - validate uid make sure is good
         */
        valUID(uid, ignore = null) {
            if (ignore) return this
            if (!uid) throw ('must provide uid!')
            if (!isString(uid)) throw ('uid must be a string')
            if (uid.length < 2) throw ('uid must be longer then 1')
            if (uid.split(' ').length > 1) throw ('uid cannot have any empty space!')
            if (uid.indexOf(',') !== -1) throw ('uid cannot have commas!')
            return true
        }
    }

    return PRMHelpers
}
