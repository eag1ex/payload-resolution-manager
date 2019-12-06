module.exports = (notify, BatchCallbacks) => {
    if (!notify) notify = require('../notifications')(notify)
    const { isNumber, isFunction, cloneDeep, isEmpty, isArray } = require('lodash')
    class PRMTOOLS extends BatchCallbacks {
        constructor(debug, opts) {
            super(debug, opts)
            this.debug = debug
            // PRMTOOLS
            this._fromRI = null
            this._lastFilteredArchData = null
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
            this._lastUID = UID
            return this
        }

        /**
         * @from
         *  in case you are jugling between compute
         * will reset next query to return last job from specified `_ri` position only once
         * `RI` if not set nothing will be chenged
         */
        from(RI) {
            if (RI === undefined) return this
            var _ri = Number(RI)
            if (!isNumber(_ri)) {
                if (this.debug) notify.ulog(`[from] RI must be a number, without decilams`, true)
                return this
            }

            if (!this._lastUID) {
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
         */
        filter(cb) {
            if (!this._lastUID) return this
            if (!isFunction(cb)) return this
            var data = cloneDeep(this.dataArch)[this._lastUID]
            if (isEmpty(data)) return this
            if (!isArray(data)) return this
            // set temporary data holder, extracted and reset via `dataArchWhich` method
            this._lastFilteredArchData = data.filter((val, index) => {
                if (this._fromRI !== undefined) {
                    // if from was set filter only matching
                    if (!(val._ri >= this._fromRI)) return false
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
         * @tap
         * does not make any alterations, just taps in to last data changes, so you can view them
        */
        tap(cb) {
            if (!this._lastUID) return this
            if (!isFunction(cb)) return this
            var data = cloneDeep(this.dataArch)[this._lastUID]
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
