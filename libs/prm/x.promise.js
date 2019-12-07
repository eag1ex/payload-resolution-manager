
/**
  * example 1
  * var xp = new XPromise()
  * xp.p('123')
  * setTimeout(() => {
      xp.p().resolve()
  }, 2000);
     xp.p().then(()=>)
  */

/**
  * example 2
  * const uid = '123'
  * var xp = new XPromise(uid)
  * xp.p('123')
  * setTimeout(() => {
      xp.p().resolve(uid,{data})
  }, 2000);
     xp.p().then(()=>)
  */

/**
 * @XPromise
 * cleaver promise, similar to Q/defer, uses proto getter/setter with dynamic callback to send resolve state
 */
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isArray, isObject, isString, isNumber } = require('lodash')
    class XPromise {
        constructor(promiseUID, debug) {
            // if set initiate promise right away
            if (isString(promiseUID)) {
                this.p(promiseUID)
            }

            this.debug = debug
            this.promiseCBList = {}
            this.xpromise = {}
            this._xpromise = {}
            this._ps = {}
            this.lastUID = null
            this.rejects = []
        }

        test() {
            var uid1 = '1233535'
            var uid2 = '234436'
            this.p(uid1)

            setTimeout(() => {
                this.xp.resolve(uid2, 'abc')
            }, 2000)

            this.ref(uid1).onReady(z => {
                console.log('onReady', z)
            }, err => {
                console.log('err', err)
            })
            // this.ref(uid2).fin().then()

            // console.log('pending', this.p().pending())
            // Promise.all(this.xp.all()).then(d => {
            //     console.log('all', d)
            // }, err => {
            //     console.log('err', err)
            // })
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
         * @p
         * auto set new promise, if doesnt already exist
         * `uid` provide uniq id for each promise
         */
        p(uid) {
            uid = this._getLastRef(uid)

            if (!this.ps[uid]) {
                this.ps[uid] = 'set'
                this.ps = Object.assign({}, this.ps)
            } else {

            }
            return this
        }

        /**
         * @pending
         * return remaining promises
         */
        pending() {
            return Object.keys(this.ps).length
        }

        /**
         * @xp
         * short hand for p(..) method when lastUID is set
        */
        get xp() {
            if (!this.lastUID) {
                if (this.debug) notify.ulog(`cannot use xp if lastUID is not set`, true)
                return this
            }
            var uid = this.lastUID
            this.testUID(uid)

            return this.p(uid)
        }

        /**
         * @set
         * set new promise
         */
        set(uid) {
            uid = this._getLastRef(uid)

            // when setting force to delete any existing promises
            this.delete(uid)

            this.ps[uid] = 'set'
            this.ps = Object.assign({}, this.ps)
            return this
        }

        /**
         * @reject
         * `uid` declare uid if calling many promises
         * `data` when provided data will be resolved in the end
         */
        reject(uid, data = null) {
            uid = this._getLastRef(uid)

            if (!this.ps[uid]) {
                if (this.debug) notify.ulog(`[reject] promise uid: ${uid} does not exist`, true)
                return this
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
            if (data !== null) this.ps[uid].data = data
            this.ps = Object.assign({}, this.ps)
            return this
        }

        /**
         * @resolve
         * `uid` declare uid if calling many promises
         * `data` when provided data will be resolved in the end
         */
        resolve(uid, data = null) {
            uid = this._getLastRef(uid)

            if (!this.ps[uid]) {
                if (this.debug) notify.ulog(`[resolve] promise uid: ${uid}  does not exist`, true)
                return this
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
            if (data !== null) this.ps[uid].data = data
            this.ps = Object.assign({}, this.ps)
            return this
        }

        /**
         * @sync
         * sinc then cannot be used to copy behaviour, use `sync` as promise or await
         */
        fin(uid) {
            uid = this._getLastRef(uid)

            return this.ps[uid].p.then(z => {
                this.delete(uid)
                return Promise.resolve(z)
            }, err => {
                this.delete(uid)
                return Promise.reject(err)
            })
            // .catch(err => {
            //     if (this.debug) notify.ulog({ message: `unhandled rejection`, err })
            // })
        }

        onReady(cb, errCB) {
            var uid = this.lastUID

            try {
                this.testUID(uid)
            } catch (err) {
                notify.ulog(err, true)
            }

            if (!this.validPromise(this.ps[uid])) {
                if (this.debug) notify.ulog(`[then] promise uid: ${uid} is invalid`, true)
                var errMessage = `[then] promise uid: ${uid} is invalid`

                if (typeof errCB === 'function') errCB(errMessage)
                return this
            }

            this.ps[uid].p.then((v) => {
                this.delete(uid)
                if (typeof cb === 'function') cb(v)
            }, err => {
                this.delete(uid)
                if (typeof errCB === 'function') errCB(err)
            })
            return this
        }

        /**
         * @all
         * return all promises in an array, can be used with Promise.all([...])
         */
        all() {
            var promises = []
            for (var k in this.ps) {
                if (!this.ps.hasOwnProperty(k)) continue
                var proms = (this.ps[k] || {}).p
                if (!proms) continue
                promises.push(proms)
            }

            promises = [].concat(this.rejects, promises).filter(z => !!z)
            this.rejects = []// unset
            return promises
        }

        _getLastRef(uid) {
            if (uid) this.lastUID = uid
            if (!uid && this.lastUID) uid = this.lastUID
            this.testUID(uid)
            return uid || null
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
                            self[`_xpromise`][_prop] = val
                            if (self.promiseCBList[_prop]) {
                                var newVal = (val || {}).v
                                var data = (val || {}).data || null
                                if (newVal === true || newVal === false) {
                                    self.promiseCBList[_prop](_prop, newVal, data)
                                }
                            }
                            // notify.ulog({ message: 'new value set', prop: _prop, value: val })
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

            var setPromise = (id) => {
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
            for (var k in v) {
                if (typeof v[k] === 'function') continue
                if ((v[k] || {}).then !== undefined) continue

                // if already set continue

                if (this.validPromise(v[k])) {
                    // resolve or reject
                    if (v[k].v === true || v[k].v === false) {
                        if (v[k].data !== null) {
                            this.xpromise[k] = Object.assign({}, { v: v[k].v, data: v[k].data }, v[k])
                        } else {
                            this.xpromise[k] = Object.assign({}, { v: v[k].v }, v[k])
                        }
                    }
                    continue
                } else {
                    if (v[k] !== undefined) {
                        if (isString(v[k]) && v[k] !== 'set') {
                            if (this.debug) notify.ulog(`[p] to set initial promise you need to provide string value 'set'`, true)
                            continue
                        }
                        if (v[k] === 'set') {
                            // first set the promise and the callback
                            var p = setPromise(k)

                            var listener = this.xPromiseListener(k)
                            listener[k] = 'set'
                            v[k] = {
                                p: p,
                                v: listener[k],
                                data: null
                            }
                        } else {
                            if (this.debug) notify.ulog(`[p] to set initial promise you need to provide string value 'set'`, true)
                            continue
                        }
                    }
                }
            }

            this._ps = v
        }

        isPromise(d) {
            if (isEmpty(d)) return false
            if ((d || {}).then !== undefined) return true
            if (typeof d === 'function') return true

            return false
        }

        delete(uid) {
            this.testUID(uid)
            if (uid) this.lastUID = uid
            if (!uid && this.lastUID) uid = this.lastUID

            delete this.promiseCBList[uid]
            delete this.xpromise[uid]
            delete this._xpromise[uid]
            delete this._ps[uid]

            this.lastUID = null
            return this
        }

        /**
         * @validPromise
         * check that each promise has correct setup
         */
        validPromise(v) {
            return ((v || {}).p !== undefined && (v || {}).v !== undefined)
        }

        testUID(UID) {
            if (!UID) throw ('UID NOT PROVIDED')
            if (!isString(UID)) throw ('PROVIDED UID MUST BE STRING')
            if (UID.split(' ').length > 1) throw ('UID MUST HAVE NO SPACES')
            if (isNumber(UID)) throw ('UID CANNOT BE A NUMBER')
            return true
        }
    }
    return XPromise
}
