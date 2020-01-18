
/**
 * @PrmBatchReady
 * exported method of batchReady to own class and extended to main PRM class
 */
module.exports = (notify, PRM) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, uniq, cloneDeep, reduce, indexOf, isArray, flatMap, times } = require('lodash')
    class PrmBatchReady extends PRM {
        constructor(debug, opts) {
            super(debug, opts)

            this.batchReady_set = {}// track all batchReady so we dont call same one by excident
        }

        /**
         * @batchReady
         * collect each completed job that belongs to a batch and return if all jobs are complete
         * after batch is returned only batch listed jobs are deleted from batchDataArch
         * `jobUIDS` specify jobUID's being worked on
         * `type` : can return as `flat` array or `grouped` object
         * `doneCB` : when set will will run setInterval to check when bach is ready then return callback
         */

        batchReady(jobUIDS = [], type = 'flat', doneCB = null) {
            if (!this.batch) return null
            if (!isArray(jobUIDS)) return null
            if (!jobUIDS.length) return null
            const uidRef = jobUIDS.toString().replace(/,/g, '--')

            if (this.batchReady_set[uidRef] === true) {
                if (this.debug) notify.ulog({ message: `[batchReady] already set to call this batch, call ignored`, jobUIDS })
                return null
            } else this.batchReady_set[uidRef] = true

            const _jobUIDS = uniq(jobUIDS)
            if (_jobUIDS.length !== jobUIDS.length) {
                jobUIDS = uniq(jobUIDS)
                notify.ulog(`[batchReady] you provided duplicate ids in your batch, please fix it, error has been corrected`, true)
            }

            var alreadyDone = {}
            if (!type) type = 'flat' // set default

            // must also be valid
            for (var i = 0; i < jobUIDS.length; i++) {
                this.valUID(jobUIDS[i])
            }

            const purgeBatchDataArch = () => {
                // purge
                for (var k in this.batchDataArch) {
                    if (indexOf(jobUIDS, k) !== -1 && this.batchDataArch[k]) {
                        delete this.batchDataArch[k]
                        // console.log(`purged batchDataArch for uid ${k}`)
                    }
                }
            }

            const performResolution = () => {
                var batchedJobs

                // check if batch is set first
                var batchSet = Object.keys(this.batchDataArch).filter(z => {
                    if (this.onlyCompleteJob) {
                        return indexOf(jobUIDS, z) !== -1 && !isEmpty(this.batchDataArch[z])
                    }
                    if (this.onlyCompleteSet) {
                        // at least we know that resolution did pass, and doesnt matter if empty or not
                        return indexOf(jobUIDS, z) !== -1 && this.batchDataArch[z] !== undefined
                    }

                    return indexOf(jobUIDS, z) !== -1 && !isEmpty(this.batchDataArch[z])
                }).length === jobUIDS.length

                if (!batchSet) return null

                if (type === 'flat') {
                    batchedJobs = reduce(cloneDeep(this.batchDataArch), (n, el, k) => {
                        if (indexOf(jobUIDS, k) !== -1) n = [].concat(el, n)
                        return n
                    }, []).filter(z => z !== undefined)

                    batchedJobs = flatMap(batchedJobs)
                }

                if (type === 'grouped') {
                    batchedJobs = reduce(cloneDeep(this.batchDataArch), (n, el, k) => {
                        if (indexOf(jobUIDS, k) !== -1) {
                            n[k] = [].concat(el, n[k])
                            n[k] = n[k].filter(z => z !== undefined)
                        }
                        return n
                    }, {})
                }

                return batchedJobs
            }

            const exitWithCB = () => {
                var r = performResolution()

                if (r === null) return
                // delete xpromise/pipe data for each each job, and stop pipe sequence
                times(jobUIDS.length, (inx) => {
                    this.endPipe(jobUIDS[inx])
                })

                doneCB(r)
                alreadyDone[uidRef] = true
                times(jobUIDS.length, (inx) => {
                    this.delSet(jobUIDS[inx], true)
                    // NOTE when job is forfilled only then set it!
                    if (this.strictMode) this.jobUID_history[jobUIDS[inx]] = true
                    this.eventDispatcher.del(jobUIDS[inx])
                })
                purgeBatchDataArch()
            }

            if (typeof doneCB === 'function') {
                if (this.onlyCompleteJob === true || this.onlyCompleteSet === true) {
                    var totals = []
                    times(jobUIDS.length, (inx) => {
                        const id = jobUIDS[inx]
                        this.eventDispatcher.batchReady(id, (d, uid) => {
                            // make sure ids match
                            if (indexOf(jobUIDS, uid) !== -1) {
                                totals.push(id)
                                totals = uniq(totals)
                            }

                            if (totals.length === jobUIDS.length) {
                                exitWithCB()
                            }
                        })
                    })
                }

                /**
                 * NOTE only one or the other should fire once
                 * `modelStateChange_cbs` is set from `prm.helpers` and extended from `this.PrmProto.modelStateChange` this option if only available if `onlyCompleteJob` if enabled!
                 */

                // NOTE @simpleDispatch
                //  `simpleDispatch` class to easly cascade thru events, then resolve when satisfied!

                var statusSet = []

                // FIXME  perhaps we should not
                // const smd = new this.simpleDispatch(uidRef, e => {
                //     statusSet.push(e.event)
                //     if (this.onlyCompleteJob) {
                //         const satisfied = uniq(statusSet).filter(z => {
                //             return z === 'resolutionINDEX' || z === 'modelStateChange'
                //         }).length

                //         //
                //         if (satisfied === 2) {
                //             if (this.debug) notify.ulog({ message: 'batchReady complete on lazy complete' })
                //             exitWithCB()
                //             return
                //         }
                //     }
                //     if (e.event === 'batchCBDone') {
                //         // if (this.debug) notify.ulog({ message: 'batchReady done' })
                //         exitWithCB()
                //     }
                // })
                /**
                 *   callback available when onlyCompleteJob is set
                 *   // lazy callback
                 * -----------------------------------
                 */

                // if (!alreadyDone[uidRef] && this.onlyCompleteJob === true) {
                //     var modelUIDS = []

                //     times(jobUIDS.length, inx => {
                //         const jobUID = jobUIDS[inx]

                //         if (!this.modelStateChange_cbs[jobUID]) {
                //             this.modelStateChange_cbs[jobUID] = (status) => {
                //                 const modelUID = status.uid
                //                 if (status.complete) {
                //                     modelUIDS.push(modelUID)
                //                     modelUIDS = uniq(modelUIDS)
                //                     // must match so we know the result is valid
                //                     if (modelUIDS.length === jobUIDS.length && !alreadyDone[uidRef]) {
                //                         smd.next({ event: 'modelStateChange', status: 'complete' })
                //                     }
                //                 }
                //             } // modelStateChange_cbs
                //         }

                //         if (!this.resolutionINDEX_cb[jobUID]) {
                //             this.resolutionINDEX_cb[jobUID] = (status) => {
                //                 smd.next({ event: 'resolutionINDEX', status: 'complete' })
                //             }// resolutionINDEX_cb
                //         }
                //     })
                // }

                /**
                 *
                 * called as backup and when not using `onlyCompleteJob` option
                 * -----------------------------------
                 */
                // if (!alreadyDone[uidRef]) {
                //     this.batchCBDone(jobUIDS, (pass) => {
                //         if (!pass) return
                //         if (!alreadyDone[uidRef]) {
                //             smd.next({ event: 'batchCBDone', status: 'complete' })
                //         }
                //     })
                // }

                return null
            } else {
                notify.ulog(`[batchReady] needs a callback to return final data!`, true)
            }
        }
    }
    return PrmBatchReady
}
