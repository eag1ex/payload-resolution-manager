/**
 * @PayloadResolutioManager
- You are issuing many async calls and want to be able to track all the requests by uniq id.
- Individual sets of data[index] that maybe worked on independently (out-of-order) will be tracked with resolution index (`_ri`).
 * `Example` You issued 20 requests, each request 5 data sets [x5]. Because all 20 requests are issued at the same time, each set will be out-of-order, we can track each request's `payload/array` with resolution index, and correctly collect data in the end.
 */

module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isString, uniq, cloneDeep, reduce, differenceBy, isObject, merge, indexOf, isArray, isNumber, head, isBoolean } = require('lodash')

    const PRMTOOLS = require('./prm.tools')(notify)
    class PayloadResolutioManager extends PRMTOOLS {
        constructor(debug, settings = {}) {
            super(debug)

            // NOTE setting PRM settings
            this.optConfig(settings)
            // end
            this.resData = null// cache last resolution data
            this._jobUID_temp = []
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

        optConfig(settings) {
            this.asAsync = settings.asAsync || null // to allow return of data as promise with implementation of `XPromise`
            // NOTE
            // if `hard` is set any invalid dataSet will be unset
            // if `soft` is set original dataSet will be kept
            this.invalidType = settings.invalid || 'soft' // `soft` or `hard` sets validation for compute()
            this.strictMode = settings.strictMode || null // makes sure that same jobs cannot be called again
            this.batch = settings.batch || null
            this.resSelf = settings.resSelf || null // if true resolution will return self instead of value
            /*
            NOTE
            `resolution` and `batchReady` is fulfilled if all dataSets marked `complete`, this option is more stricted as if does not reset variable scope if not completed as opose to `onlyCompleteSet`
            */
            this.onlyCompleteJob = settings.onlyCompleteJob || null

            // NOTE when set resolution will only resolve items that are marked as complete
            this.onlyCompleteSet = settings.onlyCompleteSet || null
            // when using batch onlyCompleteSet is reset, because we complete each job once a batch of jobs is all complete
            this.autoComplete = settings.autoComplete || null // when set after performing compute for `each` every item iteration will automaticly be set with `complete`, when not set, you have to apply it each time inside every compute callback

            // when asAsync===true we pipe original resolution value via `prm.async.extention.js` class
            if (this.asAsync) this.resSelf = null

            // NOTE onlyCompleteJob supress onlyCompleteSet
            if (this.onlyCompleteJob || (this.onlyCompleteJob && this.onlyCompleteSet)) {
                this.onlyCompleteSet = null
            }

            this._settings = {
                onlyCompleteSet: this.onlyCompleteSet,
                onlyCompleteJob: this.onlyCompleteJob,
                resSelf: this.resSelf,
                asAsync: this.asAsync,
                batch: this.batch,
                strictMode: this.strictMode,
                invalidType: this.invalidType
            }
        }

        /**
         * @settings getter
         * retrieve all initial PRM settings
         * - read only
         */
        get settings() {
            return this._settings
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

        set jobUID_temp(v) {
            this._jobUID_temp = [].concat(v, this._jobUID_temp)
            this._jobUID_temp = uniq(this._jobUID_temp).filter(z => !!z)
        }

        /**
         * @jobUID_temp
         * set quickly without proto iteration
         */
        get jobUID_temp() {
            return this._jobUID_temp
        }

        /**
         * @initialUIDS
         * returns initial then actual uids as they become available in PRM scope
         */
        initialUIDS() {
            const UIDS = cloneDeep(this.getUIDS())
            this.jobUID_temp = UIDS
            if ((UIDS || []).length === this.jobUID_temp.length) {
                return UIDS
            } else return this.jobUID_temp
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
            this.jobUID_temp = uid
            if (this.dataArchSealed[uid]) {
                if (this.debug) notify.ulog('[set] data already sealed cannot update', true)
                return this
            }
            if (this.strictJob(uid) === true) {
                return this
            }

            this.d = this.setRequestPayload(data, uid)
                .get(uid) // return item dataSet[...]

            // this.d = this.loopAssingMod(this.d)

            this.grab_ref[uid] = this.d
            return this
        }

        /**
         * @updateSet
         * - update dataSet target by `_ri`
         * `_ri` must be a number, starts from 0
         * `newDataSet` :  data you want to include in your updated dataSet example: {name, age}, or, can be any value
         * `type` : merge > you want to merge old with new , new> you want to replace the orl
         */
        updateSet(uid, _ri, newDataSet = null, type = 'new') {
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
                if (this.debug) notify.ulog('[updateSet] _ri must be a number', true)
                return this
            }

            if (!isNum(_ri)) {
                if (this.debug) notify.ulog('[updateSet] _ri must be a number', true)
            }

            if (newDataSet === null) {
                return this
            }

            if (!this.dataArch[uid]) {
                if (this.debug) notify.ulog('[updateSet] uid doesnt exist', true)
                return this
            }
            if (this.dataArchSealed[uid]) {
                if (this.debug) notify.ulog('[updateSet] data already sealed cannot update', true)
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
                if (this.debug) notify.ulog('[updateSet] nothing updated, ri match not found', true)
            }

            return this
        }

        /**
         * @updateJob
         * update itemDataSet only, if previously set by `set` !
         * does not grow item, only preplace with new data
         * `newData` must provide raw data returned from `set` or use `get(uid)` and return it here
         */
        updateJob(newData, uid) {
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
            if (!isEmpty(this._jobUID_temp)) {
                this._jobUID_temp = this._jobUID_temp.filter(z => z.indexOf(uid) === -1)
            }

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
            delete this.resCalledIndex[uid]
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
            // compare and double check index correctness, when `dataArch` is being updated
            if (this.lastUID && !this.asAsync) {
                const ris = this.resIndex[this.lastUID]

                const jobRI = v[this.lastUID].map(z => z._ri)
                const noDiff = differenceBy(ris, jobRI, Math.floor).length === 0
                if (!noDiff) {
                    // if have difference our `_ri` if wrong
                    notify.ulog(`[dataArch] _ri index is not correct, difference between resIndex and dataArch[uid]._ri`, true)
                    throw ('error')
                }
            }

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
                            this.dataArch = Object.assign({}, this.dataArch)
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
         * @getFirst
         * return first item from the job array
         *
         */
        getFirst(uid) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            if (!this.dataArchSealed[uid]) {
                this.testItemExistence(uid)
            }
            if (!this.dataArch[uid]) {
                if (this.debug) notify.ulog({ message: '[getFirst] not data available for this job id' }, true)
                return null
            }
            const d = cloneDeep(this.dataArch[uid])
            const fData = head(d)
            if (isEmpty(fData)) {
                if (this.debug) notify.ulog({ message: '[getFirst] first data is not available' }, true)
            }
            return fData
        }

        /**
         * @get
         * `uid` must provide uid
         * `_self`  optional, if set specify `get.d` to return items data
         */
        get(uid, _self) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid

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
                notify.ulog({ message: '[get] warning you cannot retrieve this items data, as it is not available', uid }, true)
            }
            return null
        }

        /**
         * @nextRI
         * - get last available `_ri` or return null
         *  NOTE _ri incremented value is only job dependant
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

    /**************************************************************
     * Extending Payload Resolution Manager (PRM) class
     */
    const PRMresolution = require('./prm.resolution')(notify, PayloadResolutioManager)
    const PRMcompute = require('./prm.compute')(notify, PRMresolution)
    const PRMHelpers = require('./prm.helpers')(notify, PRMcompute)
    const PRMbatchReady = require('./prm.batchReady')(notify, PRMHelpers)
    const PRMasync = require('./prm.async.extention')(PRMbatchReady, notify)
    const PRMsandbox = require('./prm.sandbox')(PRMasync, notify)

    class PRMextended extends PRMsandbox {
        constructor(debug, settings) {
            super(debug, settings)
        }
    }

    return PRMextended
}
