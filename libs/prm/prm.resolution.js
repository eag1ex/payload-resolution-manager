module.exports = (notify, PRM) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isObject, isArray, cloneDeep, isFunction } = require('lodash')

    return class PRMresolution extends PRM {
        constructor(debug, opts) {
            super(debug, opts)

            // when resolution was..  called we keep awareness
            this.resCalledIndex = {/** uid:index */}
            this._resCallback = {/** uid;cb */}// call resCallback to notify that resolution is finally completed, and return its data via callback method
        }

        /**
         * @resolution
         * - provides `.dataArch` from this class, unless you provide `externalData` > must be valid `[PrmProto,..]`
         * - when option `onlyCompleteJob` or `onlyCompleteSet` are selected, data will be resolved only if marked complete otherwise you can call `resolution()` repeatedly untill satisfied.
         * - sorl all `dataArch|externalData` to return coresponding dataSet by `uid`
         * - sets agains `resIndex` to make sure size of each payload matches the return for each dataset
         * - delete `dataArch|externalData` [index] and `resIndex`[index]
         * `dataRef`: example : externalData[uid][dataRef]
         * `doDelete:boolean` provide if you want to delete this arch data and resIndex
         * `uid:String` : provide uid
         * `pipe` pipe is used wiht prm.async.extention so not change it here
         * - return item
         */
        resolution(uid, externalData = null, dataRef, doDelete = true, pipe) {
            this.resData = null
            var resSelf = !!(this.resSelf && !this.asAsync) // can use self if not using pipe
            resSelf = resSelf && !pipe ? true : resSelf // can override if using async when pipe is disabled
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            this.valUID(uid)
            if (!resSelf) this.d = null
            return this._resolution_item(uid, externalData, dataRef, doDelete)
        }

        /**
         * @_resolution_item
         * mothod called by resolution, to allow grouping calls
         */
        _resolution_item(uid, yourData = null, doDelete = true, pipe) {
            var resSelf = !!(this.resSelf && !this.asAsync) // can use self if not using pipe
            resSelf = resSelf && !pipe ? true : resSelf // can override if using async when pipe is disabled

            const completeSETorJOB = (this.onlyCompleteJob || this.onlyCompleteSet) === true

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            // find all payloads that belong to same uid
            // will validate all payload items against `resIndex`

            if (resSelf) this.d = null

            if (this.strictJob(uid) === true) {
                if (resSelf) return this
                else return []
            }
            // count each resolution call for each job
            if (!this.resCalledIndex[uid]) this.resCalledIndex[uid] = 1
            else this.resCalledIndex[uid]++

            var returnAS = (output, _resSelf = resSelf) => {
                if (_resSelf) {
                    this.d = output
                    return this
                } else return output
            }

            var fData = []
            var perDataSet = (d, _uid) => {
                var data = []

                for (var i = 0; i < d.length; i++) {
                    var item = d[i]
                    if (item._uid === undefined) {
                        if (this.debug) notify.ulog(`[perDataSet] no _uid available for this dataaSet, skipping`, true)
                        continue
                    }
                    if (item._uid === _uid) data.push(item)
                }
                return data
            }

            var providerData = isObject(yourData) && !isArray(yourData) ? yourData : this.dataArch
            providerData = cloneDeep(providerData)

            // NOTE
            // do not continue if nothing todo
            if (!providerData[uid]) {
                if (!completeSETorJOB) this.reset(uid)
                return returnAS(null)
            }
            // set
            // cycle thru each reference
            for (var k in providerData) {
                if (!providerData.hasOwnProperty(k)) continue

                var itemDataSets = providerData[k]
                // if (itemDataSets.hasOwnProperty('dataSet')) itemDataSets = itemDataSets['dataSet']

                if (!itemDataSets) {
                    if (this.debug) notify.ulog(`itemDataSets not available`, true)
                    continue
                }
                if (!isArray(itemDataSets)) throw ('provided itemDataSets must be an array!')
                if (yourData) {
                    // if provided your own source just make sure we set it to compelete, except for `onlyCompleteJob`
                    itemDataSets.forEach((job, inx) => {
                        if (!completeSETorJOB) job.complete = true
                    })
                }
                fData = [].concat(perDataSet(itemDataSets, uid), fData)
            }

            if (!this.resIndex[uid]) {
                if (this.debug) notify.ulog({ message: '[resolution] uid provided did not match resIndex' }, true)
                if (!completeSETorJOB) this.reset(uid)
                return returnAS(null)
            }
            if (!fData.length) {
                if (doDelete && !completeSETorJOB) this.delSet(uid)
                if (this.debug) notify.ulog({ message: '[resolution] fData[] no results' }, true)
                if (!completeSETorJOB) this.reset(uid)
                return returnAS([])
            }
            // NOTE
            // final verification that data matches our request
            var verify = (cloneDeep(this.resIndex)[uid] || []).reduce((n, num, i) => {
                n[num] = false
                return n
            }, {})

            for (var i = 0; i < fData.length; i++) {
                var ri = fData[i]._ri
                if (ri === undefined) throw ('_ri must be provided for each dataSet')

                if (verify[ri] !== undefined) verify[ri] = true
            }

            var resolutionOutput = []
            var verify_index = Object.keys(verify).filter(z => verify[z] === true)

            if (verify_index.length === Object.keys(verify).length) {
                // update lastItem in our format
                this._lastItemData = fData
                resolutionOutput = this.resolutionType(uid, fData, deleteType => {
                    this.delSet(uid)
                    if (this.debug) notify.ulog(deleteType)
                }, doDelete)

                const resolutionOK = this.resolutionNearStatus(resolutionOutput, uid)

                /**  TODO
                 remember resolution outcome incase we called the method sooner then compute, due to irregular async situation, then invoke resolotion again after compute was called:
                - add invoke callback to compute to check if resolution is already in que
                - reinvoke resolution for same job again
                **/

                if (this.batch && resolutionOK) {
                    this.batchDataArch[uid] = [].concat(resolutionOutput.output, this.batchDataArch[uid])
                    this.batchDataArch[uid] = this.batchDataArch[uid].filter(z => z !== undefined)

                    this.eventDispatcher.initListener(uid, (d) => { })
                        .next(uid, { message: 'resolution set' })
                }
                // NOTE increment how many times resolution is called for each job
                // used with lazy PrmProto callback when complete, so batchReady can make final call
                // this.incrementResolutionCalls(uid)

                // all good
                if (resolutionOK) this.reset(uid)
                /// in `strictMode` add last completed job to history so it is not allowed to call same uid again
                // but when `onlyCompleteJob` is set this condition is enabled from `batchReady` method
                if (this.strictMode === true && !completeSETorJOB) {
                    if (this.jobUID_history[uid] === false) this.jobUID_history[uid] = true
                }

                /// /////////
                this.uncompleteJobMessage(isEmpty(resolutionOutput.output))
                /// ///////////
                this.resData = resolutionOutput.output
                // this should only work if we call same resolution more then once, that is the whole point of this callback!
                if (typeof this._resCallback[uid] === 'function') {
                    this._resCallback[uid](this.resData)
                }
                return returnAS(resolutionOutput.output)
            } else {
                var failed_index = Object.keys(verify).filter(z => verify[z] === false)
                notify.ulog({ message: '[resolution] falied to match resIndex', failed_index, uid })
                if (doDelete && !completeSETorJOB) this.delSet(uid)
                if (!completeSETorJOB) this.reset(uid)
                return returnAS(null)
            }
        }
        /**
         * @resCallback
         * @param {*} cb  required
         * @param {*} uid optional, will use last set uid
         * TODO not yet functional need to implement EventDispatcher
         */
        resCallback(cb, uid) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            this.valUID(uid)

            if (!isFunction(cb)) {
                notify.ulog(`[resCallback] cb must be a function`, true)
                return this
            }
            if (!this._resCallback[uid]) {
                this._resCallback[uid] = cb
            } else {
                if (this.debug) notify.ulog(`[resCallback] you already set one CB for uid:${uid}`)
            }
            return this
        }
    }
}
