
/**
 * @PRMHelpers
 */
module.exports = (notify, PayloadResolutioManager) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isFunction, isArray, isString, cloneDeep, reduce, head, isUndefined, omit, isObject, omitBy } = require('lodash')
    const PrmProto = require('./prm.proto')(notify)
    const SimpleDispatch = require('./prm.simpleDispatch')(notify)
    class PRMHelpers extends PayloadResolutioManager {
        constructor(debug, opts) {
            super(debug, opts)

            this._PrmProto = null
            this.onModelStateChange_cb = null
            this.ProtoStateChange_set = null
            this._dspch = {} // collect SimpleDispatch instances
            // NOTE collection of PrmProto state changes
            this.modelStateChangeHistory = {/** uid:{cb, PrmModel} */}
            this.modelStateChange_cbs = {}

            if (typeof this.PrmProto.modelStateChange === 'function') {
                // NOTE
                // to reduce memory only use `modelStateChange` feature when these conditions are met
                // `onModelStateChange_cb` is set when user decides to use PRM model change events
                // onModelStateChange_cb will not work on it own since the callback is initiated later then class init, so we have to use `simpleDispatch` for this
                const onlyIf = (this.onlyCompleteJob === true && this.batch) || isFunction(this.onModelStateChange_cb)

                if (onlyIf) this.initProtoStateChange()
            }

            this.nextDispatch = new this.simpleDispatch('modelStateREF', ({ event }, id) => {
                if (event === 'onModelStateChange') {
                    this.initProtoStateChange()
                }
            })
        }

        initProtoStateChange() {
            if (this.ProtoStateChange_set === true) return

            this.PrmProto.modelStateChange((uid, model) => {
                // NOTE start counting callbacks and data once resolution was called
                // this will cause a lazy callback after resolution
                if (this.onlyCompleteJob === true && this.batch) {
                    if (this.resolutionINDEX[uid]) {
                        if (!this.modelStateChangeHistory[uid]) this.modelStateChangeHistory[uid] = []
                        this.modelStateChangeHistory[uid].push(model)
                        // NOTE function is set from `batchReady` method that calls after 'resolution' does
                        if (typeof this.modelStateChange_cbs[uid] === 'function') {
                            const historyStat = this.checkModelHistoryState(uid)
                            if (historyStat) {
                                this.modelStateChange_cbs[uid]({ complete: true, uid })
                                this.clearStateData(uid)
                            }
                        }
                    }
                }

                // for user output only
                if (typeof this.onModelStateChange_cb === 'function') {
                    this.onModelStateChange_cb(uid, cloneDeep(model))
                }
            })

            this.ProtoStateChange_set = true
        }

        get PrmProto() {
            if (this._PrmProto) return this._PrmProto
            this._PrmProto = new PrmProto(this.debug)
            return this._PrmProto
        }

        clearStateData(uid) {
            delete this.modelStateChangeHistory[uid]
            delete this.modelStateChange_cbs[uid]
            delete this.resolutionINDEX[uid]
            if (this.debug) notify.ulog(`[clearStateData] state data cleared`)
        }

        /**
         * @checkModelHistoryState
         * filter out true or false if anyone model for each jobs is complete
         */
        checkModelHistoryState(uid) {
            if (!this.modelStateChangeHistory[uid]) return false
            // if any collected
            return this.modelStateChangeHistory[uid].filter(model => {
                return model.complete
            }).length > 0
        }
        /**
         * TODO
         * - add another callback listener to execute lazy batchReady when all dataItems are complete
         */
        /**
         * @onModelStateChange
         * listen for PromProto changes on each job dataSet
         * - extention of `PrmProto.modelStateChange` class
         * - state change only returns new changes, compares previous to current states, to only return latest new changes, same changes are ommited.
         * cb: cb(uid, PrmProto)
         */
        onModelStateChange(cb) {
            const notSet = this.onlyCompleteJob === true && this.batch
            if (!notSet) {
                this.onModelStateChange_cb = cb
                // alert onModel lazy change that callback is available
                this.nextDispatch.next({ event: 'onModelStateChange' })
            }

            return this
        }

        /**
         * @incrementResolutionCalls
         * count how many times resolution was called, and initiate callback to `batchReady`
         * - only if `onlyCompleteJob` is set
         * @param {*} uid
         */
        incrementResolutionCalls(uid) {
            if (this.onlyCompleteJob && this.batch) {
                // console.log('set incrementResolutionCalls', uid)
                if (this.resolutionINDEX[uid] !== undefined) {
                    this.resolutionINDEX[uid]++
                } else {
                    this.resolutionINDEX[uid] = 1
                }
                if (typeof this.resolutionINDEX_cb === 'function') {
                    this.resolutionINDEX_cb(uid)
                    console.log('callback for ', uid)
                }
            }
        }

        get simpleDispatch() {
            return new SimpleDispatch().dispatch
        }

        /**
         * @dispatcher
         * collect all dispatchers so not are anonumous
         * @param {*} uid
         * @param {*} cb
         */
        dispatcher(uid, cb) {
            if (!this._dspch[uid]) {
                this._dspch[uid] = new this.simpleDispatch(uid, cb)
            }
            return this._dspch[uid]
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
            * @uncompleteJobMessage
            * NOTE when `autoComplete` is not set and either `onCompleteSet` or `onCompleteJob`
            * are set,  and output returns null it means that `dataArch[uid]` is still available to uncompleted jobs
            * So you have to mark each `.complete` if you with it to return
        */
        uncompleteJobMessage(outputIs) {
            if (isEmpty(outputIs) && !this.autoComplete &&
                (this.onCompleteSet || this.onCompleteJob) === true) {
                if (this.debug) {
                    notify.ulog(`[resolution], output return empty since you havent marked any jobs as .complete, or have not run compute method, alternativety you can manualy run complete(uid) method before resolution() call`)
                }
            }
        }

        /**
         * @resolutionNearStatus
         * when `onlyCompleteSet` or `onlyCompleteJob` are set it will only collect job completed items
         * when `batch`  is set, and data available (except for default), each batch item will be stored in `batchDataArch`
         * @param resolutionOutput # required
         * @param uid # required
         */
        resolutionNearStatus(resolutionOutput, uid) {
            if (isEmpty(resolutionOutput) || !uid) {
                throw ('[resolutionNearStatus] params cannot be empty')
            }
            const batchDataArchStatus = (() => {
                const btch = cloneDeep(this.batchDataArch)
                var index = 0
                for (var k in btch) {
                    if (k === uid) continue // skip current selection
                    if (isEmpty(btch[k])) continue
                    else if ((btch[k] || []).length) index++ // count previous batch selection
                }
                return index > 0
            })()
            // console.log('batchDataArchStatus', batchDataArchStatus)
            // console.log('resolutionOutput.selected', resolutionOutput.selected)
            // console.log('resolutionOutput.output', resolutionOutput.output)
            var _default = resolutionOutput.selected === 'default'
            var onlyCompleteJob = (resolutionOutput.selected === 'onlyCompleteJob' && !isEmpty(resolutionOutput.output))
            var onlyCompleteSet_a = (resolutionOutput.selected === 'onlyCompleteSet' && !isEmpty(resolutionOutput.output))

            // NOTE to resolve batchReady when some completion is available
            var onlyCompleteSet_b = ((resolutionOutput.selected === 'onlyCompleteSet' &&
                isEmpty(resolutionOutput.output)) && batchDataArchStatus)
            return _default || onlyCompleteJob || onlyCompleteSet_a || onlyCompleteSet_b
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
                            if (item.dataSet !== undefined) {
                                //  const onlyCompleted = item.filter(z => item.complete)
                                o.push(item.dataSet)
                            }
                            if (item.error !== undefined) o.push({ dataSet: item.dataSet, error: item.error })
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
            /**
             * possible error triggers
             * * running compute() after resolution() already set with the setting `onlyCompleteSet`
             *  - this means job already complete and all data was cleared, so compute() will not know your setting
             */

            if (ignore) return this
            if (!uid) {
                if (isEmpty(this.dataArch) && (this.onlyCompleteSet || this.onlyCompleteJob)) {
                    if (this.debug) {
                        notify.ulog(`possibly you called method without setting uid, or you already called resolution(), so job data was completed and cleared. This may happen with {onlyCompleteSet} or {onlyCompleteJob} being set`)
                    }
                }

                throw ('must provide uid!')
            }
            if (!isString(uid)) throw ('uid must be a string')
            if (uid.length < 2) throw ('uid must be longer then 1')
            if (uid.split(' ').length > 1) throw ('uid cannot have any empty space!')
            if (uid.indexOf(',') !== -1) throw ('uid cannot have commas!')
            return true
        }
    }

    return PRMHelpers
}
