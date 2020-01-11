/**
 * @SimpleDispatch
 * simple next dispatch idea
 */
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()

    class SimpleDispatch {
        constructor() {
        }
        get dispatch() {
            return function(uid, cb) {
                // TODO add QUE data for lazy callback
                this.data = null
                this._event_cb = null
                this.watch = (event) => {
                    this._event_cb = event
                }

                this.watch(event => {
                    cb(event, uid)
                })

                this.next = (data) => {
                    this.data = data
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
