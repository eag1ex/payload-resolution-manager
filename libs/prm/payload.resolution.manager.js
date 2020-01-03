/**
 * @PayloadResolutioManager
- You are issuing many async calls and want to be able to track all the requests by uniq id.
- Individual sets of data[index] that maybe worked on independently (out-of-order) will be tracked with resolution index (`_ri`).
 * `Example` You issued 20 requests, each request 5 data sets [x5]. Because all 20 requests are issued at the same time, each set will be out-of-order, we can track each request's `payload/array` with resolution index, and correctly collect data in the end.
 */

module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isString, uniq, cloneDeep, reduce, isObject, merge, indexOf, isArray, isNumber, head, flatMap, times, isBoolean } = require('lodash')

    const BatchCallbacks = require('./batch.callbacks')(notify)
    const PRMTOOLS = require('./prm.tools')(notify, BatchCallbacks)

    class PayloadResolutioManager extends PRMTOOLS {
        constructor(debug, opts = {}) {
            super(debug)

            // NOTE setting PRM opts
            this.optConfig(opts)
            // end

            // count calls to resolution method, only when data is available regrdless if complete or not
            this.resolutionINDEX = {/** uid:index */}
            this.resolutionINDEX_cb = {/** uid:cb */}
            // resolution index
            this._resIndex = {
                // [uid]:[]< payload size each number is data set, must be uniq
            }
            this.jobUID_history = {}// keep history of all jobs if `strictMode` is set
            this.debug = debug
            this._dataArch = {
                // NOTE
                // [uid]:[...] payload data set each `data` is appended `_ri` < `Resolution Index`
                /**
                 * example: [uid]:[{dataSet, _uid, _ri, _timestamp},...]
                 */
            }
            this.batchDataArch = {} // collect jobs athat belong to a batch if `batch=true` is set

            this._uidsetting = {} // user defind setting updated via `costumization` method
            this.lastUID = null // last updated uid
            this._lastItemData = null // last updated at `resolution` methode
            this.singleSet = null // return only set that was updated
            this.d = null // updated via `set` methode
            // once all data for each payload resolution is set to be worked on, we mark it as true
            // grab last data returned by `set`
            this.grab_ref = {
                // uid > this.d
            }
            this.dataArchSealed = {}
            this.lastAsync = {} /// last async holds promise for each job that was passed as a promise, once  promise is resolved data is accesable, `lastAsync` is just a boolean, an indicator when data is ready, user needs to know if returning a promise, should pass in a callback, or resolve data first from `resolution.then(()=>...)`
        }

        optConfig(opts) {
            this.asAsync = opts.asAsync || null // to allow return of data as promise with implementation of `XPromise`
            // NOTE
            // if `hard` is set any invalid dataSet will be unset
            // if `soft` is set original dataSet will be kept
            this.invalidType = opts.invalid || 'soft' // `soft` or `hard`
            this.strictMode = opts.strictMode || null // makes sure that same jobs cannot be called again
            this.batch = opts.batch || null
            this.resSelf = opts.resSelf || null // if true resolution will return self instead of value
            /*
            NOTE
            `resolution` and `batchReady` is fulfilled if all dataSets marked `complete`, this option is more stricted as if does not reset variable scope if not completed as opose to `onlyCompleteSet`
            */
            this.onlyCompleteJob = opts.onlyCompleteJob || null

            // NOTE when set resolution will only resolve items that are marked as complete
            this.onlyCompleteSet = opts.onlyCompleteSet || null
            // when using batch onlyCompleteSet is reset, because we complete each job once a batch of jobs is all complete
            this.autoComplete = opts.autoComplete || null // when set after performing compute for `each` every item iteration will automaticly be set with `complete`, when not set, you have to apply it each time inside every compute callback

            // when piping we cannot chain `resolution(..)` method
            if (this.asAsync) this.resSelf = null

            // NOTE onlyCompleteJob supress onlyCompleteSet
            if (this.onlyCompleteJob || (this.onlyCompleteJob && this.onlyCompleteSet)) {
                this.onlyCompleteSet = null
            }
        }

        /**
         * @dataArchAttrs
         * all available attrs that can be passed to each set item of each `_uid`
         */
        get dataArchAttrs() {
            return ['dataSet', '_uid', '_ri', '_timestamp', 'complete', 'error']
        }

        timestamp() {
            return new Date().getTime()
        }

        /**
         * @getUIDS
         * return all uid keys accending, by first data update, or set change
         */
        getUIDS() {
            var uids = Object.keys(this.dataArch).map(z => head(this.dataArch[z])).sort((a, b) => {
                return Number(a._timestamp) - Number(b._timestamp)
            }).map(z => z._uid)

            if (isEmpty(uids)) return null
            else return uids
        }

        /**
         * @set
         * `uid` must specify uid which will identify this dataSet
         * `data` must provide an array
         * - with wrap your payload as array in resolution format
         */
        set(data, uid) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            if (this.dataArchSealed[uid]) {
                if (this.debug) notify.ulog('[set] data already sealed cannot update', true)
                return this
            }
            if (this.strictJob(uid) === true) {
                return this
            }

            this.d = this.setRequestPayload(data, uid)
                .getSet(uid) // return item dataSet[...]

            // this.d = this.loopAssingMod(this.d)

            this.grab_ref[uid] = this.d
            return this
        }

        /**
         * @updateDataSet
         * - update dataSet target by `_ri`
         * `_ri` must be a number, starts from 0
         * `newDataSet` :  data you want to include in your updated dataSet example: {name, age}, or, can be any value
         * `type` : merge > you want to merge old with new , new> you want to replace the orl
         */
        updateDataSet(uid, _ri, newDataSet = null, type = 'new') {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            if (this.strictJob(uid) === true) {
                return this
            }

            this.d = null

            var isNum = (d) => {
                return typeof d === 'number'
            }

            if (_ri === undefined) {
                if (this.debug) notify.ulog('[updateDataSet] _ri must be a number', true)
                return this
            }

            if (!isNum(_ri)) {
                if (this.debug) notify.ulog('[updateDataSet] _ri must be a number', true)
            }

            if (newDataSet === null) {
                return this
            }

            if (!this.dataArch[uid]) {
                if (this.debug) notify.ulog('[updateDataSet] uid doesnt exist', true)
                return this
            }
            if (this.dataArchSealed[uid]) {
                if (this.debug) notify.ulog('[updateDataSet] data already sealed cannot update', true)
                return this
            }

            var updated = null
            for (var i = 0; i < this.dataArch[uid].length; i++) {
                var dataSets = this.dataArch[uid][i].dataSet
                if (dataSets !== undefined) {
                    if (this.dataArch[uid][i]._ri === _ri) {
                        try {
                            if (type === 'new') this.dataArch[uid][i].dataSet = newDataSet
                            if (type === 'merge') this.dataArch[uid][i].dataSet = merge(dataSets, newDataSet)

                            this.d = this.dataArch[uid][i].dataSet
                            this.dataArch = Object.assign({}, this.dataArch)
                            updated = true
                        } catch (err) {
                            if (this.debug) notify.ulog(err, true)
                        }
                    }
                }
            }

            if (!updated) {
                if (this.debug) notify.ulog('[updateDataSet] nothing updated, ri match not found', true)
            }

            return this
        }

        /**
         * @updateSet
         * update itemDataSet only, if previously set by `set` !
         * does not grow item, only preplace with new data
         * `newData` must provide raw data returned from `set` or use `getSet(uid)` and return it here
         */
        updateSet(newData, uid) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            if (this.strictJob(uid) === true) {
                return this
            }
            this.valUID(uid)

            this.d = null

            if (this.dataArchSealed[uid]) {
                if (this.debug) notify.ulog('data already sealed cannot update', true)
                return this
            }

            this.d = null

            if (!isArray(newData)) {
                if (this.debug) notify.ulog('newData must be an array, nothing done', true)
                return this
            }

            if (!newData.length) {
                if (this.debug) notify.ulog('newData cannot be empty, nothing done', true)
                return this
            }

            var newItemDataSet = this._validDataItem(newData, uid)
            if (!isEmpty(newItemDataSet) && isArray(newItemDataSet)) {
                try {
                    for (var i = 0; i < this.dataArch[uid].length; i++) {
                        var test = this.dataArch[uid][i]
                        var job = newItemDataSet[i]
                        if (!job) break

                        if (job._ri === test._ri) {
                            this.dataArch[uid][i] = job
                        }
                    }
                } catch (err) {
                    if (this.debug) notify.ulog(err, true)
                }
                this.dataArch = Object.assign({}, this.dataArch)
                this.d = cloneDeep(this.dataArch[uid])
                return this
                /// this._resIndex[] < remain the same, we only updating data
            } else {
                return this
            }
        }

        /**
         * @validDataItem
         * provide data array with `_uid` and `_ri`, will check for existence and return new data maping old item
         * `dataRef` provide if other then `dataSet`
         */
        _validDataItem(newData, uid, dataRef = null) {
            var item = []

            var matched_ris = []
            if (!this.dataArch[uid]) return null

            // if (newData.length !== this.dataArch[uid].length) {
            //     console.log('new d wrong len', newData)
            //     return null
            // }
            for (var i = 0; i < newData.length; i++) {
                var itm = newData[i]
                if (!isObject(itm) && !isArray(itm)) break

                // update `item`

                for (var ii = 0; ii < this.dataArch[uid].length; ii++) {
                    var z = this.dataArch[uid][ii]
                    if (z._uid === itm._uid && z._ri === itm._ri) {
                        dataRef = dataRef || 'dataSet'
                        var el = {}

                        var anonymousKey = Object.keys(z).filter(n => {
                            var except = this.dataArchAttrs.filter(nn => (nn === n && n === dataRef)).length === 1
                            return except// n !== '_ri' && n !== '_uid' && n !== '_timestamp' && n !== 'complete'
                        })
                        if (anonymousKey.length === 1) {
                            el[dataRef] = itm[head(anonymousKey)] // newData
                            el['_ri'] = z._ri
                            el['_uid'] = z._uid

                            if (z._error) el['error'] = z._error

                            if (z.complete !== undefined) el['complete'] = z.complete
                            el['_timestamp'] = z._timestamp
                        } else {
                            if (this.debug) notify.ulog(`ups no dataSet, other then _uid/_ri are available for update!, nothing done`, true)
                            break
                        }

                        if (!isEmpty(el)) {
                            // check if match our resIndex, should exist
                            if (indexOf(this.resIndex[uid], el._ri) !== -1) {
                                matched_ris.push(el._ri)
                            }
                            item.push(el)
                        }
                        break
                    }
                } // if
            }// for

            if (item.length) {
                return item
            } else {
                if (this.debug) notify.ulog('resIndex did not match newData', true)
                return null
            }
        }

        get itemDataSet() {
            return this._itemDataSet
        }

        /**
         * @itemDataSet
         * for use with compute for `each` callback when uid===false or not provided
         * must return an array of item/s with valid `dataSet`, `_ri` and `_uid`
         */
        set itemDataSet(v) {
            if (v === null) return

            if (!isArray(v)) {
                if (this.debug) notify.ulog('itemDataSet must be an array', true)
                return
            }

            var validData = v.filter(z => {
                var uid = z._uid
                var ri = z._ri
                if (this.dataArch[uid]) {
                    var mch = this.dataArch[uid].filter(n => {
                        if (n._uid === uid && ri === n._ri) {
                            return true
                        }
                    })
                    return mch.length
                }
                return false
            })
            if (validData.length) {
                this._itemDataSet = validData
                if ((this._itemDataSet || []).length !== v.length) {
                    if (this.debug) notify.ulog({ message: 'some items in dataSet provided were not valid, not all were updated', validSize: this._itemDataSet.length })
                }
            } else {
                if (this.debug) notify.ulog({ message: 'no valid data to update using itemDataSet, possibly your uids and/or ris do not match items in our scope', data: v }, true)
            }
        }

        /**
         * @reset
         * only call reset with `force=true`
         */
        reset(uid, force = true) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            if (!force) return
            this._lastItemData = null
            delete this.dataArchSealed[uid]
            delete this.grab_ref[uid]
            this.lastUID = null
            this._itemDataSet = null
            this.d = null
            return this
        }

        /**
         * @delSet
         * - delete set by `uid`
         */
        delSet(uid, force = false) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            this.valUID(uid)

            var copyArch = cloneDeep(this.dataArch)
            var copyIndex = cloneDeep(this.resIndex)

            delete this.dataArchSealed[uid]
            delete this._dataArch[uid]
            delete this._resIndex[uid]

            // NOTE `jobUID_history` sould never be purged, kept for reference

            // delSet is performed from resolution when option `doDelete is set`, followed by rest

            this.reset(uid, force)

            if (this.debug) {
                var countA = Object.keys(copyArch).length - Object.keys(this.dataArch).length
                var countB = Object.keys(copyIndex).length - Object.keys(this.resIndex).length
                notify.ulog({ message: 'deleted count', dataArch: countA, resIndex: countB, uid })
            }
            return this
        }

        /**
         * @itemData
         * - return clean data from dataSet without `_ri` and `_uid`
         * `dataRef` : provide if data does not include dataSet
         * `data` : provide data that you have worked on, should be same array index as as original
         * `external` when provided class will not check for size validation, but format must match
         * `withErrors` in case you want to check for errors,  [{dataSet, error}]
         */
        itemData(data, uid, dataRef, external = null, withErrors = null) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            this.valUID(uid)
            if (!external) {
                if (!this.availRef(uid)) return null
            }

            if (isArray(data)) {
                if (!external) {
                    if (!this.resIndex[uid]) {
                        if (this.debug) notify.ulog(`[itemData] provided uid not found`, true)
                        return null
                    }
                    var validSize = data.length === this.resIndex[uid].length
                    if (!validSize) {
                        if (this.debug) notify.ulog(`[itemData] provided data size does nto match the size of original payload!`, true)
                        return null
                    }
                }

                return reduce(cloneDeep(data), (n, el, i) => {
                    var df = dataRef || 'dataSet'
                    if (uid === el._uid) {
                        // NOTE will return an object regardless there are errors or not
                        if (withErrors === true) {
                            n.push({ dataSet: el[df], error: el.error || null })
                        } else n.push(el[df])
                    }
                    return n
                }, [])
            } else {
                if (this.debug) notify.ulog(`provided data must be an array, nothing done original returned`)
                return data //
            }
        }

        /**
         * @formated
         * - return formated data with `_uid` and `_ri` etc, if `clean=true`
         * - `uid` must already be available to format this item
         * - data will not be combined with `dataArch` chain
         * `external` when provided class will not check for size validation, but format must match
         */
        formated(data, uid, external = null) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            this.valUID(uid)
            if (!this.availRef(uid) && !external) return null
            if (!isArray(data)) throw (`you must provide an array for data!`)

            var validSize = data.length === this.resIndex[uid].length

            if (!validSize && !external) {
                if (this.debug) notify.ulog(`[formated] provided data size does not match the size of original payload!`, true)
                return null
            }

            var setReady = []
            var d = cloneDeep(data)
            for (var i = 0; i < d.length; i++) {
                var dataSet = d[i]

                var o = {}
                var df = 'dataSet'
                o[df] = dataSet
                o['_ri'] = i
                o['_uid'] = uid
                o['_timestamp'] = this.timestamp()
                setReady.push(o)
            }
            return setReady
        }

        /**
         * @_resolution_item
         * mothod called by resolution, to allow grouping calls
         */
        _resolution_item(yourData, uid, doDelete = true, pipe) {
            var resSelf = !!(this.resSelf && !this.asAsync) // can use self if not using pipe
            resSelf = resSelf && !pipe ? true : resSelf // can override if using async when pipe is disabled

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
                if (!this.onlyCompleteJob) this.reset(uid)
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
                        if (!this.onlyCompleteJob) job.complete = true
                    })
                }
                fData = [].concat(perDataSet(itemDataSets, uid), fData)
            }

            if (!this.resIndex[uid]) {
                if (this.debug) notify.ulog({ message: '[resolution] uid provided did not match resIndex' }, true)
                if (!this.onlyCompleteJob) this.reset(uid)
                return returnAS(null)
            }
            if (!fData.length) {
                if (doDelete && !this.onlyCompleteJob) this.delSet(uid)
                if (this.debug) notify.ulog({ message: '[resolution] fData[] no results' }, true)
                if (!this.onlyCompleteJob) this.reset(uid)
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

                /**
                 * when `onlyCompleteSet` or `onlyCompleteJob` are set it will only collect job completed items
                 * when `batch`  is set, and data available (except for default), each batch item will be stored in `batchDataArch`
                 */

                const resolutionOK = (() => {
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
                })()

                if (this.batch && resolutionOK) {
                    this.batchDataArch[uid] = [].concat(resolutionOutput.output, this.batchDataArch[uid])
                    this.batchDataArch[uid] = this.batchDataArch[uid].filter(z => z !== undefined)
                    // make sure it calls after anything
                    setTimeout(() => {
                        this.batchCB(uid) // set
                        // NOTE when invoking this we make sure that `batchDataArch` is already set!
                        if (typeof this.resolutionINDEX_cb[uid] === 'function') {
                            this.resolutionINDEX_cb[uid]('resolution batch ready')
                        }
                    }, 100)
                }
                // NOTE increment how many times resolution is called for each job
                // used with lazy PrmProto callback when complete, so batchReady can make final call
                this.incrementResolutionCalls(uid)

                // all good
                if (resolutionOK) this.reset(uid)
                /// in `strictMode` add last completed job to history so it is not allowed to call same uid again
                // but when `onlyCompleteJob` is set this condition is enabled from `batchReady` method
                if (this.strictMode === true && !this.onlyCompleteJob) {
                    if (this.jobUID_history[uid] === false) this.jobUID_history[uid] = true
                }
                return returnAS(resolutionOutput.output)
            } else {
                var failed_index = Object.keys(verify).filter(z => verify[z] === false)
                notify.ulog({ message: '[resolution] falied to match resIndex', failed_index, uid })
                if (doDelete && !this.onlyCompleteJob) this.delSet(uid)
                if (!this.onlyCompleteJob) this.reset(uid)
                return returnAS(null)
            }
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
         * `uid:Array` : can provide array(..) of uids, `externalData` option not available for multi returns,
         *
         * `pipe` pipe is used wiht prm.async.extention so not change it here
         * - return item
         */
        resolution(externalData = null, uid, dataRef, doDelete = true, pipe) {
            var resSelf = !!(this.resSelf && !this.asAsync) // can use self if not using pipe
            resSelf = resSelf && !pipe ? true : resSelf // can override if using async when pipe is disabled
            if (!externalData && isArray(uid)) {
                var items = {}
                for (var i = 0; i < uid.length; i++) {
                    var d = this._resolution_item(externalData, uid[i], dataRef, doDelete)
                    items[uid] = d
                }
                if (resSelf) {
                    this.d = d
                    return this
                } else return d
            } else {
                if (!uid) uid = this.lastUID
                else this.lastUID = uid
                this.valUID(uid)
                return this._resolution_item(externalData, uid, dataRef, doDelete)
            }
        }

        /**
         * @markDone
         * - mark `dataArch`[index] as ready for delivery
         * - you should set it just before return, or after async call!
         * - will also mark all dataSets as readyOnly so cannot be modified!
         */
        markDone(uid) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            this.valUID(uid)
            if (!this.dataArch[uid]) {
                if (this.debug) notify.ulog(`[markDone] cannot mark this uid since data does not exist`, true)
                return this
            }
            this.dataArchSealed[uid] = true

            if (this.autoComplete || this.onlyCompleteSet) {
                this.dataArch[uid].forEach((job, inx) => {
                    job.complete = true
                })
            }
            // and remove all write privileges from dataSet's
            this.dataArch[uid] = this.loopAssingMod(cloneDeep(this.dataArch[uid]), { enumerable: true, writable: false, configurable: true }, true)
            return this
        }

        /**
         * @dataArchWhich
         * decide which `dataArch` index to return when using PRMTOOLS
         */
        dataArchWhich() {
            const fromOK = this._fromRI !== undefined && this._fromRI !== null
            const ofOK = this.lastUID !== undefined && this.lastUID !== null
            const filterOK = this._lastFilteredArchData !== undefined && this._lastFilteredArchData !== null

            if (!fromOK && !filterOK) {
                return this.dataArch[this.lastUID]
            }

            var dataArch_copy = cloneDeep(this.dataArch)

            if (ofOK) {
                dataArch_copy = dataArch_copy[this.lastUID] // takes priority
            }

            // `filter(()=>)`
            if (this._lastFilteredArchData && ofOK) {
                if (isEmpty(dataArch_copy)) return []

                // NOTE we do not use this filtered data, we only need it for reference so we can match it with original asset

                // grab all `_ri` references
                var ri_refs = this._lastFilteredArchData.map(z => z._ri)
                this._lastFilteredArchData = null
                if (!ri_refs.length) return []

                dataArch_copy = dataArch_copy.filter(z => {
                    return indexOf(ri_refs, z._ri) !== -1
                })
            }

            if (fromOK && ofOK && !filterOK) {
                var dataReduced = []
                for (var i = 0; i < dataArch_copy.length; i++) {
                    var job = dataArch_copy[i]
                    if (!job) continue
                    if (job._ri >= this._fromRI) {
                        dataReduced.push(job)
                    }
                }
                dataArch_copy = dataReduced
            }

            // reset every call
            this._fromRI = null

            if (isEmpty(dataArch_copy)) {
                // if (this.debug) notify.ulog(`[dataArchWhich] ups _ofUID or _fromRI didnt provide correct results, nothing changed`, true)
                return this.dataArch[this.lastUID]
            }

            return dataArch_copy
        }

        /**
         * @dataArch
         * - validate dataArch model contains correct attributes such as `_uid` and `_ri`
         */
        set dataArch(v) {
            if (isArray(v) && isObject(v)) throw ('v must be an object')
            if (!isObject(v)) throw ('v must be an object')
            // test dataArch format is valid
            var err_format = null
            reduce(cloneDeep(v), (n, el, k) => {
                if (!isArray(el)) err_format = k
                else {
                    el.map(z => {
                        var dset = (z || {}).dataSet
                        if (dset === undefined) {
                            console.log('err dataSet must be defined')
                            err_format = k
                        }
                        if (!isNumber((z || {})._ri)) {
                            console.log('err not number')
                            err_format = k
                        }
                        if (!isString((z || {})._uid)) {
                            console.log('err not string')
                            err_format = k
                        }
                        if (!isNumber((z || {})._timestamp)) {
                            console.log('err not number')
                            err_format = k
                        }
                        if ((z || {}).complete !== undefined) {
                            if (!isBoolean(z.complete)) {
                                console.log('err not boolean')
                                err_format = k
                            }
                        }
                    })
                }

                return n
            }, {})
            if (err_format !== null) throw (`dataArch format invalid for: ${err_format}`)

            // NOTE
            // assign prototype to each job
            // will make sure that `_ri` and `_uid` cannot be changed or overriten
            for (var uid in v) {
                try {
                    // sort
                    v[uid] = v[uid].sort((a, b) => a._ri - b._ri)
                } catch (err) {
                    console.log('error sorting', err)
                }

                if (!v.hasOwnProperty(uid)) continue
                var job = v[uid]

                var n = this.loopAssingMod(job)

                // TODO add on dataSet update/change callback, to notify on any data changes, so we know when data is set 'complete'
                if (n) v[uid] = n
            }
            this._dataArch = v
        }

        get dataArch() {
            return this._dataArch
        }

        get resIndex() {
            return this._resIndex
        }

        set resIndex(v) {
            if (isArray(v) && isObject(v)) throw ('v must be an object')
            if (!isObject(v)) throw ('v must be an object')

            // check uniqnes or throw error
            var not_uniq = null
            reduce(cloneDeep(v), (n, el, k) => {
                var elTest = uniq(el)
                if (elTest.length !== el.length) not_uniq = k
                return n
            }, {})

            if (not_uniq !== null) {
                notify.ulog({ message: `resIndex is not uniq for ${not_uniq}`, v }, true)
                throw (`error`)
            }

            this._resIndex = v

            if (!isEmpty(v)) {
                if (this.debug) notify.ulog({ message: 'resolution index set', resIndex: this._resIndex })
            }
        }

        /**
         * @testItemExistence
         * check if item/uid exists outside in other items, then remove it and add back to correct item[uid]
         */
        testItemExistence(uid) {
            if (!uid) return this
            /**
             * test for existence of this uid in defferent items
             */
            var testExistence = () => {
                var t = this.dataArch
                var arr = []
                for (var k in t) {
                    if (k === uid) continue
                    if (!t.hasOwnProperty(k)) continue

                    var other = t[k]
                    var found = other.filter(z => {
                        return z._uid === uid
                    })

                    if (found.length) {
                        try {
                            // delete double match from other data and keep only in relevence to uid test
                            this.dataArch[k] = other.filter(z => {
                                return z._uid !== uid
                            })
                        } catch (err) {
                            if (this.debug) notify.ulog(err, true)
                        }
                        arr = [].concat(arr, found)
                    }
                }

                // update model
                if (arr.length) this.dataArch = Object.assign({}, this.dataArch)
                return arr
            }

            var exists = testExistence()
            // original size
            var orgSize = (this.dataArch[uid] || []).length
            var proposedSize = exists.length + orgSize
            if (proposedSize > orgSize) {
                // before adding found dataSets lets test for `_ri`, make sure all are uniq
                var together_ris = cloneDeep([].concat(exists, this.dataArch[uid])).map(n => {
                    return n._ri
                })

                var uniq_ok = together_ris.length === uniq(together_ris).length
                if (!uniq_ok) {
                    if (this.debug) notify.ulog('warning found uid dataSets in other items with few doubleups, those were ignored, only new added', true)
                }

                // add only by uniq
                var uniq_ris = together_ris
                var match_found = null
                for (var i = 0; i < exists.length; i++) {
                    var item = exists[i]

                    var mch = uniq_ris.filter(z => {
                        return z === item._ri
                    })

                    if (!mch.length) continue

                    if (mch.length) {
                        this._resIndex[uid] = [].concat(this._resIndex[uid], item._ri)
                        try {
                            this.dataArch[uid] = [].concat(this.dataArch[uid], item)
                        } catch (err) {
                            if (this.debug) notify.ulog(err, true)
                        }

                        match_found = true
                        if (this.debug) notify.ulog({ message: 'updated item dataSet', _ri: item._ri })
                    }
                }
                // update model
                if (match_found) this.dataArch = Object.assign({}, this.dataArch)
            } else {
                //  console.log('all pass, no existence found in other dataSets')
            }
            return this
        }

        /**
         * @getSet
         * `uid` must provide uid
         * `_self`  optional, if set specify `getSet.d` to return items data
         */
        getSet(uid, _self) {
            this.valUID(uid)

            this.d = null

            // only update if data not sealed
            if (!this.dataArchSealed[uid]) {
                this.testItemExistence(uid)
            }

            if (_self) {
                var d = cloneDeep(this.dataArch[uid])
                if (d) this.d = d
                return this
            }

            if (!_self) {
                return cloneDeep(this.dataArch[uid])
            } else {
                notify.ulog({ message: '[getSet] warning you cannot retrieve this items data, as it is not available', uid }, true)
            }
            return null
        }

        /**
         * @nextRI
         * - get last available `_ri` or return null
         */
        nextRI(_uid) {
            this.valUID(_uid)
            if (!this.dataArch[_uid]) return null

            var all_ris = this.dataArch[_uid].map(z => z._ri)
            return Math.max.apply(null, all_ris)
        }

        /**
         * @setEmptyArch
         * - every item that is valid must be set with `_uid` (uniq id) and `_ri` (resolution index)
         * - note `dataArch` validation will throw error if we have same `_ri` indexes
         */
        setEmptyArch(_uid) {
            this.valUID(_uid)
            var inx = this.nextRI(_uid)
            var nextRI = inx > 0 ? inx + 1 : 0
            var emptySet = [{ dataSet: [], _ri: nextRI, _uid, _timestamp: this.timestamp() }]

            if (this.dataArch[_uid]) {
                this.dataArch[_uid] = [].concat(this.dataArch[_uid], emptySet)
                this.singleSet = emptySet
            } else {
                this.singleSet = emptySet
                this.dataArch[_uid] = emptySet
            }

            if (this.resIndex[_uid]) this.resIndex[_uid] = [].concat(this.resIndex[_uid], emptySet[0]._ri)
            else this.resIndex[_uid] = [emptySet[0]._ri]

            this.resIndex = Object.assign({}, this.resIndex)
            this.dataArch = Object.assign({}, this.dataArch)
            this.dataArchSealed[_uid] = false
            return this
        }

        /**
         * @setRequestPayload
         * - will label each payload[index] with `_uid` and `resIndex` < resolution index
         * - will test data is an array
         *  sets dataArch[uid]:[{dataSet,_uid, _ri},...]
         * NOTE we cannot set initial data as error, in case it was async rejection, you have to take care of what is inputed to set() initialy
         */
        setRequestPayload(data, _uid) {
            this.valUID(_uid)

            if (isObject(data) && !isArray(data)) throw ('data must be an array[...]')
            if (!isArray(data)) throw ('data must be an array[...]')

            // this will help us to undestand any potential conflicts
            if (this.dataArchSealed[_uid] === true) {
                notify.ulog({ message: 'warning you cannot reset/update data of same uid if has already been marked, nothing done for this payload', uid: _uid }, true)
                return this
            }
            this.singleSet = null
            if (isEmpty(data)) {
                return this.setEmptyArch(_uid)
            }

            var setReady = []
            var last_ri = this.nextRI(_uid)

            for (var i = 0; i < data.length; i++) {
                var dataSet = data[i]
                // make sure `ri` is incremented and not repeated!
                var inx = last_ri === null ? i : last_ri = last_ri + 1
                setReady.push({ dataSet: dataSet, _ri: inx, _uid, _timestamp: this.timestamp() })
            }

            if (this.dataArch[_uid]) {
                this.dataArch[_uid] = [].concat(this.dataArch[_uid], setReady)
            } else {
                this.dataArch[_uid] = setReady
            }

            this.singleSet = setReady
            // NOTE update `resIndex` Object for later checks
            var irs = setReady.map(z => z._ri)
            if (this.resIndex[_uid]) this.resIndex[_uid] = [].concat(this.resIndex[_uid], irs)
            else this.resIndex[_uid] = irs

            this.resIndex = Object.assign({}, this.resIndex)
            this.dataArch = Object.assign({}, this.dataArch)

            // mark as updated, but not sealed
            this.dataArchSealed[_uid] = false

            return this
        }
    }
    const PRMcompute = require('./prm.compute')(notify, PayloadResolutioManager)
    const PRMHelpers = require('./prm.helpers')(notify, PRMcompute)
    const PRMbatchReady = require('./prm.batchReady')(notify, PRMHelpers)
    const prmAsync = require('./prm.async.extention')(PRMbatchReady, notify)
    class PRMext extends prmAsync {
        constructor(debug, opts) {
            super(debug, opts)
        }
    }

    return PRMext
}
