module.exports = (notify) => {
    if (!notify) notify = require('../notifications')(notify)
    const { isNumber, isFunction, cloneDeep, isEmpty, isArray } = require('lodash')
    const XPromise = require('../xpromise/x.promise')(notify)
    class PRMTOOLS {
        constructor(debug, opts) {
            this.debug = debug
            // PRMTOOLS
            this._fromRI = null
            this._onlyRI = null
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

        /**
         * @pipe
         * extends xpromise.pipe
         * @param cb # callback or data, usualy `this.resData` if callback not set
         * @param id # optional, but required when `asAsync` is set!
         */
        pipe(cb = null, id) {
            if (!id) id = this.lastUID
            // else this.lastUID = id
            // if (!this.xpromise.pipeExists(id)) {
            //     notify.ulog(`pipe does not exist for id: ${id}`, true)
            //     return this
            // }

            // NOTE why timeout here? Because this `cb` is out of sync with this.xpromise class callabck
            const timeToWait = 100
            this.xpromise.initPipe(id, true) // only called initially if never set
            if (typeof cb === 'function') {
                // setTimeout(() => {
                this.xpromise.pipe(async(d, err) => {
                    if (err) {
                        notify.ulog({ message: `pipe err`, err: err })
                    }
                    // NOTE always return value
                    const _dd = await cb(d, err)
                    var d = _dd === undefined ? true : _dd
                    return d || err
                }, id)
                //  }, timeToWait)
                return this
            } else {
                // NOTE we cannot use promise directly to customize next pipe data return
                // sinze every pipe promise returns from last return , if null then alwasy true, if not rejected
                // use only pipe with callback method to get desired data
                return new Promise((resolve, reject) => {
                    return this.xpromise.pipe(null, id).then(d => {
                        var cb_data_null = isEmpty(cb) || true

                        var dd = d === undefined ? cb_data_null : d
                        resolve(dd)

                        return dd
                    }, err => {
                        // err = cloneDeep(err)
                        notify.ulog({ message: `pipe err`, err: err })
                        reject(err)
                        return Promise.reject(err)
                    })
                })
            }
        }
        endPipe(id) {
            if (!id) id = this.lastUID
            this.xpromise.end(id)
            return this
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
            this._onlyRI = null
            this._fromRI = Number(_ri)
            return this
        }

        /**
         * @only
         * * similar to from, but only from specific RI index
         * @param {*} RI  must provide `_ri` index of data position
         */
        only(RI) {
            if (RI === undefined || RI === null) return this
            var _ri = Number(RI)
            if (!isNumber(_ri)) {
                if (this.debug) notify.ulog(`[only] RI must be a number, without decilams`, true)
                return this
            }

            if (!this.lastUID) {
                if (this.debug) notify.ulog(`[only] last uid not found, not sure where to start RI index`, true)
                return this
            }
            this._fromRI = null
            this._onlyRI = Number(_ri)
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
                if (this._fromRI !== null) {
                    // if from was set filter only matching
                    if (!(val._ri >= this._fromRI)) {
                        return false
                    }
                }

                if (this._onlyRI !== null) {
                    // if only was set filter only matching
                    if (val._ri !== this._onlyRI) {
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
         * @complete
         * mark job data as complete for all dataSets
         * @param {*} uid
         *
         */
        complete(uid) {
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
