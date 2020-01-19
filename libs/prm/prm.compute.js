/**
 * @PrmCompute method extention
 * the compute method is quite large, se we decided to export it for clarity
 */
module.exports = (notify, PRM) => {
    const { isEmpty, isFunction, isObject, isArray, head, flatMap, times } = require('lodash')
    if (!notify) notify = require('../notifications')()
    class PrmCompute extends PRM {
        constructor(debug, opts) {
            super(debug, opts)
        }
        /**
         * @compute
         * - do custom compute and update each data in realtime uppon resolution and return
         * `callback` can access item data to munipulate, must return same array size
         * `uid` if set null will try to use last available, if uid is still undefind >compute will initially extract all available `UIDs` from provided data and update independently, if more then 1 found, will also check that those match with provided in `set`
         * `method` there are 2 types: `each` and `all` as name suggests callback will be performend on every item[x] or only once for all
         * - `autoComplete` if enabled in prm instance, `compute` will set complete=true for each dataSet ren thru it.
         * `itemDataSet:` when we want to use `each` callback when `uid` is anonymous/unset, we need to update dataSet first, to be able to loop thru it later.
         *
         */
        async computeA(cb, method = 'all', uid) {
            if (!uid && uid !== false) uid = this.lastUID
            else if (uid !== false) this.lastUID = uid

            if (uid !== false) this.valUID(uid)

            if (!uid) uid = false // make sure its false when all else fails when we will use `itemDataSet` if declared

            const conditionValidate = this.computeConditionValidate(uid, cb)
            if (!conditionValidate) {
                return this
            }
            const { originalFormat } = conditionValidate

            var updateData
            // grab original references

            var no_uid_no_item = { message: 'uid not provided so cannot loop thru original set' }
            this._itemDataSet = null

            // catch all callback error handling thru here
            var cb_sandbox = async(updatedData, skipIndex = null) => {
                var updated = null
                try {
                    updated = await cb(updatedData) // check for error so we can assing `error` property on rejection!
                } catch (err) {
                    if (this.debug && skipIndex !== null) notify.ulog({ errro: err, message: no_uid_no_item.message }, true)
                    if (!isObject(err)) {
                        if (this.debug) notify.ulog(`promise rejection is not an object, you should return PrmProto object`, true)
                        throw ('error')
                    }

                    var errDataSet = err.dataSet || true
                    err.dataSet = null
                    updated = err
                    updated.__error = errDataSet
                }
                return updated
            }

            var setNewForTypeAll = (data, _originalFormat) => {
                var itm = {}
                itm['_ri'] = _originalFormat['_ri']
                itm['_uid'] = _originalFormat['_uid']
                if ((data || {}).__error) itm['error'] = (data || {}).__error
                itm['_timestamp'] = this.timestamp() // set new time
                itm['dataSet'] = data || null
                if (this.autoComplete) itm['complete'] = true
                return itm
            }

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
                        if (z.dataSet === undefined) {
                            itm = setNewForTypeAll(z, head(originalFormat))
                            // if no dataSet lets remake last before update
                            //  if (this.debug) notify.ulog(`[compute] .dataSet must be set for all user values or it will return null`)
                        } else {
                            itm['_ri'] = z._ri !== undefined ? z._ri : i
                            itm['_uid'] = z._uid || uid
                            itm['_timestamp'] = this.timestamp() // set new time
                            if (z.complete !== undefined) itm['complete'] = z.complete
                            if ((z || {}).__error) itm['error'] = (z || {}).__error
                            itm['dataSet'] = z.dataSet || null
                            if (this.autoComplete) itm['complete'] = true
                        }

                        try {
                            // NOTE increment length of keys to validate when dataArchAttrs are updated overtime
                            if (Object.keys(z).length > 5) {
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
                        if ((z || {}).__error) itm['error'] = (z || {}).__error
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

            var loopEach = async(skipINX) => {
                // NOTE when setting manual itemDataSet input, need to check for it first!
                var initialData = (/* this.grab_ref[uid] */ this.itemDataSet || originalFormat) || []

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
                var loop = async(i) => {
                    if (initialData[i]) {
                        var z = initialData[i]
                        // means we are skipping callback for this index
                        if (skipINX === i) return null

                        var perLoop = async(_u) => {
                            // in case you retur array instead of single item
                            if (isArray(_u)) _u = head(_u)
                            // auto complete set on every compute iteration
                            if (this.autoComplete) {
                                _u.complete = true
                            }
                            if (_u) _u = flatMap([_u])

                            if (_u.length > 1 || !isArray(_u)) {
                                notify.ulog(`[compute], each option you must return only 1 item per callback, nothing updated`, true)

                                // return null
                                loopd.push(null)
                                i = i + 1
                                await loop(i)
                                return
                            }
                            var dd

                            try {
                                dd = itemUpdated(_u, originalFormat[i]['_ri'])
                            } catch (err) {
                                console.log('-- itemUpdated err', err)
                            }

                            loopd.push(head(dd))

                            i = i + 1
                            await loop(i)
                        }

                        // do for each callback
                        var u = await cb_sandbox(z, skipINX)
                        await perLoop(u)
                    } else {
                        loopd = loopd.filter(z => z !== undefined)
                    }
                }
                await loop(0)

                return loopd
            }

            if (method === 'all') {
                // NOTE call back should return new data as an array
                var updatedData = originalFormat || no_uid_no_item
                var updated = await cb_sandbox(updatedData)

                if (isArray(updateData)) {
                    if (updateData.length !== this.resIndex[uid].length) {
                        if (this.debug) notify.ulog('[compute], nothing updated, callback item does not match initial data size')
                        return this
                    }
                }

                updateData = itemUpdated(updated)

                // NOTE when computing make sure provided data matches our `_ri` and `_uid` /// validate `_ri && _uid`
                var valid = this._validDataItem(updateData, uid)
                if (!valid && (valid || []).length !== originalFormat.length) {
                    if (this.debug) notify.ulog({ message: 'compute all option did not match all dataSets correctly, either uid length or ri are wrong' }, true)
                }
            } // for all

            //     if (method === 'each') updateData = eachMethod(uid)
            //    this.xpromise.consume(uidRef, updateData)

            if (method === 'each' && uid !== false) {
                updateData = await loopEach()
            } else if (method === 'each' && uid === false) {
                // NOTE
                /*
                         when uid is not provided the only way to loop callback with `each` is to
                         findout what the total array is by initially updating with `itemDataSet`
                         will also throw silent error if try to update item index 0 in callback when  itemDataSet was not yet set
                        */
                var u = await cb_sandbox() // required to get our itemDataSet
                if (u) u = flatMap([u])

                // after first callback var should be updated
                if (this.itemDataSet) {
                    var u2

                    if (u) u2 = await loopEach(0)// skipping first
                    else u2 = await loopEach() // call again, posibly because we try update local dataSet that is non existant

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
            this.computeFinalize(uid, updateData)

            return this
        }

        /**
         * @computeB
         * copy of computeA, but non async
         */
        computeB(cb, method = 'all', uid) {
            if (!uid && uid !== false) uid = this.lastUID
            else if (uid !== false) this.lastUID = uid

            if (uid !== false) this.valUID(uid)

            if (!uid) uid = false // make sure its false when all else fails when we will use `itemDataSet` if declared

            const conditionValidate = this.computeConditionValidate(uid, cb)
            if (!conditionValidate) {
                return this
            }
            const { originalFormat } = conditionValidate

            var updateData
            // grab original references

            var no_uid_no_item = { message: 'uid not provided so cannot loop thru original set' }
            this._itemDataSet = null

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

            var setNewForTypeAll = (data, originalFormat) => {
                var itm = {}
                itm['_ri'] = originalFormat['_ri']
                itm['_uid'] = originalFormat['_uid']
                itm['_timestamp'] = this.timestamp() // set new time
                itm['dataSet'] = data || null
                if (this.autoComplete) itm['complete'] = true
                return itm
            }

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
                        if (z.dataSet === undefined) {
                            itm = setNewForTypeAll(z, originalFormat[i])
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

            var loopEach = (skipINX) => {
                // NOTE when setting manual itemDataSet input, need to check for it first!
                var initialData = (/* this.grab_ref[uid] */ this.itemDataSet || originalFormat) || []

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

                var loop = (i) => {
                    if (initialData[i]) {
                        var z = initialData[i]
                        // means we are skipping callback for this index
                        if (skipINX === i) return null

                        var perLoop = (_u) => {
                            // in case you retur array instead of single item
                            if (isArray(_u)) _u = head(_u)
                            // auto complete set on every compute iteration
                            if (this.autoComplete) {
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
                                dd = itemUpdated(_u, originalFormat[i]['_ri'])
                            } catch (err) {
                                console.log('-- itemUpdated err', err)
                            }

                            loopd.push(head(dd))

                            i = i + 1
                            loop(i)
                        }
                        var u = cb_sandbox(z, skipINX)
                        perLoop(u)
                    } else {
                        loopd = loopd.filter(z => z !== undefined)
                    }
                }

                loop(0)

                return loopd
            }

            if (method === 'all') {
                // NOTE call back should return new data as an array
                var updatedData = originalFormat || no_uid_no_item
                var updated = cb_sandbox(updatedData)

                if (isArray(updateData)) {
                    if (updateData.length !== this.resIndex[uid].length) {
                        if (this.debug) notify.ulog('[compute], nothing updated, callback item does not match initial data size')
                        return this
                    }
                }

                updateData = itemUpdated(updated)

                // NOTE when computing make sure provided data matches our `_ri` and `_uid` /// validate `_ri && _uid`
                var valid = this._validDataItem(updateData, uid)
                if (!valid && (valid || []).length !== originalFormat.length) {
                    if (this.debug) notify.ulog({ message: 'compute all option did not match all dataSets correctly, either uid length or ri are wrong' }, true)
                }
            } // for all

            //     if (method === 'each') updateData = eachMethod(uid)
            //    this.xpromise.consume(uidRef, updateData)

            if (method === 'each' && uid !== false) {
                updateData = loopEach()
            } else if (method === 'each' && uid === false) {
                // NOTE
                /*
                         when uid is not provided the only way to loop callback with `each` is to
                         findout what the total array is by initially updating with `itemDataSet`
                         will also throw silent error if try to update item index 0 in callback when  itemDataSet was not yet set
                        */
                var u = cb_sandbox() // required to get our itemDataSet
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

            /**
             * justify results from either `all` or `each`
             * ########################################
             * ################################
             */
            // if (uid) delete this.grab_ref[uid]
            this.computeFinalize(uid, updateData)
            return this
        }

        computeFinalize(uid, updateData) {
            // if (!uid && !isEmpty(updateData)) {
            //     // NOTE if passing anonymouse uid find if from updateData
            //     var uids = []
            //     updateData.forEach((job, inx) => {
            //         uids.push(job._uid)
            //     })
            //     // should return uniq 1 job id
            //     uid = uniq(uids).toString()
            // }

            if (isArray(updateData)) updateData = flatMap(updateData) // in case you passed [[]] :)

            if ((updateData || []).length) {
                /// update only those which match ri to previously declared sets!
                for (var i = 0; i < updateData.length; i++) {
                    var updItem = updateData[i]
                    if (isEmpty(updItem)) {
                        if (this.debug) notify.ulog(`[compute] warning item to update is empty, skipping`)
                        continue
                    }

                    var _uid = !uid ? updItem._uid : uid
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

                // NOTE when we filter not all items are passed, so have to set update to non filtered data as well
                if (this.autoComplete) {
                    this.dataArch[uid].forEach((item, inx) => {
                        item.complete = true
                    })
                }

                this.dataArch = Object.assign({}, this.dataArch)
            }
            return this
        }

        computeConditionValidate(uid, cb) {
            if (this.strictJob(uid) === true) {
                return false
            }
            var originalFormat = this.dataArchWhich() // this.grab_ref[uid]
            if (isEmpty(originalFormat)) {
                return false
            }

            if (this.dataArchSealed[uid] && uid !== false) {
                if (this.debug) notify.ulog(`you cannot perform any calculation for ${uid} after data was marked, nothing changed!`, true)
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

            return { originalFormat }
        }
    }
    return PrmCompute
}
