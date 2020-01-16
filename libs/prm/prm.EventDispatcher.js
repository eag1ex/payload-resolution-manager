
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()

    class EventDispatcher {
        constructor(debug) {
            this.debug = debug
            this.cbQueue = {}
            this.dispatchInstance = {}
        }

        initListener(uid, cb) {
            this.Dispatch(uid, cb)
            return this
        }

        /**
         * @next
         * send next data to the `batchReady` callback
         * @param {*} uid # required
         * @param {*} data # optional
         */
        next(uid, data = null) {
            if (this.dispatchInstance[uid]) {
                this.dispatchInstance[uid].next(data)
            } else notify.ulog({ message: `dispatchInstance for uid not available`, uid }, true)
            return this
        }

        /**
         * @Dispatch
         * master listener, sends all event callbacks to `batchReady`
         * @param {*} uid
         * @param {*} cb
         */
        Dispatch(uid, cb = null) {
            if (this.dispatchInstance[uid]) return this
            const self = this
            const D = function(uid, cb) {
                this.uid = uid
                this.data = null

                this._event_cb = null

                this.watch = (event) => {
                    this._event_cb = event
                }

                this.watch((data, id) => {
                    cb(data, id)
                })

                this.next = (data) => {
                    if ((data || {}).type !== 'cb') {
                        this.data = data
                    }

                    /**
                     * @next
                     * acts as a reverse callback, it sends back the `cb` from `batchReady`
                     */
                    if ((data || {}).type === 'cb') {
                        if (typeof data.cb === 'function') {
                            // when calling next before batchReady is initiated
                            // collect cb from .next
                            if (!self.cbQueue[this.uid]) self.cbQueue[this.uid] = data.cb

                            if (this.data) {
                                data.cb(this.data, this.uid)
                                return
                            }
                        }
                        return
                    }

                    if (typeof this._event_cb === 'function') {
                        if (this.data) {
                            // this._event_cb(this.data, this.uid)

                            /// when calling next after `batchReady` was initiated
                            if (typeof self.cbQueue[this.uid] === 'function') {
                                self.cbQueue[this.uid](this.data, this.uid)
                            }
                        } else {
                            notify.ulog('no callback data')
                        }
                    }
                }
            }

            if (!this.dispatchInstance[uid] && typeof cb === 'function') this.dispatchInstance[uid] = new D(uid, cb)
            return this
        }

        del(uid) {
            delete this.cbQueue[uid]
            delete this.dispatchInstance[uid]

            if (!this.cbQueue[uid] && !this.dispatchInstance[uid]) {
                if (this.debug) notify.ulog(`cbQueue and dispatchInstance for uid ${uid} deleted`)
            }

            return this
        }

        /**
         * @batchReady
         * wait for callbacks forwarded from Dispatch and returned in callback of this method
         * - Dispatch must be set initially before you call `batchReady`
         * @param {*} id # required
         * @param {*} cb #required
         */
        batchReady(id, cb) {
            const isFN = typeof cb === 'function'
            if (!isFN) {
                notify.ulog(`[batchReady] cb must be set`, true)
                return this
            }
            if (!this.dispatchInstance[id]) {
                // this means batchReady was executed prior to `Dispatch`, because it has forward with next
                // it will get executed anyway
                this.Dispatch(id, (d) => {})
            }
            if (this.dispatchInstance[id]) this.dispatchInstance[id].next({ type: 'cb', cb })
            return this
        }
    }
    return EventDispatcher
}
