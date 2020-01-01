/**
 * @SimpleDispatch
 * simple next dispatch idea
 */
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()

    class SimpleDispatch {
        constructor() {
            this.dispatchListeners = {/** uid:cb */}
        }
        get dispatch() {
            const self = this
            return function(uid, cb) {
                this.data = null
                this._event_cb = null
                this.watch = (event) => {
                    // if (!self.dispatchListeners[uid]) self.dispatchListeners[uid] = {}
                    // const data = self.dispatchListeners[uid].data || this.data

                    // if (typeof self.dispatchListeners[uid].cb === 'function') {
                    //     self.dispatchListeners[uid].cb(data)
                    // } else {
                    //     self.dispatchListeners[uid].cb = cb
                    //     self.dispatchListeners[uid].cb(data)
                    // }
                    this._event_cb = event
                }

                this.watch(event => {
                    cb(event, uid)
                })

                this.next = (data) => {
                    if (!self.dispatchListeners[uid]) self.dispatchListeners[uid] = {}
                    this.data = self.dispatchListeners[uid].data = data

                    if (typeof this._event_cb === 'function') {
                        if (this.data) {
                            this._event_cb(this.data)
                        } else {
                            notify.ulog('no callback data')
                        }
                    }
                }
            }
        }
    }
    return SimpleDispatch
}
