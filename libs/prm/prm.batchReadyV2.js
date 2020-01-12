
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    class BatchReadyV2 {
        constructor() {
            this.cbQueue = {}
            this.dispatchInstance = {}
        }

        dispatch(uid, cb = null) {
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
            return this.dispatchInstance[uid]
        }

        batchReady(id, cb) {
            // if (!this.cbQueue[id]) this.cbQueue[id] = cb
            if (this.dispatchInstance[id]) this.dispatchInstance[id].next({ type: 'cb', cb })
        }
    }
    return BatchReadyV2
}
