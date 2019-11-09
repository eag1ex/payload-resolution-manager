/**
 * @PayloadResolutioManager
- You are issuing many async calls and want to be able to track all the requests by uniq id.
- Individual sets of data[index] that maybe worked on independently (out-of-order) will be tracked with resolution index (`_ri`).
 * `Example` You issued 20 requests, each request 5 data sets [x5]. Because all 20 requests are issued at the same time, each set will be out-of-order, we can track each request's `payload/array` with resolution index, and correctly collect data in the end.
 */

module.exports = (notify) => {
    const { isEmpty, isString, uniq, cloneDeep, reduce, isObject, merge, indexOf, isArray, isNumber, head, flatMap, times } = require('lodash')

    class PayloadResolutioManager {
        constructor(debug, opts = {}) {
            // resolution index

            // NOTE
            // if `hard` is set any invalid dataSet will be unset
            // if `soft` is set original dataSet will be kept
            this.invalidType = opts.invalid || 'soft' // `soft` or `hard`

            this._resIndex = {
                // [uid]:[]< payload size each number is data set, must be uniq

            }
            this.debug = debug
            this._dataArch = {
                // NOTE
                // [uid]:[...] payload data set each `data` is appended `_ri` < `Resolution Index`
                /**
                 * example: [uid]:[{dataSet, _uid, _ri, _timestamp},...]
                 */
            }
            this._lastUID = null // last updated uid
            this._lastItemData = null // last updated at `finalize` methode
            this.singleSet = null // return only set that was updated
            this.d = null // updated via `setupData` methode
            // once all data for each payload resolution is set to be worked on, we mark it as true
            // grab last data returned by `setupData`
            this.grab_ref = {
                // uid > this.d
            }
            this.dataArchSealed = {}
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

            if (this.dataArchSealed[uid]) {
                if (this.debug) notify.ulog('[setupData] data already sealed cannot update', true)
                return this
            }

            this.d = this.setRequestPayload(data, uid)
                .getItem(uid) // return item dataSet[...]

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
            if (!uid) uid = this._lastUID
            else this._lastUID = uid
            this.valUID(uid)

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
                        if (type === 'new') this.dataArch[uid][i].dataSet = newDataSet
                        if (type === 'merge') this.dataArch[uid][i].dataSet = merge(dataSets, newDataSet)
                        this.dataArch = Object.assign({}, this.dataArch)
                        updated = true
                    }
                }
            }

            if (!updated) {
                if (this.debug) notify.ulog('[updateDataSet] nothing updated, ri match not found', true)
            }

            return this
        }

        /**
         * @updateSetup
         * update itemDataSet only, if previously set by `setupData` !
         * does not grow item, only preplace with new data
         * `newData` must provide raw data returned from `setupData` or use `getItem(uid)` and return it here
         */
        updateSetup(newData, uid) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid
            this.valUID(uid)

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
                this.dataArch[uid] = newItemDataSet
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

            if (newData.length !== this.dataArch[uid].length) {
                console.log('new d wrong len', newData)
                return null
            }
            for (var i = 0; i < newData.length; i++) {
                var itm = newData[i]
                if (!isObject(itm) && !isArray(itm)) break

                // update `item`
                this.dataArch[uid].map(z => {
                    if (z._uid === itm._uid && z._ri === itm._ri) {
                        dataRef = dataRef || 'dataSet'
                        var el = {}
                        var anonymousKey = Object.keys(z).filter(n => {
                            return n !== '_ri' && n !== '_uid' && n !== '_timestamp'
                        })

                        if (anonymousKey.length === 1) {
                            el[dataRef] = itm[head(anonymousKey)] // newData
                            el['_ri'] = z._ri
                            el['_uid'] = z._uid
                            el['_timestamp'] = z._timestamp
                        } else {
                            if (this.debug) notify.ulog(`ups no dataSet, other then _uid/_ri are available for update!, nothing done`, true)
                            return null
                        }

                        if (!isEmpty(el)) {
                            // check if match our resIndex, should exist
                            if (indexOf(this.resIndex[uid], el._ri) !== -1) {
                                matched_ris.push(el._ri)
                            }
                            item.push(el)
                        }
                    }
                })
            }

            var pass_ok = this.resIndex[uid].filter(z => {
                return matched_ris.filter(n => z === n).length
            }).filter(z => z !== undefined).length === this.resIndex[uid].length

            if (pass_ok) {
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
         * for use with computation for `each` callback when uid===false or not provided
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
                if (this._itemDataSet.length !== v.length) {
                    if (this._dataArch.debug) notify.ulog({ message: 'some items in dataSet provided were not valid, not all were updated', validSize: this._itemDataSet.length })
                }
            } else {
                if (this.debug) notify.ulog('no valid data to update using itemDataSet, possibly your uids and/or ris do not match items in our scope', true)
            }
        }

        /**
         * @computation
         * - do custom computation and update each data in realtime uppon finalize and return
         * `callback` can access item data to munipulate, must return same array size
         * `uid` if set null will try to use last available, if uid is still undefind >computation will initially extract all available `UIDs` from provided data and update independently, if more then 1 found, will also check that those match with provided in `setupData`
         * `method` there are 2 types: `each` and `all` as name suggests callback will be performend on every item[x] or only once for all
         * `itemDataSet:` when we want to use `each` callback when `uid` is anonymous/unset, we need to update dataSet first, to be able to loop thru it later.
         */
        computation(cb, method = 'all', uid) {
            if (!uid && uid !== false) uid = this._lastUID
            else if (uid !== false) this._lastUID = uid
            if (uid !== false) this.valUID(uid)
            if (!uid) uid = false // make sure its false when all else fails when we will use `itemDataSet` if declared

            if (this.dataArchSealed[uid] && uid !== false) {
                if (this.debug) notify.ulog(`you cannot perform any calculation after data was marked, nothung changed!`, true)
                return this
            }
            var no_uid_no_item = { message: 'uid not provided so cannot loop thru original set' }
            this.itemDataSet = null

            // catch all callback error handling thru here
            var cb_sandbox = (updatedData, skipIndex = null) => {
                var updated = null
                try {
                    updated = cb(updatedData)
                } catch (err) {
                    if (this.debug && skipIndex !== null) notify.ulog({ errro: err, message: no_uid_no_item.message }, true)
                }
                return updated
            }

            if (typeof cb === 'function') {
                // NOTE if UID was set to false, it means we dont know exectly what value is provided, but we know that each dataSet has its own tag reference of `_uid` and `_ri`
                if (this.grab_ref[uid] || uid === false) {
                    var itemUpdated = (items, inx = null) => {
                        // double check if required values were supplied
                        if (typeof items === 'function') {
                            if (this.debug) notify.ulog('returnin a pormise is not yet supported, nothing updated', true)
                            return null
                        }
                        if (!items) {
                            if (this.debug) notify.ulog({ message: no_uid_no_item.message }, true)
                            return null
                        }

                        if (!isArray(items)) {
                            if (items.message) {
                                if (this.debug) notify.ulog({ message: items.message }, true)
                                return null
                            }
                        }

                        var n = (items || []).map((z, i) => {
                            if (typeof z === 'function') {
                                if (this.debug) notify.ulog(`returnin a pormise is not yet supported, nothing updated for index ${i}`, true)
                                return null
                            }

                            var itm = {}
                            if (inx !== null) i = inx // when for `each` index need to come from external loop
                            if (isObject(z) && !isArray(z)) {
                                itm['_ri'] = z._ri !== undefined ? z._ri : i
                                itm['_uid'] = z._uid || uid
                                itm['_timestamp'] = this.timestamp() // set new time
                                if (!z.dataSet) {
                                    if (this.debug) notify.ulog(`[computation] .dataSet must be set for all user values or it will return null`)
                                }
                                itm['dataSet'] = z.dataSet || null
                                if (Object.keys(z).length > 4) {
                                    var ignored = Object.keys(z).filter(n => {
                                        return n !== '_ri' && n !== '_uid' && n !== 'dataSet' && n !== '_timestamp'
                                    })
                                    if (this.debug) notify.ulog({ message: 'new values can only be set on dataSet', ignored }, true)
                                    times(ignored.length, (i) => {
                                        var del = ignored[i]
                                        delete z[del]
                                        delete itm[del]
                                    })
                                }
                            } else {
                                itm['_ri'] = i
                                if (uid) itm['_uid'] = uid
                                itm['_timestamp'] = this.timestamp()
                                itm['dataSet'] = z || null
                            }

                            /// validate `_ri` and `uid`
                            var ri = itm['_ri']
                            var _uid = uid === false ? itm['_uid'] : uid

                            var valid_dataItem = _uid ? this.dataArch[_uid][ri] : false

                            if (!valid_dataItem && uid === false) {
                                if (this.debug) notify.ulog({ message: `[computation] we could not find any available uid for this index ${i}, changes omited` }, true)
                                if (this.invalidType === 'hard') {
                                    z.dataSet = null
                                }
                                return z
                            }
                            if (!valid_dataItem) {
                                if (this.debug) notify.ulog({ message: `[computation] looks like _ri=${ri} for ${_uid} does not exist, changes omited` }, true)

                                // itm['dataSet'] = Object.assign({}, { error: 'wrong data provided for this set, does not match with length or _uid or _ri' }, { dataCopy: itm['dataSet'] })
                                if (this.invalidType === 'hard') {
                                    z.dataSet = null
                                }
                                return z
                            }
                            if (valid_dataItem._ri === itm['_ri'] && itm['_uid'] === valid_dataItem._uid) {
                                return itm
                            } else {
                                if (this.debug) notify.ulog({ message: `[computation] matching error, changes omited`, uid }, true)

                                if (this.invalidType === 'hard') {
                                    z.dataSet = null
                                }
                                // itm['dataSet'] = Object.assign({}, { error: 'wrong data provided for this set, does not match with length or _uid or _ri' }, { dataCopy: itm['dataSet'] })
                                return z
                            }
                        }).filter(n => !!n)
                        return n
                    }

                    var updateData
                    if (method === 'all') {
                        // NOTE call back should return new data as an array
                        var updatedData = this.grab_ref[uid] || no_uid_no_item
                        var updated = cb_sandbox(updatedData)

                        if (isArray(updateData)) {
                            if (updateData.length !== this.resIndex[uid].length) {
                                if (this.debug) notify.ulog('[computation], nothing updated, callback item does not match initial data size')
                                return this
                            }
                        }

                        updateData = itemUpdated(updated)

                        // NOTE when computing make sure provided data matches our `_ri` and `_uid`                   /// validate `_ri && _uid`
                        var valid = this._validDataItem(updateData, uid)
                        if (!valid) {
                            if (this.debug) notify.ulog({ message: 'computation all option did not match all dataSets correctly, either uid length or ri are wrong' }, true)
                        }
                    } // for all

                    var loopEach = (skipINX) => {
                        var initialData = (this.grab_ref[uid] || this.itemDataSet) || []

                        return initialData.map((z, i) => {
                            // means we are skipping callback for this index
                            if (skipINX === i) return null
                            // do for each callback
                            var u = cb_sandbox(z, skipINX)
                            if (u) u = flatMap([u])

                            if (u.length > 1 || !isArray(u)) {
                                notify.ulog(`[computation], each option you must return only 1 item per callback, nothing updated`, true)
                                return null
                            }
                            var dd = itemUpdated(u, i)
                            return head(dd)
                        }).filter(z => !!z)
                    }

                    if (method === 'each' && uid !== false) {
                        updateData = loopEach()
                    } else if (method === 'each' && uid === false) {
                        // NOTE
                        /*
                         when uid is not provided the only way to loop callback with `each` is to
                         findout what the total array is by initially updating with `itemDataSet`
                         will also throw silent error if try to update item index 0 in callback when  itemDataSet was not yet set
                        */
                        var u = cb_sandbox(no_uid_no_item) // required to get our itemDataSet
                        if (u) u = flatMap([u])

                        // after first callback var should be updated
                        if (this.itemDataSet) {
                            var u2

                            if (u) u2 = loopEach(0)// skipping first
                            else u2 = loopEach() // call again, posibly because we try update local dataSet that is non existant

                            updateData = [].concat(u, u2).filter(z => !!z) // add up 0 index from initial callback
                        } else {
                            notify.ulog(`uid was undefind for use of 'each' you must set itemDataSet=data[..] to update each callback to work`, true)
                            return this
                        }
                    }

                    if (uid) delete this.grab_ref[uid]
                    if (isArray(updateData)) updateData = flatMap(updateData) // in case you passed [[]] :)

                    if ((updateData || []).length) {
                        /// update only those which match ri to previously declared sets!
                        for (var i = 0; i < updateData.length; i++) {
                            var updItem = updateData[i]
                            var _uid = uid === false ? updItem._uid : uid
                            var ri = updItem._ri
                            if (this.dataArch[_uid][ri]) {
                                if (this.dataArch[_uid][ri]._uid === _uid) {
                                    this.dataArch[_uid][ri] = updItem
                                }
                            }
                        }
                        this.dataArch = Object.assign({}, this.dataArch)
                    }
                }
            } else {
                if (this.debug) notify.ulog(`pointless without callback, nothing changed`)
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
         * @reset
         * only call reset with `force=true`
         */
        reset(uid, force = true) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid
            if (!force) return
            this._lastItemData = null
            delete this.dataArchSealed[uid]
            delete this.grab_ref[uid]
            this._lastUID = null
            this.itemDataSet = null
            this.d = null
            return this
        }

        /**
         * @deleteSet
         * - delete set by `uid`
         */
        deleteSet(uid, force = false) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)

            var copyArch = cloneDeep(this.dataArch)
            var copyIndex = cloneDeep(this.resIndex)

            delete this.dataArchSealed[uid]
            delete this.dataArch[uid]
            delete this.resIndex[uid]

            // deleteSet is performed from finalize when option `doDelete is set`, followed by rest

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
         */
        itemData(data, uid, dataRef, external = null) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)
            if (!this.availRef(uid) && !external) return null

            if (isArray(data)) {
                var validSize = data.length === this.resIndex[uid].length
                if (!validSize && !external) {
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
         * `external` when provided class will not check for size validation, but format must match
         */
        itemFormated(data, uid, dataRef, external = null) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)
            if (!this.availRef(uid) && !external) return null
            if (!isArray(data)) throw (`you must provide an array for data!`)

            var validSize = data.length === this.resIndex[uid].length

            if (!validSize && !external) {
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
                o['_timestamp'] = this.timestamp()
                setReady.push(o)
            }
            return setReady
        }

        /**
         * @_finalize_item
         * mothod called by finalize, to allow grouping calls
         */
        _finalize_item(yourData, uid, dataRef, doDelete = true) {
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
            // setupData
            // cycle thru each reference
            for (var k in providerData) {
                if (!providerData.hasOwnProperty(k)) continue

                var itemDataSets = providerData[k]
                if (itemDataSets.hasOwnProperty(dataRef)) itemDataSets = itemDataSets[dataRef]

                if (!itemDataSets) {
                    if (this.debug) notify.ulog(`itemDataSets not available`, true)
                    continue
                }
                if (!isArray(itemDataSets)) throw ('provided itemDataSets must be an array!')

                fData = [].concat(perDataSet(itemDataSets, uid), fData)
            }

            if (!this.resIndex[uid]) {
                if (this.debug) notify.ulog({ message: '[finalize] uid provided did not match resIndex' }, true)
                this.reset(uid)
                return null
            }
            if (!fData.length) {
                if (doDelete) this.deleteSet(uid)
                if (this.debug) notify.ulog({ message: '[finalize] fData[] no results' }, true)
                this.reset(uid)
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
                            var not_timestemp = z !== '_timestamp'
                            return not_uid && not_ri && not_timestemp
                        }))

                        var itm = fData[n][anonymousKey]
                        if (itm !== undefined) {
                            output.push(itm)
                            continue
                        }
                    }
                }

                if (doDelete) this.deleteSet(uid)
                // all good
                this.reset(uid)
                return output
            } else {
                var failed_index = Object.keys(verify).filter(z => verify[z] === false)
                notify.ulog({ message: '[finalize] falied to match resIndex', failed_index, uid })
                if (doDelete) this.deleteSet(uid)
                this.reset(uid)
                return null
            }
        }

        /**
         * @finalize
         * - `finalize` will provide only `this.dataArch` from this class, unless you provide `externalData`
         * that originaly came thru this class
         * - sorl all `dataArch|externalData` to return coresponding dataSet by `uid`
         * - sets agains `resIndex` to make sure size of each payload matches the return for each dataset
         * - delete `dataArch|externalData` [index] and `resIndex`[index]
         * `dataRef`: example : externalData[uid][dataRef]
         * `doDelete:boolean` provide if you want to delete this arch data and resIndex
         * `uid:String` : provide uid
         * `uid:Array` : can provide array(..) of uids, `externalData` option not available for multi returns,
         * - return item
         */
        finalize(externalData, uid, dataRef, doDelete = true) {
            if (!externalData && isArray(uid)) {
                var items = {}
                for (var i = 0; i < uid.length; i++) {
                    var d = this._finalize_item(externalData, uid[i], dataRef, doDelete)
                    items[uid] = d
                }
                return d
            } else {
                if (!uid) uid = this._lastUID
                else this._lastUID = uid
                this.valUID(uid)
                return this._finalize_item(externalData, uid, dataRef, doDelete)
            }
        }

        /**
         * @markDone
         * - mark `dataArch`[index] as ready for work
         * - you should set it just before return, or after async call!
         */
        markDone(uid) {
            if (!uid) uid = this._lastUID
            else this._lastUID = uid

            this.valUID(uid)
            if (!this.dataArch[uid]) {
                if (this.debug) notify.ulog(`[markDone] cannot mark this uid since data does not exist`, true)
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
                        if (!isNumber((z || {})._timestamp)) {
                            console.log('err not number')
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
                        // delete double match from other data and keep only in relevence to uid test
                        this.dataArch[k] = other.filter(z => {
                            return z._uid !== uid
                        })
                        arr = [].concat(arr, found)
                    }
                }

                // update model
                if (arr.length) this.dataArch = Object.assign({}, this.dataArch)
                return arr
            }

            var exists = testExistence()
            // original size
            var orgSize = this.dataArch[uid].length
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
                        this.dataArch[uid] = [].concat(this.dataArch[uid], item)
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
         * @getItem
         * `uid` must provide uid
         * `_self`  optional, if set specify `getItem.d` to return items data
         */
        getItem(uid, _self) {
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
                notify.ulog({ message: '[getItem] warning you cannot retrieve this items data, as it is not available', uid }, true)
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
            } else this.dataArch[_uid] = setReady

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

    return PayloadResolutioManager
}
