
/**
 * @PRMHelpers
 */
module.exports = (notify, PayloadResolutioManager) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isArray, isString, cloneDeep, reduce, head, isUndefined, omit, isObject, omitBy } = require('lodash')
    const PrmProto = require('./prm.proto')(notify)
    class PRMHelpers extends PayloadResolutioManager {
        constructor(debug, opts) {
            super(debug, opts)
            this._PrmProto = null
        }

        get PrmProto() {
            if (this._PrmProto) return this._PrmProto
            this._PrmProto = new PrmProto(this.debug)
            return this._PrmProto
        }

        /**
         * @onUpdate
         * needs to be initiated first with `PrmProto`, listen for PromProto changes of each jobs uid dataSet
         * - method extention of `PrmProto.modelStateChange` class
         * cb: cb(uid, PrmProto)
         */
        onUpdate(cb) {
            this.PrmProto.modelStateChange(cb)
            return this
        }
        /**
         * @assingMod
         * assing prototype to each dataSet item
         * `dataSetItem`: must provide valid object
         * `config`: available options are: enumerable, writable configurable, and assigneld to `_uid` and `_ri`
         * `strip`: strip prototype from model
         */
        assingMod(dataSetItem, config = {}, strip = null, lock = null) {
            /**
             * IMPORTANT FACTS
             * due to not reinitiating new instance class of `PrmProto` to save memory.
             * we need to clone each assignment to be anonymous, because we are resetting `modelBase` each time `assign` is called.
             *
             * NOTE
             * - If it werent cloned, reset would remove all PrmProto data's belonging to each item.
             * - so now we can reuse the class for other purpose like event callback on data change!
             */
            var isInstance = dataSetItem instanceof PrmProto
            if (!isEmpty(config)) {
                return cloneDeep(this.PrmProto.assign(dataSetItem, config, strip, lock))
            } else {
                if (strip) return cloneDeep(this.PrmProto.assign(dataSetItem, null, strip))
                else {
                    if (isInstance) return dataSetItem
                    else return cloneDeep(this.PrmProto.assign(dataSetItem, null, null, lock))
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
                    if (!isInstance) {
                        d = this.assingMod(jobArr[i], null, null, lock)
                    } else d = jobArr[i]
                }
                modsArr.push(d)
            }
            if (modsArr.length === total) return modsArr
            else return null
        }

        /**
         * @resolutionType
         * provide resolution data base on {opts} setting, either `onlyCompleteSet` or `onlyCompleteJob`
         * sould return one job base on `requirement`
         * return { output, selected}
         */
        resolutionType(uid, fData, deleteCB, doDelete) {
            var requirement = head([{ name: 'onlyCompleteSet', value: this.onlyCompleteSet },
                { name: 'onlyCompleteJob', value: this.onlyCompleteJob }].filter(z => {
                return z.value === true
            }))

            if (isEmpty(fData)) return []

            const completedJobs = (_fData, onlyComplete = true) => {
                const o = []
                for (var n = 0; n < _fData.length; n++) {
                    var item = this.purgeEmpty(_fData[n])
                    // check if item is an object of arrays
                    if (isObject(item) && !isArray(item)) {
                        if (onlyComplete === true) {
                            if (item.complete === true && item !== undefined) {
                                if (item.error !== undefined) {
                                    o.push({ dataSet: item.dataSet, error: item.error })
                                } else o.push(item.dataSet)
                            }
                            continue
                        } else {
                            if (item.dataSet !== undefined && !this.onlyCompleteSet) {
                                o.push(item.dataSet)
                            }
                            if (item.error !== undefined && !this.onlyCompleteSet) o.push({ dataSet: item.dataSet, error: item.error })
                        }
                    }
                }
                return o
            }

            const onSwitch = (req) => {
                var output = []
                const name = (req || {}).name || ''
                switch (name) {
                    // NOTE resolution will only take to accout all dataSets that are marked as `complete`

                    case 'onlyCompleteSet':
                        output = completedJobs(fData)
                        break
                    case 'onlyCompleteJob':
                        const totaljobSize = fData.length
                        output = completedJobs(fData)
                        if (totaljobSize !== output.length) {
                            output = []
                            if (this.debug) notify.ulog(`[resolutionType] requirement to only set resolution if onlyCompleteJob is all complete, but not complete yet!, nothing to output`)
                        }
                        // code block
                        break
                    default:
                        /// no requirement set output all data
                        output = completedJobs(fData, false)
                }

                var assesmentComleted = this.dataAssesment(uid, fData)
                if (assesmentComleted || doDelete) {
                    // NOTE
                    // in case we marked `onlyCompleteSet` as an option, but data still exists and not completed
                    // so do not delete
                    if (!isEmpty(output)) {
                        deleteCB({ message: 'can delete cache' })
                    }
                }

                return { output, selected: name || 'default' }
            }

            // should return one job data requirement or default:
            return onSwitch(requirement)
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
         * dataAssesment is called in resolution stage
         */
        dataAssesment(uid, data) {
            this.valUID(uid)
            if (isEmpty(data)) return null
            if (!isArray(data)) return null
            // perform deletetion only if either is true
            var onlyComlete = this.onlyCompleteSet || this.onlyCompleteJob
            if (!onlyComlete) return null

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
