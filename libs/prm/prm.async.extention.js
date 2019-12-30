
/**
 * @PRMasync
 * XPromise and XPipe are a feature of another plugin by EagleX, you can read about it at
 * `https://xpromise.eaglex.net` With the help of pipes we can cleanly track each update.
 * XPromise pipe handles data return as promise, by creating next promise defer to wait for next pipe call
 * Extended PRM functionality allow pipe method to chain the next update via pipe. Besicly
 * you make an async change to your data and it will be piped down as promise to the next pipe when resolved, and so on..
 * when `opts.asAsync=true` is set you can also override pipe=false, by setting to false and will not be piped for that method, per below
 *
 * NOTE pipe feature is not set for `getSet()` because of prototype set and get updates, you can only use it within a pipe, example pipe(()=>{ prm.getSet(uid) })
*/
module.exports = (PRM, notify) => {
    if (!notify) notify = require('../notifications')()
    // const { isString, uniq, reduce, indexOf } = require('lodash')
    class PRMasync extends PRM {
        constructor(debug, opts) {
            super(debug, opts)
            this._pipeDelay = 100 // due to computation and callbacks, need an unpresented delay
        }

        // getSet(uid, _self, pipe = true) {
        //     if (!this.asAsync) return super.getSet(uid, _self)
        //     if (!pipe) return super.getSet(uid, _self)

        //     if (!uid) uid = this.lastUID
        //     else this.lastUID = uid
        //     this.valUID(uid)

        //     this.xpromise.initPipe(uid, true) // only called initially if never set
        //         .pipe((d) => {
        //             return super.getSet(uid) // no self when piping
        //         }, uid)
        //     return this
        // }

        filter(cb, uid, pipe = true) {
            if (!this.asAsync) return super.filter(cb, uid)
            if (!pipe) return super.filter(cb, uid)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid

            this.valUID(uid)
            this.xpromise.initPipe(uid, true) // only called initially if never set
                .pipe((d) => {
                    super.filter(cb, uid)
                }, uid)
            return this
        }
        markDone(uid, pipe = true) {
            if (!this.asAsync) return super.markDone(uid)
            if (!pipe) return super.markDone(uid)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)
            this.xpromise.initPipe(uid, true) // only called initially if never set
                .pipe((d) => {
                    super.markDone(uid)
                }, uid)
            return this
        }

        from(RI) {
            if (this.asAsync) {
                if (this.debug) notify.ulog(`[from] [notice] no support for from() with asAsync option, nothig done`)
                return this
            } else return super.from(RI)
        }

        of(UID, pipe = true) {
            if (!this.asAsync) return super.of(UID)
            if (!pipe) return super.of(UID)

            this.xpromise.initPipe(UID, true) // only called initially if never set
                .pipe((d) => {
                    super.of(UID)
                }, UID)

            return this
        }

        compute(cb, method = 'all', uid, pipe = true) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            if (!this.asAsync) return super.computeB(cb, method, uid)
            if (!pipe) return super.computeB(cb, method, uid)

            this.valUID(uid)

            setTimeout(() => {
                this.xpromise.initPipe(uid, true) // only called initially if never set
                    .pipe(async(d) => {
                        await super.computeA(cb, method, uid)
                    }, uid)
            }, this._pipeDelay)

            return this
        }
        resolution(externalData, uid, dataRef, doDelete = true, pipe = true) {
            if (!this.asAsync) return super.resolution(externalData, uid, dataRef, doDelete)
            if (!pipe) return super.resolution(externalData, uid, dataRef, doDelete, pipe)
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)
            setTimeout(() => {
                this.xpromise.initPipe(uid, true) // only called initially if never set
                    .pipe(async(d) => {
                        var extData = await (externalData || null)
                        const dd = super.resolution(extData, uid, dataRef, doDelete)
                        return dd
                    }, uid)
            }, this._pipeDelay)
            return this
        }

        delSet(uid, force = false, pipe = true) {
            if (!this.asAsync) return super.delSet(uid, force)
            if (!pipe) return super.delSet(uid, force)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)
            setTimeout(() => {
                this.xpromise.initPipe(uid, true) // only called initially if never set
                    .pipe((d) => {
                        super.delSet(uid, force)
                    }, uid)
            }, this._pipeDelay)

            return this
        }
        set(data, uid, pipe = true) {
            if (!this.asAsync) return super.set(data, uid)
            if (!pipe) return super.set(data, uid)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            this.xpromise.initPipe(uid, true) // only called initially if never set
                .pipe(async(d) => {
                    var dd = await data
                    super.set(dd, uid)
                    return this.d
                }, uid)

            return this
        }

        updateSet(newData, uid, pipe = true) {
            if (!this.asAsync) return super.updateSet(newData, uid)
            if (!pipe) return super.updateSet(newData, uid)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            this.xpromise.initPipe(uid, true) // only called initially if never set
                .pipe(async(d) => {
                    var dd = await newData
                    super.updateSet(dd, uid)
                    return this.d
                }, uid)

            return this
        }

        updateDataSet(uid, ri, dataSet, type, pipe = true) {
            if (!this.asAsync) return super.updateSet(uid, ri, dataSet, type)
            if (!pipe) return super.updateSet(uid, ri, dataSet, type)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            this.xpromise.initPipe(uid, true) // only called initially if never set
                .pipe(async(d) => {
                    var dd = await dataSet
                    super.updateDataSet(uid, ri, dd, type)
                    return this.d
                }, uid)
            return this
        }
    }

    return PRMasync
}
