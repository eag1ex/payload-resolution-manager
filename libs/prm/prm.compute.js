
/**
 * @PrmCompute
 * exported `compute` method to allow clarity and implementation of async returns
 */
module.exports = (notify, PRM) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isFunction, isObject, isArray, head, flatMap, times } = require('lodash')
    class PrmCompute extends PRM {
        constructor(debug, opts) {
            super(debug, opts)

            this.no_uid_no_item = { message: 'uid not provided so cannot loop thru original set' }
            this._nextComputeData = null
        }

        /**
         * @compute
         * - do custom compute and update each data in realtime uppon resolution and return
         * `callback` can access item data to munipulate, must return same array size
         * `uid` if set null will try to use last available, if uid is still undefind >compute will initially extract all available `UIDs` from provided data and update independently, if more then 1 found, will also check that those match with provided in `set`
         * `method` there are 2 types: `each` and `all` as name suggests callback will be performend on every item[x] or only once for all
         * `itemDataSet:` when we want to use `each` callback when `uid` is anonymous/unset, we need to update dataSet first, to be able to loop thru it later.
         */
        compute(cb, method = 'all', uid) {
            if (!uid && uid !== false) uid = this._lastUID
            else if (uid !== false) this._lastUID = uid

            if (uid !== false) this.valUID(uid)
            if (!uid) uid = false // make sure its false when all else fails when we will use `itemDataSet` if declared

            if (this.strictJob(uid) === true) {
                return this
            }

            this._nextComputeData = this.dataArchWhich() // this.grab_ref[uid]

            // perform additional validation
            var valid = this._validCompute(uid, this._nextComputeData, cb)
            if (!valid) return this

            var updateData
            // grab original references

            var no_uid_no_item = { message: 'uid not provided so cannot loop thru original set' }
            this._itemDataSet = null

            if (method === 'all') {
                // NOTE call back should return new data as an array
                var updatedData = this._nextComputeData || no_uid_no_item
                var updated = this._compute_cb_sandbox(cb, updatedData)

                if (isArray(updateData)) {
                    if (updateData.length !== this.resIndex[uid].length) {
                        if (this.debug) notify.ulog('[compute], nothing updated, callback item does not match initial data size')
                        return this
                    }
                }

                updateData = this._compute_itemUpdated(updated, null, uid)

                // NOTE when computing make sure provided data matches our `_ri` and `_uid`                   /// validate `_ri && _uid`
                var valid = this._validDataItem(updateData, uid)
                if (!valid && (valid || []).length !== this._nextComputeData.length) {
                    if (this.debug) notify.ulog({ message: 'compute all option did not match all dataSets correctly, either uid length or ri are wrong' }, true)
                }
            } // for all

            if (method === 'each' && uid !== false) {
                updateData = this._computeEachLoop(cb, null, uid)
            } else if (method === 'each' && uid === false) {
                // NOTE
                /*
                         when uid is not provided the only way to loop callback with `each` is to
                         findout what the total array is by initially updating with `itemDataSet`
                         will also throw silent error if try to update item index 0 in callback when  itemDataSet was not yet set
                        */
                var u = this._compute_cb_sandbox(cb) // required to get our itemDataSet
                if (u) u = flatMap([u])

                // after first callback var should be updated
                if (this.itemDataSet) {
                    var u2

                    if (u) u2 = this._computeEachLoop(cb, 0, uid) // skipping first
                    else u2 = this._computeEachLoop(cb, null, uid) // call again, posibly because we try update local dataSet that is non existant

                    updateData = [].concat(u, u2).filter(z => !!z) // add up 0 index from initial callback
                } else {
                    notify.ulog(`uid was undefind for use of 'each' you must set itemDataSet=data[..] to update each callback to work`, true)
                    return this
                }
            }

            /**
             * justify results from either `all` or `each`
             * ########################################
             * ################################
             */
            // if (uid) delete this.grab_ref[uid]
            if (isArray(updateData)) updateData = flatMap(updateData) // in case you passed [[]] :)

            if ((updateData || []).length) {
                /// update only those which match ri to previously declared sets!
                for (var i = 0; i < updateData.length; i++) {
                    var updItem = updateData[i]
                    if (isEmpty(updItem)) {
                        if (this.debug) notify.ulog(`[compute] warning item to update is empty, skipping`)
                        continue
                    }

                    var _uid = uid === false ? updItem._uid : uid
                    if (!this.dataArch[_uid]) continue

                    var itmPosIndex = updItem._ri
                    if (this.dataArch[_uid][itmPosIndex]) {
                        if (this.dataArch[_uid][itmPosIndex]._uid === _uid) {
                            try {
                                this.dataArch[_uid][itmPosIndex] = updItem
                            } catch (err) {
                                if (this.debug) notify.ulog(err, true)
                            }
                        }
                    }
                }
                this.dataArch = Object.assign({}, this.dataArch)
            }

            return this
        }

        /// ///////////////////////
        /// //////////////////////////
        // catch all callback error handling thru here
        _compute_cb_sandbox(cb, updatedData, skipIndex = null) {
            var updated = null
            try {
                updated = cb(updatedData)
            } catch (err) {
                if (this.debug && skipIndex !== null) notify.ulog({ errro: err, message: this.no_uid_no_item.message }, true)
            }
            return updated
        }

        _validCompute(uid, nextComputeData, cb) {
            if (isEmpty(nextComputeData)) {
                return false
            }

            if (this.dataArchSealed[uid] && uid !== false) {
                if (this.debug) notify.ulog(`you cannot perform any calculation after data was marked, nothing changed!`, true)
                return false
            }

            if (!isFunction(cb)) {
                if (this.debug) notify.ulog(`[compute] pointless without callback, nothing changed`, true)
                return false
            }

            // NOTE if UID was set to false, it means we dont know exectly what value is provided, but we know that each dataSet has its own tag reference of `_uid` and `_ri`
            var refCondition = this.grab_ref[uid] || uid === false
            if (!refCondition) {
                if (this.debug) notify.ulog(`[compute] no refCondition met, nothing done`, true)
                return false
            }

            return true
        }

        _computeEachLoop(cb, skipINX, uid) {
            var originalFormat = this._nextComputeData
            var initialData = (/* this.grab_ref[uid] */ originalFormat || this.itemDataSet) || []

            if (!isEmpty(this.itemDataSet) && isArray(this.itemDataSet)) {
                if (this.itemDataSet.length !== originalFormat.length) {
                    if (this.debug) {
                        notify.ulog({
                            message: `[compute] itemDataSet should match job:uid ${uid} size, nothing changed`
                        }, true)
                    }
                    return []
                }
            }
            if ((initialData || []).length) initialData = this.loopAssingMod(initialData)

            var loopd = []
            const self = this
            var loop = (i) => {
                if (initialData[i]) {
                    var orgItem = initialData[i]
                    // means we are skipping callback for this index
                    if (skipINX === i) return null

                    var perLoop = (_u) => {
                        // in case you retur array instead of single item
                        if (isArray(_u)) _u = head(_u)
                        // auto complete set on every compute iteration
                        if (self.autoComplete) {
                            _u.complete = true
                        }
                        if (_u) _u = flatMap([_u])

                        if (_u.length > 1 || !isArray(_u)) {
                            notify.ulog(`[compute], each option you must return only 1 item per callback, nothing updated`, true)

                            // return null
                            loopd.push(null)
                            i = i + 1
                            loop(i)
                            return
                        }
                        var dd

                        try {
                            var ri_inx = originalFormat[i]['_ri']
                            dd = self._compute_itemUpdated(_u, ri_inx, uid)
                        } catch (err) {
                            console.log('-- itemUpdated err', err)
                        }

                        loopd.push(head(dd))

                        i = i + 1
                        loop(i)
                    }

                    // do for each callback
                    var u = self._compute_cb_sandbox(cb, orgItem, skipINX)
                    /**
                         * check if each compute callback is a promise
                         */
                    if (self.isPromise(u) === true) {
                        var uidREF = `${orgItem._uid}--${i}`
                        self.xpromise.p(uidREF)
                        u.then((uu) => {
                            self.xpromise.resolve(uidREF)
                            perLoop(uu)
                        })
                    } else {
                        perLoop(u)
                    }
                }
                // else terminate
            }
            loop(0)

            loopd = loopd.filter(z => z !== undefined)
            return loopd
        }

        _computeSetNewForTypeAll(data, originalFormat) {
            var itm = {}
            itm['_ri'] = originalFormat['_ri']
            itm['_uid'] = originalFormat['_uid']
            itm['_timestamp'] = this.timestamp() // set new time
            itm['dataSet'] = data || null
            if (this.autoComplete) itm['complete'] = true
            return itm
        }

        _compute_itemUpdated(items, inx = null, uid) {
            var originalFormat = this._nextComputeData

            // double check if required values were supplied
            if (typeof items === 'function') {
                if (this.debug) notify.ulog('returnin a pormise is not yet supported, nothing updated', true)
                return null
            }
            if (!items) {
                if (this.debug) notify.ulog({ message: this.no_uid_no_item.message }, true)
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
                    if (!z.dataSet) {
                        itm = this._computeSetNewForTypeAll(z, originalFormat[i])
                        // if no dataSet lets remake last before update
                        //  if (this.debug) notify.ulog(`[compute] .dataSet must be set for all user values or it will return null`)
                    } else {
                        itm['_ri'] = z._ri !== undefined ? z._ri : i
                        itm['_uid'] = z._uid || uid
                        itm['_timestamp'] = this.timestamp() // set new time
                        if (z.complete !== undefined) itm['complete'] = z.complete

                        itm['dataSet'] = z.dataSet || null
                        if (this.autoComplete) itm['complete'] = true
                    }

                    try {
                        if (Object.keys(z).length > 4) {
                            var ignored = Object.keys(z).filter(n => {
                                var except = this.dataArchAttrs.filter(nn => nn !== n).length > Object.keys(z).length
                                //  var vld = n !== '_ri' && n !== '_uid' && n !== 'dataSet' && n !== '_timestamp' && n !== 'complete'
                                return except
                            })
                            if (ignored.length) {
                                if (this.debug) notify.ulog({ message: 'new values can only be set on dataSet', ignored }, true)
                            }
                            times(ignored.length, (i) => {
                                var del = ignored[i]
                                delete z[del]
                                delete itm[del]
                            })
                        }
                    } catch (err) {
                        console.log('-- err in itemUpdated ', err)
                    }
                } else {
                    itm['_ri'] = originalFormat[i]['_ri']
                    if (uid) itm['_uid'] = uid
                    itm['_timestamp'] = this.timestamp()
                    itm['dataSet'] = z || null
                    if (this.autoComplete) itm['complete'] = true
                }

                /// validate `_ri` and `uid`

                var ri = itm['_ri']
                var _uid = uid === false ? itm['_uid'] : uid

                var valid_dataItem = _uid ? this.dataArch[_uid][ri] : false

                if (!valid_dataItem && uid === false) {
                    if (this.debug) notify.ulog({ message: `[compute] we could not find any available uid for this index ${i}, changes omited` }, true)
                    if (this.invalidType === 'hard') {
                        z.dataSet = null
                    }
                    return z
                }
                if (!valid_dataItem) {
                    if (this.debug) notify.ulog({ message: `[compute] looks like _ri=${ri} for ${_uid} does not exist, changes omited` }, true)

                    // itm['dataSet'] = Object.assign({}, { error: 'wrong data provided for this set, does not match with length or _uid or _ri' }, { dataCopy: itm['dataSet'] })
                    if (this.invalidType === 'hard') {
                        z.dataSet = null
                    }
                    return z
                }
                if (valid_dataItem._ri === itm['_ri'] && itm['_uid'] === valid_dataItem._uid) {
                    return itm
                } else {
                    if (this.debug) notify.ulog({ message: `[compute] matching error, changes omited`, uid }, true)

                    if (this.invalidType === 'hard') {
                        z.dataSet = null
                    }
                    // itm['dataSet'] = Object.assign({}, { error: 'wrong data provided for this set, does not match with length or _uid or _ri' }, { dataCopy: itm['dataSet'] })
                    return z
                }
            }).filter(n => n !== undefined)
            return n
        }
    }

    return PrmCompute
}
