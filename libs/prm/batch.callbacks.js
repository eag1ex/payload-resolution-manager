
/**
 * @BatchCallbacks
* assing callback properties to batchResolution
*/
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isString, uniq } = require('lodash')
    /**
     * assing callback properties to batchResolution
     */
    class BatchCallbacks {
        constructor(debug) {
            this.debug = debug
            this.batchCBList = {}
            this.batchCB_copy = null // keep cb copy
        }

        // createCBListener(prop) {
        //     const self = this
        //     const _prop = prop
        //     try {
        //         (function(prop) {
        //             Object.defineProperty(self, prop, {
        //                 get: function() {
        //                     return self[`_${_prop}`]
        //                 },
        //                 set: function(val) {
        //                     self[`_${_prop}`] = val

        //                     // notify.ulog({ message: 'prop set', val: self[`_${_prop}`] })
        //                     //  setTimeout(() => {
        //                     var prps = cloneDeep(self[`_${_prop}`])
        //                     for (var k in prps) {
        //                         if (!prps.hasOwnProperty(k)) continue
        //                         var uid = k
        //                         if (typeof self.batchCBList[uid] === 'function') {
        //                             self.batchCBList[uid](val)
        //                         }
        //                     }
        //                     // }, 100)
        //                 },
        //                 configurable: true, // strict
        //                 enumerable: true /// make it visible
        //             })
        //         })(prop)
        //     } catch (err) {
        //         console.log('-- err cresting listener ', err)
        //     }
        // }

        /**
         * @batchCBDone
         * will check when each batch callback was made if both set
         * make final callback
         */
        batchCBDone(uids, cb) {
            var delOld = () => {
                for (var i = 0; i < uids.length; i++) {
                    if (this.batchCBList[uids[i]] !== undefined) {
                        delete this.batchCBList[uids[i]]
                        // console.log('deleted done callback', uids[i])
                    }
                }
            }
            var callsMade = []
            for (var i = 0; i < uids.length; i++) {
                this.batchCB(uids[i], (uid) => {
                    callsMade.push(uid)
                    callsMade = uniq(callsMade)
                    if (callsMade.length >= uids.length) {
                        cb()
                        // unsubscribe delete all callbacks
                        delOld()
                    }
                })
            }
        }
        /**
         * @batchCB
         * create new callback, or return existing
         * when hoisting calls from top to bottom, the callback is not awailable, untill the very end, so we que it can call it next time it is!
         */
        batchCB(uid, cb = null) {
            if (!uid || !isString(uid)) {
                return null
            }

            try {
                // store the callback
                if (!this.batchCB_copy && typeof cb === 'function') this.batchCB_copy = cb

                // check if any callbacks in que
                for (var k in this.batchCBList) {
                    if (!this.batchCBList.hasOwnProperty(k)) return

                    if (this.batchCBList[k] === true && !cb) {
                        if (this.batchCB_copy) {
                            this.batchCBList[k] = this.batchCB_copy
                            // make sure to only call it when we know callback is available
                            this.batchCBList[k](k)
                            // turn off once callled
                            this.batchCBList[k] = false
                        }
                    }
                }
                if (!cb) {
                    if (typeof this.batchCBList[uid] === 'function') {
                        this.batchCBList[uid](uid)
                        this.batchCBList[uid] = false // turn off once callled
                        return
                    }
                    if (this.batchCBList[uid] === undefined && !cb) {
                        if (this.batchCB_copy) {
                            this.batchCBList[uid] = this.batchCB_copy
                            this.batchCBList[uid](uid)
                            this.batchCBList[uid] = false
                        } else {
                            this.batchCBList[uid] = true
                        }
                    }
                }

                return
            } catch (err) {
                console.log('-- err no match found', err)
            }
        }

        /**
         * @del
         * delete callback from batchBCList by `uid`
         */
        del(uid) {
            if (this.batchBCList[uid] !== undefined) {
                delete this.batchBCList[uid]
            }
            return this
        }
    }

    return BatchCallbacks
}
