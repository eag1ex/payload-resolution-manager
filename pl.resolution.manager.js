/**
 * @PayloadResolutioManager
- You are issuing many async calls and want to be able to track all the requests by uniq id.
- Individual sets of data[index] that maybe worked on independently (out-of-order) will be tracked with resolution index (`_ri`).
 * `Example` You issued 20 requests, each request 5 data sets [x5]. Because all 20 requests are issued at the same time, each set will be out-of-order, we can track each request's `payload/array` with resolution index, and correctly collect data in the end.
 */

module.exports = (notify) => {
    const { isEmpty, isString, uniq, cloneDeep, reduce, isObject, isArray, isNumber, head, flatMap } = require('lodash')

    class PayloadResolutioManager {
        constructor(debug) {
            // resolution index
            this._resIndex = {
                // [uid]:[]< payload size each number is data set, must be uniq

            }
            this.debug = debug
            this._dataArch = {
                // NOTE
                // [uid]:[...] payload data set each `data` is appended `_ri` < `Resolution Index`
                /**
                 * example: [uid]:[{dataSet, _uid, _ri},...]
                 */
            }
            this._lastUID = null // last updated uid
            this._lastItemData = null // last updated at `finalize` methode
            this.d = null // updated via `setupData` methode
            // once all data for each payload resolution is set to be worked on, we mark it as true
            // grab last data returned by `setupData`
            this.grab_ref = {
                // uid > this.d
            }
            this.dataArchSealed = {}
        }

        /**
         * @valUID
         * - validate uid make sure is good
         */
        valUID(uid) {
            if (!uid) throw ('must provide uid!')
            if (!isString(uid)) throw ('uid must be a string')
            if (uid.length < 2) throw ('uid must be longer then 1')
            if (uid.split(' ').length > 1) throw ('uid cannot have any empty space!')
            if (uid.indexOf(',') !== -1) throw ('uid cannot have commas!')
            return true
        }

        /**
         * @setupData
         * `uid` must specify uid which will identify this dataSet
         * `data` must provide an array
         * - with wrap your payload as array in resolution format
         */
        setupData(data, uid) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)
            this.d = this.setRequestPayload(data, uid)
                .getItem(uid) // return item dataSet[...]

            this.grab_ref[uid] = this.d
            return this
        }

        /**
         * @computation
         * - do custom computation and return the value, will update this item on finalize
         * `callback` cann access item data to munipulate, must return same array size
         * `uid` if uid is not provided will try to use last available
         */
        computation(cb, uid) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid
            this.valUID(uid)

            if (typeof cb === 'function') {
                if (this.grab_ref[uid]) {
                    /// did some calculations and returned update
                    var itemUpdated = cb(this.grab_ref[uid])
                    delete this.grab_ref[uid]

                    if (isArray(itemUpdated)) {
                        if (itemUpdated.length !== this.resIndex[uid].length) {
                            notify.ulog('[grabData], nothing updated, callback item does not match initial data size')
                            return this
                        }
                        // double check if required values were supplied
                        itemUpdated = itemUpdated.map((z, i) => {
                            var itm = {}

                            if (isObject(z) && !isArray(z)) {
                                itm['_ri'] = z._ri !== undefined ? z._ri : i
                                itm['_uid'] = z._uid || uid
                                itm['dataSet'] = z.dataSet || null
                            } else {
                                itm['_ri'] = i
                                itm['_uid'] = uid
                                itm['dataSet'] = z || null
                            }
                            return itm
                        }).filter(n => !!n)

                        this.dataArch[uid] = flatMap(itemUpdated) // in case you passed [[]] :)
                        this.dataArch = Object.assign({}, this.dataArch)
                    }
                }
            }
            return this
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
         * @deleteSet
         * - delete set by `uid`
         */
        deleteSet(uid) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)

            var copyArch = cloneDeep(this.dataArch)
            var copyIndex = cloneDeep(this.resIndex)

            delete this.dataArchSealed[uid]
            delete this.dataArch[uid]
            delete this.resIndex[uid]

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
         */
        itemData(data, uid, dataRef) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)
            if (!this.availRef(uid)) return null

            if (isArray(data)) {
                var validSize = data.length === this.resIndex[uid].length
                if (!validSize) {
                    if (this.debug) notify.ulog(`[itemData] provided data size does nto match the size of original payload!`, true)
                    return null
                }
                return reduce(cloneDeep(data), (n, el, i) => {
                    var df = dataRef || 'dataSet'
                    if (uid === el._uid) {
                        n.push(el[df])
                    }
                    return n
                }, [])
            } else {
                if (this.debug) notify.ulog(`provided data must be an array`, true)
                return null
            }
        }

        /**
         * @itemFormated
         * - return formated data with `_uid` and `_ri`
         * - `uid` must already be available to format this item
         * - data will not be combined with `dataArch` chain
         */
        itemFormated(data, uid, dataRef) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)
            if (!this.availRef(uid)) return null
            if (!isArray(data)) throw (`you must provide an array for data!`)

            var validSize = data.length === this.resIndex[uid].length

            if (!validSize) {
                if (this.debug) notify.ulog(`[itemFormated] provided data size does nto match the size of original payload!`, true)
                return null
            }

            var setReady = []
            var d = cloneDeep(data)
            for (var i = 0; i < d.length; i++) {
                var dataSet = d[i]
                var o = {}
                var df = dataRef || 'dataSet'
                o[df] = dataSet
                o['_ri'] = i
                o['_uid'] = uid
                setReady.push(o)
            }
            return setReady
        }

        /**
         * @finalize
         * - `finalize` will provide only `this.dataArch` from this class, unless you provide `yourData`
         * that originaly came thru this class
         * - sorl all `dataArch|yourData` to return coresponding dataSet by `uid`
         * - sets agains `resIndex` to make sure size of each payload matches the return for each dataset
         * - delete `dataArch|yourData`[index] and `resIndex`[index]
         * `dataRef`: example : yourData[uid][dataRef]
         * `doDelete:boolean` provide if you want to delete this arch data and resIndex
         * - return item
         */
        finalize(yourData, uid, dataRef, doDelete = true) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)

            // find all payloads that belong to same uid
            // `yourData` may no longer have `[dataSet]` per object item, you may provide `dataRef` instead
            // will validate all payload items against `resIndex`

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

            // cycle thru each reference
            for (var k in providerData) {
                if (!providerData.hasOwnProperty(k)) continue

                var dataSet = providerData[k]
                if (dataSet.hasOwnProperty(dataRef)) dataSet = dataSet[dataRef]

                if (!dataSet) {
                    if (this.debug) notify.ulog(`dataSet not available`, true)
                    continue
                }
                if (!isArray(dataSet)) throw ('provided dataSet must be an array!')
                fData = [].concat(perDataSet(dataSet, uid), fData)
            }

            if (!this.resIndex[uid]) {
                if (this.debug) notify.ulog({ message: '[finalize] uid provided did not match resIndex' }, true)
                this._lastItemData = null
                this._lastUID = null
                this.d = null
                return null
            }
            if (!fData.length) {
                if (doDelete) this.deleteSet(uid)
                if (this.debug) notify.ulog({ message: '[finalize] fData[] no results' }, true)
                this._lastItemData = []
                this._lastUID = null
                this.d = null
                return []
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

            var output = []
            var verify_index = Object.keys(verify).filter(z => verify[z] === true)

            if (verify_index.length === Object.keys(verify).length) {
                // update lastItem in our format
                this._lastItemData = fData

                for (var n = 0; n < fData.length; n++) {
                    var item = fData[n]
                    // check if item is an object of arrays
                    if (isObject(item) && !isArray(item)) {
                        // get anonymous keyName `most likely dataSet`
                        var anonymousKey = Object.keys(item)
                        anonymousKey = head(anonymousKey.filter(z => {
                            var not_uid = z !== '_uid'
                            var not_ri = z !== '_ri'
                            return not_uid && not_ri
                        }))

                        var itm = fData[n][anonymousKey]
                        if (itm) {
                            output.push(itm)
                            continue
                        }
                    }
                }

                if (doDelete) this.deleteSet(uid)
                // all good
                this._lastUID = null
                this.d = null
                return output
            } else {
                var failed_index = Object.keys(verify).filter(z => verify[z] === false)
                notify.ulog({ message: '[finalize] falied to match resIndex', failed_index, uid })
                if (doDelete) this.deleteSet(uid)
                this._lastItemData = null
                this._lastUID = null
                this.d = null
                return null
            }
        }

        /**
         * @markData
         * - mark `dataArch`[index] as ready for work
         * - you should set it just before return, or after async call!
         */
        markData(uid) {
            this.valUID(uid)
            if (!this.dataArch[uid]) {
                if (this.debug) notify.ulog(`[markData] cannot mark this uid since data does not exist`, true)
                return this
            }
            this.dataArchSealed[uid] = true
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
                    })
                }

                return n
            }, {})
            if (err_format !== null) throw (`dataArch format invalid for: ${err_format}`)

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

            if (not_uniq !== null) throw (`resIndex is not uniq for ${not_uniq}`)

            this._resIndex = v

            if (!isEmpty(v)) {
                if (this.debug) notify.ulog({ message: 'resolution index set', resIndex: this._resIndex })
            }
        }

        /**
         * @getItem
         * `uid` must provide uid
         * `_self`  optional, if set specify `getItem.d` to return items data
         */
        getItem(uid, _self) {
            this.valUID(uid)
            if (_self) {
                var d = cloneDeep(this.dataArch[uid])
                if (d) this.d = d
                return this
            }

            this.d = null
            if (this.dataArchSealed[uid] === false && !_self) {
                return cloneDeep(this.dataArch[uid])
            } else {
                notify.ulog({ message: 'warning you cannot retrieve this items data, as it is not available', uid }, true)
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
            var emptySet = [{ dataSet: [], _ri: nextRI, _uid }]

            if (this.dataArch[_uid]) {
                this.dataArch[_uid] = [].concat(this.dataArch[_uid], emptySet)
            } else this.dataArch[_uid] = [{ dataSet: [], _ri: nextRI, _uid }]

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

            if (isEmpty(data)) {
                return this.setEmptyArch(_uid)
            }

            var setReady = []
            var last_ri = this.nextRI(_uid)

            for (var i = 0; i < data.length; i++) {
                var dataSet = data[i]
                // make sure `ri` is incremented and not repeated!
                var inx = last_ri === null ? i : last_ri = last_ri + 1

                setReady.push({ dataSet: dataSet, _ri: inx, _uid })
            }

            if (this.dataArch[_uid]) {
                this.dataArch[_uid] = [].concat(this.dataArch[_uid], setReady)
            } else this.dataArch[_uid] = setReady

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

    return PayloadResolutioManager
}
