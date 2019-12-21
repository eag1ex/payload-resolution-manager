
/**
 * @XPromiseBase class
 * base logic and methods
 */
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isArray, isObject, isString, isNumber, times, isFunction, reduce, cloneDeep } = require('lodash')

    class XPromiseBase {
        constructor(promiseUID, opts, debug) {
            // if set initiate promise right away
            if (isString(promiseUID)) {
                this.defer(promiseUID)
            }
            this._relSufix = opts.relSufix || '--'
            this.showRejects = opts.showRejects || null // print reject messages to the console
            this.allowPipe = opts.allowPipe || null //  you can pipe thru each promise after it was consumed with `asPromise` or `onReady`
            this.debug = debug
            this.promiseCBList = {}
            this.xpromise = {}
            this._xpromise = {}
            this._ps = {}
            this.lastUID = null
            this.rejects = []
            // this.delayedProcessingCB = {} // delay processing from `asPromise` or `onReady`
            this.delayCB = {}// delay call for each `asPromise` or `onReady` when needed
        }

        /**
         * @_initiatePiping
         * initiate piping feature
         */
        _initiatePiping(uid, resolution, data, allowPipe) {
            if (!this.allowPipe) return false
            // override to disable pipe for this call
            if (this.allowPipe === true && allowPipe === false) {
                return false
            }
            // make sure pipe calls after resolution of Xpromise
            setTimeout(() => {
                // call original  Xpipe before update
                this.initPipe(uid, data, resolution)
                    .pipe((d, err) => {
                        //  if (this.debug) notify.ulog('Xpipe initiated')
                        if (err) return err
                        return d
                    })
            }, 100)

            return true
        }
        /**
         * @checkPSOrder
         * check promise order by `timestamp`
         * return promise uids with timestemp order
         */
        checkPSOrder() {
            if (isEmpty(this.ps)) return []
            var order = reduce(cloneDeep(this.ps), (n, el, k) => {
                n.push({ id: k, timestamp: el.timestamp })
                return n
            }, [])
            return order.sort((a, b) => {
                return a.timestamp - b.timestamp
            })
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

        _resolveAllRelativeAS(uid, cb = null, cbERR = null) {
            var rel = this._findRelativePromise(uid)
            var hasCallbacks = isFunction(cb) || isFunction(cbERR)
            if (rel) {
                var { relative, refs } = rel
                // if has callback do not return promise
                const p = Promise.all(relative).then((d) => {
                    times(refs.length, i => {
                        this.delete(refs[i], false)
                    })
                    this.updatePS(true)

                    // return resolve data or callback data if not null
                    if (isFunction(cb)) {
                        try {
                            var cbData = cb(d) || d
                            this._initiatePiping(uid, true, cbData) // conditionally enable piping
                        } catch (err) {
                            this._initiatePiping(uid, false, { error: err }) // conditionally enable piping
                        }

                        return
                    }
                    if (!isFunction(cb)) {
                        this._initiatePiping(uid, true, d) // conditionally enable piping
                        return Promise.resolve(d)
                    }
                }, err => {
                    times(refs.length, i => {
                        this.delete(refs[i], false)
                    })
                    this.updatePS(true)

                    if (isFunction(cbERR)) {
                        try {
                            var cbData = cbERR(err) || err
                            this._initiatePiping(uid, false, cbData) // conditionally enable piping
                        } catch (err) {
                            this._initiatePiping(uid, false, { error: err }) // conditionally enable piping
                        }
                        if (this.showRejects) {
                            notify.ulog({ message: 'onReady err', error: err }, true)
                        }
                        return
                    }
                    if (!isFunction(cbERR)) {
                        this._initiatePiping(uid, false, err) // conditionally enable piping
                        if (this.showRejects) {
                            notify.ulog({ message: 'asPromise err', error: err }, true)
                        }
                        return Promise.reject(err)
                    }
                })

                if (hasCallbacks) return this
                else return p
            } else {
                return null
            }
        }

        /**
         * @_findRelativePromise
         * relative promise ends with sufix `--{index}`, means it belongs to one ref/uid and we need to only make one ready/all/asPromise call to compelte it
         */
        _findRelativePromise(uid) {
            // find relative uid/refs
            this.testUID(uid)

            // do not find relative's with relative!
            if (this.validRelJob(uid)) {
                return null
            }
            var relative = []
            var refs = []
            for (var k in this.ps) {
                if (k.indexOf(uid) !== -1 && k.indexOf(this.relSufix) !== -1) {
                    if (this.validPromise(this.ps[k])) {
                        relative.push(this.ps[k].p)
                        refs.push(k) // also collect refs so we can dispose of all data by ref/uid
                    }
                }
            }

            if (relative.length) {
                // if provided wasnt relative and without sufix `--{index}`, append it to end as well
                if (this.validPromise(this.ps[uid])) {
                    relative = [].concat(relative, this.ps[uid].p).filter(z => !!z)
                    refs = [].concat(refs, uid).filter(z => !!z)
                }
                return { relative, refs }
            } else return null
        }

        _getLastRef(uid) {
            if (uid) this.lastUID = uid
            if (!uid && this.lastUID) uid = this.lastUID
            this.testUID(uid)
            return uid || null
        }

        /**
         * @processing
         * mark as processing=true  when calling with `asPromise`, `onReady`, `all` so future calls to resolve same promise will be ignored!
         */
        processing(uid, relative = true) {
            if (this.ps[uid]) {
                // do not process it holding the que
                // if (this.ps[uid].hold) return false

                if (!(this.ps[uid] || {}).processing) {
                    this.ps[uid].processing = true
                    //  this.ps[uid].timestamp = new Date().getTime()
                    if (relative) this.relativeProcessing(uid)
                    this.ps = Object.assign({}, this.ps)
                }

                return true
            } else return false
        }

        set relSufix(v) {
            var _default = `--`
            if (isEmpty(v)) v = _default
            if (!isString(v)) v = _default
            this._relSufix = v
        }
        get relSufix() {
            return `--`
        }

        /**
         * @validRelJob
         * verify if dealing with relative job
         */
        validRelJob(uid = '') {
            if (uid.indexOf(this.relSufix) === -1) return false
            var num = uid.split(this.relSufix)[1]

            if (isEmpty(num)) return false
            if (isNaN(Number(num))) return false
            return true
        }
        /**
         * @relativeProcessing
         * find relative when processing base uid
         */
        relativeProcessing(uid) {
            // process relative only when using base promise
            if (this.validRelJob(uid)) return

            var updated = false
            for (var k in this.ps) {
                if (k.indexOf(uid) !== -1 && k.indexOf(this.relSufix) !== -1) {
                    if (this.validPromise(this.ps[k])) {
                        if (!(this.ps[k] || {}).processing) {
                            this.ps[k].processing = true
                            //  this.ps[k].timestamp = new Date().getTime()
                            this.ps[k].entity = 'data'
                            updated = true
                        }
                    }
                }
            }

            if (updated) {
                // this.ps = Object.assign({}, this.ps)
                // updated from `processing`
            }
        }

        /**
         * @xPromiseListener
         * set a listener for promise when values change, call to resolve the promise using callback
         */
        xPromiseListener(prop) {
            // means already set
            if (!isEmpty(this.xpromise[prop])) return
            const self = this
            const _prop = prop

            try {
                (function(prop) {
                    Object.defineProperty(self.xpromise, prop, {
                        get: function() {
                            return self[`_xpromise`][_prop]
                        },
                        set: function(val) {
                            if (self.promiseCBList[_prop]) {
                                if ((val || {}).copy) return
                                var newVal = (val || {}).v
                                var processing = (val || {}).processing
                                var data = (val || {}).data || null
                                var external = (val || {}).external

                                if ((newVal === true || newVal === false) && processing === true) {
                                    if (!external) self.promiseCBList[_prop](_prop, newVal, data)
                                    delete (val || {}).processing
                                }
                            }
                            self[`_xpromise`][_prop] = val
                            //  notify.ulog({ message: 'new value set', prop: _prop, value: val })
                        },
                        enumerable: true,
                        configurable: true
                    })
                })(prop)
            } catch (err) {
                console.log('-- err cresting listener ', err)
            }

            return this.xpromise // Object.assign(XPromise.prototype, this.xp)
        }

        get ps() {
            return this._ps
        }
        /**
         * @ps
         * create promise object, listen for callbacks from `xPromiseListener` to resolve the promise
         */
        set ps(v) {
            if (isEmpty(v)) return null
            if (isArray(v)) return null
            if (!isObject(v)) return null
            if (!Object.keys(v).length) return null

            for (var k in v) {
                if (this.isPromise(v[k])) continue

                if (this.validPromise(v[k])) {
                    // initiate callback to resolve or reject
                    if (v[k].processing === true) {
                        this.xpromise[k] = Object.assign({}, v[k])
                        continue
                    }

                    // resolve or reject
                    if ((v[k].v === true || v[k].v === false)) {
                        if (v[k].external === undefined) {
                            if (v[k].data !== null) {
                                this.xpromise[k] = Object.assign({}, { v: v[k].v, data: v[k].data }, v[k])
                            } else {
                                this.xpromise[k] = Object.assign({}, { v: v[k].v }, v[k])
                            }
                        }
                    }

                    continue
                    /// ////////////////////////////////
                    // set only initialy
                } else {
                    if (v[k] !== undefined) {
                        if ((v[k] || {}).consume !== undefined) {
                            if (this.isPromise(v[k].consume)) {
                                var listener = this.xPromiseListener(k)
                                listener[k] = 'set'
                                v[k].v = listener[k]
                                v[k].p = v[k].consume // holds data from external promise
                                v[k].processing = null
                                v[k].external = true
                                v[k].entity = null

                                delete v[k].consume
                            }

                            continue
                        }

                        if ((v[k] || {}).external !== undefined) {
                            continue
                        }

                        if (isString(v[k]) && v[k] !== 'set') {
                            if (this.debug) notify.ulog(`[p] to set initial promise you need to provide string value 'set' 1`, true)
                            continue
                        }

                        if (v[k] === 'set') {
                            // first set the promise and the callback
                            var p = this.newPromise(k)

                            var listener = this.xPromiseListener(k)
                            listener[k] = 'set'
                            v[k] = {
                                // timestamp: new Date().getTime(), // to track que orders
                                p: p,
                                processing: null, // in case we call multiples of then this will make sure it can only be called once!
                                v: listener[k],
                                data: null
                            }
                        } else {
                            if (this.debug) notify.ulog(`[p] to set initial promise you need to provide string value 'set' 2`, true)

                            continue
                        }
                    }
                }
            } // for

            this._ps = v
        }

        /**
         * @newPromise
         * set new promise with callback listener on when to resolve
         */
        newPromise(id) {
            return new Promise((resolve, reject) => {
                if (!this.promiseCBList[id]) {
                    // wait for change in xpromise to initiate callback
                    this.promiseCBList[id] = (name, value, data) => {
                        var d = data !== null ? data : value

                        if (value === true) {
                            delete this.promiseCBList[id]
                            return resolve(d)
                        }

                        if (value === false) {
                            delete this.promiseCBList[id]
                            return reject(d)
                        }
                    }
                    return
                }
                resolve(true)
            })
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

        /**
         * @validPromise
         * check that each promise has correct setup
         */
        validPromise(v) {
            return ((v || {}).p !== undefined && (v || {}).v !== undefined)
        }

        /**
         * @delete
         * called after each promsie is consumed via `onReady` or `asPromise`
         */
        delete(uid, update = false) {
            var dels = 0
            try {
                this.testUID(uid)
                if (uid) this.lastUID = uid
                if (!uid && this.lastUID) uid = this.lastUID

                // TODO not sure if toDelete will cause issue with this

                if (this.promiseCBList[uid]) {
                    delete this.promiseCBList[uid]
                    dels++
                }
                if (this.xpromise[uid]) {
                    delete this.xpromise[uid]
                    dels++
                }
                if (this._xpromise[uid]) {
                    delete this._xpromise[uid]

                    dels++
                }
                if (this._ps[uid]) {
                    delete this._ps[uid]
                    dels++
                }
            } catch (err) {

            }
            if (update === true) this.updatePS(dels)
            if (dels) {
                return true
            } else return false
            // this.lastUID = null
        }

        updatePS(ok) {
            if (ok) {
                this.ps = Object.assign({}, this.ps)
            }
        }

        testUID(UID) {
            if (!UID) throw ('UID NOT PROVIDED')
            if (!isString(UID)) throw ('PROVIDED UID MUST BE STRING')
            if (UID.split(' ').length > 1) throw ('UID MUST HAVE NO SPACES')
            if (isNumber(UID)) throw ('UID CANNOT BE A NUMBER')
            if (UID.length < 2) throw ('UID MUST BE LONGER THEN 1 CHARS')
            return true
        }
    }
    return XPromiseBase
}
