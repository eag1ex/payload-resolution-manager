module.exports = (notify, BatchCallbacks) => {
    if (!notify) notify = require('../notifications')(notify)
    const { isNumber, isFunction, cloneDeep, isEmpty, isArray } = require('lodash')
    const XPromise = require('../xpromise/x.promise')(notify)
    class PRMTOOLS extends BatchCallbacks {
        constructor(debug, opts) {
            super(debug, opts)
            this.debug = debug
            // PRMTOOLS
            this._fromRI = null
            this._lastFilteredArchData = null
            this._xpromise = null
            this.pipeID = null
        }

        /**
         * @XPromise instance
         * read more about this micro service from the class instance
         */
        get xpromise() {
            if (this._xpromise) return this._xpromise
            const opts = {
                // relSufix: '--', // preset default
                showRejects: true, // show reject message in console
                allowPipe: true } // if set Xpipe is enabled and you can pipe stream results of each (base) job
            this._xpromise = new XPromise(null, opts, this.debug)

            return this._xpromise
        }

        pipe(cb, id) {
            if (!id) id = this.lastUID
            if (!this.xpromise.pipeExists(id)) {
                notify.ulog(`pipe does not exist for id: ${id}`, true)
                return this
            }

            // NOTE why timeout here? Because this `cb` is out of sync with this.xpromise class callabck
            const timeToWait = 100
            if (typeof cb === 'function') {
                //  setTimeout(() => {
                this.xpromise.pipe((d, err) => {
                    // console.log('pipe d', d, err)
                    d = cloneDeep(d)
                    if (err) {
                        err = cloneDeep(err)
                        notify.ulog({ message: `pipe err`, err: err })
                    }
                    // NOTE always return value
                    const _dd = cb(d, err)
                    var d = _dd === undefined ? true : _dd
                    return d || err
                }, id)
                // }, timeToWait)
                return this
            } else {
                return new Promise((resolve, reject) => {
                    return this.xpromise.pipe(null, id).then(d => {
                        d = cloneDeep(d)
                        // NOTE always return value
                        var dd = d === undefined ? true : d
                        //    setTimeout(() => {
                        resolve(dd)
                        // }, timeToWait)

                        return dd
                    }, err => {
                        err = cloneDeep(err)
                        notify.ulog({ message: `pipe err`, err: err })
                        // setTimeout(() => {
                        reject(err)
                        //   }, timeToWait)
                        return Promise.reject(err)
                    })
                })
            }
        }

        /**
         * @of
         * in case you are jugling between compute and do not want to change uid position
         * will reset next query to return that job only once.
         * `UID` if not set nothing will be changed
         */
        of(UID) {
            if (UID) this.valUID(UID)
            else return this
            if (!this.dataArch[UID]) {
                if (this.debug) notify.ulog(`[of] UID invalid, not found`, true)
                return this
            }
            this.lastUID = UID
            return this
        }

        /**
         * @from
         *  in case you are jugling between compute
         * will reset next query to return last job from specified `_ri` position only once
         * `RI` if not set nothing will be chenged
         */
        from(RI) {
            if (RI === undefined || RI === null) return this
            var _ri = Number(RI)
            if (!isNumber(_ri)) {
                if (this.debug) notify.ulog(`[from] RI must be a number, without decilams`, true)
                return this
            }

            if (!this.lastUID) {
                if (this.debug) notify.ulog(`[from] last uid not found, not sure where to start RI index`, true)
                return this
            }

            this._fromRI = _ri
            return this
        }

        /**
         * @filter
         * an ordinary `filter` method returned as a callback(value,index, ri) ? true:false
         * this tool will return filtered values for `compute` callback method where you can make thurder changes
         * leaving rest of data unchanged!
         * `uid` optional if you want to force reorder of last job reference to continue
         */
        filter(cb, uid) {
            if (uid) this.lastUID = uid
            else uid = this.lastUID
            this.valUID(uid)

            if (!uid) return this
            if (!isFunction(cb)) return this
            var data = cloneDeep(this.dataArch)[uid]
            if (isEmpty(data)) return this
            if (!isArray(data)) return this

            // set temporary data holder, extracted and reset via `dataArchWhich` method
            this._lastFilteredArchData = data.filter((val, index) => {
                if (this._fromRI !== undefined) {
                    // if from was set filter only matching
                    if (!(val._ri >= this._fromRI)) {
                        return false
                    }
                }
                var v
                try {
                    v = cb(val, index)
                } catch (err) {
                    notify.ulog(err, true)
                    v = false
                }
                return v || false
            })

            return this
        }

        /**
         * @completed
         * mark job data as complete for all dataSets
         * @param {*} uid
         *
         */
        completed(uid) {
            if (uid) this.lastUID = uid
            else uid = this.lastUID
            this.valUID(uid)
            if (!this.dataArch[uid]) {
                return this
            }
            this.dataArch[uid].forEach(element => {
                element.complete = true
            })

            this.dataArch = Object.assign({}, this.dataArch)

            return this
        }

        /**
         * @tap
         * does not make any alterations, just taps in to last data changes, so you can view them
        */
        tap(cb) {
            if (!this.lastUID) return this
            if (!isFunction(cb)) return this
            var data = cloneDeep(this.dataArch)[this.lastUID]
            if (isEmpty(data)) return this
            data.map((z, i) => {
                try {
                    cb(z, i)
                } catch (err) {
                    notify.ulog(err, true)
                }
            })
            return this
        }
    }

    return PRMTOOLS
}
