
/**
 * @PRMasync
 * XPromise and XPipe are a feature of another plugin by EagleX, you can read about it at
 * `https://xpromise.eaglex.net` With the help of pipes we can cleanly track each update.
 * XPromise pipe handles data return as promise, by creating next promise defer to wait for next pipe call
 * Extended PRM functionality allow pipe method to chain the next update via pipe. Besicly
 * you make an async change to your data and it will be piped down as promise to the next pipe when resolved, and so on..
 * when `opts.asAsync=true` is set you can also override pipe=false, by setting to false and will not be piped for that method, per below
 *
 * NOTE pipe feature is not set for `get()` because of prototype set and get updates, you can only use it within a pipe, example pipe(()=>{ prm.get(uid) })
*/
module.exports = (PRM, notify) => {
    if (!notify) notify = require('../notifications')()
    const { cloneDeep, uniq } = require('lodash')

    return class PRMasync extends PRM {
        constructor(debug, opts) {
            super(debug, opts)
            this._pipeDelay = 100 // due to computation and callbacks, need an unpresented delay
            this.async_uids = {/** uid:typeofsomething */}
        }

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
            if (!UID) UID = this.lastUID
            else this.lastUID = UID
            if (!this.asAsync) return super.of(UID)
            if (!pipe) return super.of(UID)

            this.xpromise.initPipe(UID, true) // only called initially if never set
                .pipe((d) => {
                    super.of(UID)
                }, UID)

            return this
        }

        /**
         * @async
         * instead of using pipe, but similarly to pipe, wait for promise to resolve with await
         * example: await async(..)  then you can continue
         * - NOTE: each async(..) method call makes next `.pipe(..)` call return true, so do now expect any othere data, it confirms that the data has been updated or is already available to use.
         *
         * `id` optional
         */
        async(uid) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            if (!this.asAsync) return Promise.resolve(true)
            return this.pipe(null, uid)
        }

        //

        compute(cb, method = 'all', uid, pipe = true) {
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            if (!this.asAsync) return super.computeB(cb, method, uid)
            if (!pipe) return super.computeB(cb, method, uid)

            this.valUID(uid)
            this.pipe(async(d) => {
                await super.computeA(cb, method, uid)
            }, uid)

            return this
        }

        complete(uid) {
            if (!this.asAsync) return super.complete(uid)
            else {
                if (!uid) uid = this.lastUID
                else this.lastUID = uid

                this.pipe(async(d) => {
                    super.complete(uid)
                }, uid)
            }
            return this
        }

        resolution(uid, externalData = null, dataRef, doDelete = true, pipe = true) {
            if (!this.asAsync) return super.resolution(uid, externalData, dataRef, doDelete)
            if (!pipe) return super.resolution(uid, externalData, dataRef, doDelete, pipe)
            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            this.pipe(async(d) => {
                var extData = await (externalData || null)
                const dd = super.resolution(uid, extData, dataRef, doDelete)
                this.resData = dd
                return dd
            }, uid)
            return this
        }

        delSet(uid, force = false, pipe = true) {
            if (!this.asAsync) return super.delSet(uid, force)
            if (!pipe) return super.delSet(uid, force)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            this.pipe(async(d) => {
                super.delSet(uid, force)
            }, uid)
            return this
        }

        set(data, uid, pipe = true) {
            if (!this.asAsync) return super.set(data, uid)
            if (!pipe) return super.set(data, uid)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)
            this.jobUID_temp = uid

            this.pipe(async(d) => {
                var dd = await data
                super.set(dd, uid)
                return this.d
            }, uid)
            return this
        }
        /**
         * @onSet
         * wait for all/last jobs to get set and then use PRM tools `pipe` (which gets set after Xpipe does)
         * pipe all/last take `getUIDS` to loop thru all jobs
         *
         * `cb` called once all jobs are piped down
         * `type=all`: will wait until all initial job vals are set
         * `type=last`: will only wait for last set job and continue
         *
         */
        onSet(cb, type = 'all') {
            if (!this.asAsync) {
                if (this.debug) notify.ulog(`[onSet] works with opts.asAsync feature enabled, and together with pipe(..), nothig done`)
                return this
            }
            var uids = this.initialUIDS()

            if (type === 'last') {
                if (!this.lastUID) return this
                uids = [this.lastUID]
            }

            const allData = []
            uids.forEach((uid, inx) => {
                this.pipe((d, err) => {
                    allData.push({ uid: uid, data: cloneDeep(d), error: cloneDeep(err) })
                    if (inx === uids.length - 1) {
                        // last one piped
                        if (typeof cb === 'function') {
                            cb(allData)
                            return d || err // pass on original status
                        }
                    } else return d || err // pass on original status
                })
            })
            return this
        }

        updateJob(newData, uid, pipe = true) {
            if (!this.asAsync) return super.updateJob(newData, uid)
            if (!pipe) return super.updateJob(newData, uid)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)
            this.pipe(async(d) => {
                var dd = await newData
                super.updateJob(dd, uid)
                return this.d
            }, uid)

            return this
        }

        updateSet(uid, ri, dataSet, type, pipe = true) {
            if (!this.asAsync) return super.updateSet(uid, ri, dataSet, type)
            if (!pipe) return super.updateSet(uid, ri, dataSet, type)

            if (!uid) uid = this.lastUID
            else this.lastUID = uid
            this.valUID(uid)

            this.pipe(async(d) => {
                var dd = await dataSet
                super.updateSet(uid, ri, dd, type)
                return this.d
            }, uid)
            return this
        }
    }
}
