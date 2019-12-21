
/**
 * @XPromise
 */
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isArray, times, isFunction, indexOf } = require('lodash')

    const XPromiseBase = require('./x.promise.base')(notify)

    class XPromise extends XPromiseBase {
        constructor(promiseUID, opts, debug) {
            super(promiseUID, opts, debug)
        }

        /**
         * @exists
         * check if promise by uid/ref exists
         * `uid` must provide uid
         * `relative=false` when set will also check for any relative promise with sufix `--{index}`
        */
        exists(uid, relative = null) {
            this.testUID(uid)

            // test for any relative promise that exist
            var relIndex = 0

            // only test when base uid is not relative job
            if (relative && !this.validRelJob(uid)) {
                this.testUID(uid)

                for (var k in this.ps) {
                    if (k.indexOf(uid) !== -1 && k.indexOf(this.relSufix) !== -1) {
                        relIndex++
                        break // exit quickly if any matched
                    }
                }

                if (relIndex) return true
                else if (this.ps[uid]) return true
            } else if ((this.ps[uid] && !relative) || this.ps[uid]) return true
            return false
        }

        /**
         * @ref
         * set next available uid when chaining
         */
        ref(uid) {
            if (uid) {
                if (!this.ps[uid]) {
                    if (this.debug) {
                        notify.ulog(`[ref] uid does not match any available promise, did you set it yet?`, true)
                    }
                    return this
                }
                this.testUID(uid)
                this.lastUID = uid
            }
            return this
        }

        /**
         * @defer
         * auto set new promise, if doesnt already exist
         * `uid` provide uniq id for each promise
         */
        defer(uid) {
            uid = this._getLastRef(uid)

            if (!this.ps[uid]) {
                this.ps[uid] = 'set'
                this.ps = Object.assign({}, this.ps)
            } else {

            }
            return this
        }

        /**
         * @get
         * resolve
         * `cb` must provide callback, and return data to set new resolve/reject state
         * `uid or [uid...]` provide uid if not chaining, or if want to resolve multiple promise, provide array of uids
         * note: if providing array of uids you have to resolve each uid seperatly, your self in order to end `asPromise` or `onReady` since its waiting for your request
         */
        get(cb, uid) {
            if (!isFunction(cb)) {
                if (this.debug) notify.ulog(`[get()] must have callback set`, true)
                return this
            }

            const reset = (uids = []) => {
                // set as new
                for (var i = 0; i < uids.length; i++) {
                    this.delete(uids[i], true)
                    this.set(uids[i]) // set as new
                }
            }

            // in case of string
            uid = [].concat(uid)

            if (uid.length > 1) {
                var primeUID = uid.length > 1 ? uid.filter(z => !this.validRelJob(z))[0] : uid[0]

                uid = uid.filter(z => this.ps[z] !== undefined)
                // sort uid in order initialy declared!
                var checkPSOrder = this.checkPSOrder()
                if (checkPSOrder.length) {
                    uid = checkPSOrder.map(z => {
                        if (indexOf(uid, z.id) !== -1) return z.id
                        else return null
                    }).filter(n => !!n)
                }

                var multiPromise = []
                for (var i = 0; i < uid.length; i++) {
                    // get ps copy before reset
                    this.ps[uid[i]].processing = true
                    this.ps = Object.assign({}, this.ps)
                    this.lastUID = uid[i]// update last ref
                    multiPromise.push(this.$get)
                    reset([uid[i]]) // set as new
                }

                // NOTE for multi promise callback, we have to resolve data using our own logic, since we do know intent of this data!

                Promise.all(multiPromise).then(z => {
                    try {
                        const d = cb(z) || null
                        this.resolve(primeUID, d) // set new resolve for this uid
                    } catch (err) {
                        this.reject(primeUID, err) // set new reject for this uid
                    }
                }, err => {
                    try {
                        const d = cb(err) || null
                        this.resolve(primeUID, d) // set new resolve for this uid
                    } catch (err) {
                        this.reject(primeUID, err) // set new reject for this uid
                    }

                    // set reject reject all if any fail
                    times(uid.length, inx => {
                        this.reject(uid[inx], err)
                    })
                })
            } else {
                uid = (uid || '').toString()
                uid = this._getLastRef(uid)
                this.testUID(uid)
                this.ps[uid].processing = true
                this.ps = Object.assign({}, this.ps)

                // for one promise callback we can resolve date here, since provided callback is our new data
                this.$get.then(z => {
                    try {
                        const d = cb(z) || null
                        this.resolve(uid, d) // set new resolve for this uid
                    } catch (err) {
                        this.reject(uid, err) // set new reject for this uid
                    }
                }, err => {
                    const isInvalid = (err || {}).invalid
                    // NOTE donot pipe dont this promise if have indernal `invalid` internal error
                    if (isInvalid) {
                        cb(err)
                        if (this.showRejects) {
                            notify.ulog(err, true)
                        }
                        return
                    }

                    try {
                        const d = cb(err) || null
                        this.reject(uid, d)
                    } catch (_err) {
                        const dd = cb(_err)
                        this.reject(uid, dd)
                    }
                })

                reset([uid]) // set as new
            }
            return this
        }

        /**
         * @$get
         * resolve current promise, require last uid state, or use `this.ref`
         */
        get $get() {
            const uid = this.lastUID
            if (!uid) {
                const msg = `[$get] lastUID referenc not set, use ref(uid) to set it, nothing done`
                return Promise.reject({ invalid: true, message: msg })
                // .catch(err => {
                //     if (this.debug) notify.ulog(err, true)
                // })
            }

            if (!this.ps[uid]) {
                const msg = `[$get] no promise available for this id ${uid}`
                return Promise.reject({ invalid: true, message: msg })
                // .catch(err => {
                //     if (this.debug) notify.ulog(err, true)
                // })
            }
            this.testUID(uid)

            if (!this.isPromise(this.ps[uid].p)) {
                const msg = `[$get] last UID ${uid} is not a promise, or defer not set`
                return Promise.reject({ invalid: true, message: msg })
                // .catch(err => {
                //     if (this.debug) notify.ulog(err, true)
                // })
            }

            /// //////////////////////////
            // update resolve/reject

            delete this.ps[uid].processing
            /// /////////////
            this.updatePS(true)

            return this.ps[uid].p.then(z => {
                this.delete(uid, true) // delete it and reset same uid with ready resolved data

                return z
            }, err => {
                this.delete(uid, true) // delete it and reset same uid with ready reject data
                return err
            })
        }

        /**
         * @consume
         * combine external promise with Xpromise
         * `extPromise` unresolved, provide external promise. Supports detection if data is a promise and converts to Promise if its not
         */
        consume(uid, extPromise) {
            uid = this._getLastRef(uid)

            if (!this.isPromise(extPromise)) {
                if (this.debug) notify.ulog(`[consume] extPromise, will use resolve() instead`)
                //  return this
                // note if not a promsie make it one!
                const normalData = extPromise
                return this.resolve(uid, normalData)
            }

            if (!this.ps[uid]) {
                this.ps[uid] = {}
                this.ps[uid].timestamp = new Date().getTime()
                this.ps[uid].consume = extPromise
                this.ps = Object.assign({}, this.ps)
            } else {

            }
            return this
        }

        /**
         * @pending
         * return remaining promises
         */
        get pending() {
            return Object.keys(this.ps).length
        }

        /**
         * @set
         * set new promise
         * `uid`
         */
        set(uid, relative = true, update = true) {
            uid = this._getLastRef(uid)

            // when setting force to delete any existing promises
            if (relative) this.delete(uid, true)

            this.ps[uid] = 'set'
            if (update) this.ps = Object.assign({}, this.ps)
            return this
        }

        /**
         * @reject
         * `uid` declare uid if calling many promises
         * `data` provided data will be resolved in the end
         */
        reject(uid, data = null) {
            uid = this._getLastRef(uid)

            if (!this.ps[uid]) {
                //   if (this.debug) notify.ulog(`[reject] uid: ${uid} does not exist, setting as new!`)
                this.set(uid)
                // return this
            }

            if (!this.validPromise(this.ps[uid])) {
                if (this.debug) notify.ulog(`[reject] promise uid: ${uid} is invalid`, true)
                return this
            }

            /// already set do nothing
            if (this.ps[uid].v !== undefined && this.ps[uid].v !== 'set') {
                return this
            }

            this.ps[uid].v = false
            this.ps[uid].entity = 'data'
            this.ps[uid].timestamp = new Date().getTime()
            if (data !== null) this.ps[uid].data = data
            this.ps = Object.assign({}, this.ps)

            return this
        }

        /**
         * @resolve
         * `uid` declare uid if calling many promises
         * `data` provided data will be resolved in the end
         */
        resolve(uid, data = null) {
            uid = this._getLastRef(uid)

            if (!this.ps[uid]) {
                //  if (this.debug) notify.ulog(`[resolve] uid: ${uid} does not exist, setting as new!`)
                this.set(uid)
                // return this
            }

            if (!this.validPromise(this.ps[uid])) {
                if (this.debug) notify.ulog(`[resolve] promise uid: ${uid} is invalid`, true)
                return this
            }

            /// already set do nothing
            if (this.ps[uid].v !== undefined && this.ps[uid].v !== 'set') {
                return this
            }

            this.ps[uid].v = true
            this.ps[uid].entity = 'data'
            this.ps[uid].timestamp = new Date().getTime()
            if (data !== null) this.ps[uid].data = data
            this.ps = Object.assign({}, this.ps)

            return this
        }

        /**
         * @delay
         * works just like setTimeout, but allows to track the process
         * `cb`: must pass callback with what you want to delay
         * `time`: defauld time in ms is 100
         * `uid`: pass uid or last will be used
         */
        delay(cb, time = 100, uid) {
            if (!isFunction(cb)) {
                if (this.debug) notify.ulog(`[delay] cb must be a function`, true)
                return this
            }

            uid = this._getLastRef(uid)
            if (isEmpty(this.delayCB[uid])) {
                this.delayCB[uid] = []
            }
            const p = (() => {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        cb()
                        resolve(true)
                    }, time)
                })
            })()
            this.delayCB[uid].push(p)
            return this
        }

        /**
         * @sync
         * sinc then cannot be used to copy behaviour, use `sync` as promise or await
         * `uid`: identify your promise if not chaining
         * `allowPipe:boolean` optional to disable `opts.allowPipe` for this call
         */
        asPromise(uid, allowPipe) {
            uid = this._getLastRef(uid)

            const _continue = () => {
                if (!this.processing(uid, true)) {
                    return Promise.reject(`[asPromise] uid ${uid} already processed once before, unless this uid is your relative base which you havent declared`, true)
                }

                var rel = this._resolveAllRelativeAS(uid)
                if (rel !== null) return rel
                else {
                    return this.ps[uid].p.then(z => {
                        this.delete(uid, true)
                        this._initiatePiping(uid, true, z, allowPipe) // conditionally enable piping
                        return Promise.resolve(z)
                    }, err => {
                        this.delete(uid, true)
                        this._initiatePiping(uid, false, err, allowPipe) // conditionally enable piping
                        if (this.showRejects) {
                            notify.ulog({ message: 'asPromise err', error: err }, true)
                        }
                        return Promise.reject(err)
                    })
                }
            }

            if (!this.exists(uid, true)) {
                return Promise.reject(`[asPromise] uid ${uid} doesnt exist or already resolved and deleted`)
            }

            if (isArray(this.delayCB[uid]) && !isEmpty(this.delayCB[uid])) {
                return Promise.all(this.delayCB[uid]).then(z => {
                    // slight delay required
                    delete this.delayCB[uid]
                    return this.whenTrue(100, this.ps[uid] !== undefined).then(z => _continue(uid))
                }, err => {
                    delete this.delayCB[uid]
                    return Promise.reject(err)
                })
            } else {
                return this.whenTrue(100, this.ps[uid] !== undefined).then(z => _continue(uid), err => {
                    return Promise.reject(err)
                })
            }
        }

        /**
         * @onReady
         * finall call for Xpromise on resolve or reject, including relative promise
         * `cb=>` callback resolved promise, you can munipulate data by return callback with `opts.allowPipe=true`
         *  and this will pass data stream to the next .pipe
         * `errCB=>` same as `cb` but returns reject promise
         * `uid`: identify your callback promise if not chaining
         * `allowPipe:boolean` optional to disable `opts.allowPipe` for this call
         */
        onReady(cb, errCB, uid, allowPipe) {
            uid = this._getLastRef(uid)
            const _continue = (uid) => {
                try {
                    this.testUID(uid)
                } catch (err) {
                    notify.ulog(err, true)
                }

                if (!this.exists(uid, true)) {
                    var msg = `[onReady] uid ${uid} doesnt exist or already resolved and deleted`
                    if (typeof errCB === 'function') errCB(msg)
                    return this
                }

                if (!this.validPromise(this.ps[uid])) {
                    if (this.debug) notify.ulog(`[onReady] promise uid: ${uid} is invalid`, true)
                    var errMessage = `[onReady] promise uid: ${uid} is invalid`

                    if (typeof errCB === 'function') errCB(errMessage)
                    return this
                }

                if (!this.processing(uid, true)) {
                    var msg = `[onReady] uid ${uid} already processed once before`
                    if (typeof errCB === 'function') errCB(msg)
                    return this
                }

                var rel = this._resolveAllRelativeAS(uid, cb, errCB)
                if (rel !== null) return rel
                else {
                    this.ps[uid].p.then((v) => {
                        this.delete(uid, true)

                        if (isFunction(cb)) {
                            try {
                                var cbData = cb(v) || v
                                this._initiatePiping(uid, true, cbData, allowPipe) // conditionally enable piping
                            } catch (err) {
                                this._initiatePiping(uid, false, { error: err }, allowPipe) // conditionally enable piping
                            }
                        }
                    }, err => {
                        this.delete(uid, true)

                        if (isFunction(errCB)) {
                            try {
                                var cbData = errCB(err) || err
                                this._initiatePiping(uid, false, cbData, allowPipe) // conditionally enable piping
                            } catch (err) {
                                this._initiatePiping(uid, false, { error: err }, allowPipe) // conditionally enable piping
                            }
                        }

                        if (this.showRejects) {
                            notify.ulog({ message: 'onReady err', error: err }, true)
                        }
                    })
                    return this
                }
            }
            if (isArray(this.delayCB[uid]) && !isEmpty(this.delayCB[uid])) {
                Promise.all(this.delayCB[uid]).then(z => {
                    // slight delay required
                    delete this.delayCB[uid]
                    return this.whenTrue(100, this.ps[uid] !== undefined).then(z => _continue(uid))
                }, err => {
                    delete this.delayCB[uid]
                    return Promise.reject(err)
                })
                return this
            } else {
                this.whenTrue(100, this.ps[uid] !== undefined).then(z => _continue(uid))
                return this
            }
        }

        /**
         * @all
         * return all promises in an array, can be used with Promise.all([...])
         */
        get all() {
            var promises = []
            var updated = false
            for (var k in this.ps) {
                if (!this.ps.hasOwnProperty(k)) continue
                var proms = (this.ps[k] || {}).p

                if (!(this.ps[k] || {}).processing) {
                    this.ps[k].processing = true
                    //   delete this.ps[k].hold
                    this.ps[k].timestamp = new Date().getTime()
                    updated = true
                }
                if (!proms) continue
                promises.push(proms)
            }

            // make sure we mark processing here as well!
            if (updated) {
                this.ps = Object.assign({}, this.ps)
            }

            promises = [].concat(this.rejects, promises).filter(z => !!z)
            this.rejects = []// unset
            this.lastUID = null
            return promises
        }
    }

    const XpromiseExtended = require('./x.pipe')(XPromise, notify)
    return XpromiseExtended
}
