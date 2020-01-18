
/**
 * @XPipe
 *  extention of `XPromise`, to allow piping/ compumed jobs as streams, in async environment
 */
module.exports = (Xpromise, notify) => {
    if (!notify) notify = require('../notifications')()
    const { isArray, isEmpty, isObject, isFunction, reduce, cloneDeep, sum } = require('lodash')

    if (!Xpromise) Xpromise = function() { } // allow use if xpromise not set

    class XPipe extends Xpromise {
        constructor(promiseUID, opts, debug) {
            super(promiseUID, opts, debug)
            // this.pipeWhenReady = opts.pipeWhenReady
            // this.allowPipe // when from Xpromise, Xpipe will be set after `asPromise` or  `onReady` call is resolved
            this.pipeCBList = {}
            this._pipeList = {}
            this.pipeIndex = {} // current job pipe index status
            this.initPipeSet = {} // initPipe set for each job
            this.pendingPipes = {} // pipes that are delayed and waiting to be resolved on next issue
            this._startPipeCBs = {} // called initially via initPipe
            this.pipeUIDindex = {}
            this.pipePassFail = {} // alter resolution of each pipe, to either resolve or reject
            this.pipeMarkDel = {/** uid:boolean */}// add mark to delete pipe
        }

        /**
         * @initPipe
         * you can use it to start the pipe, optionally, or just start with the `pipe` itself
         * Only use `initPipe` when not working with Xpromise
         * `uid` provide uid to track your pipe
         * `firstPipedData`: initial data to pipe
         * `resolveReject:boolean`: this pipe should resolve or reject, default is true
         */
        initPipe(uid, firstPipedData = null, resolveReject = true) {
            this.testUID(uid)

            if (this.pipeMarkDel[uid] === 'used') {
                if (this.debug) notify.ulog(`this uid was already terminated, and cannot be used again`)
                return this
            }

            // set restriction only if `allowPipe` is not set to wait for callback to continue
            if (!this.allowPipe) {
                if (this.pipeList[uid]) {
                    if (this.debug) notify.ulog(`[initPipe] cannot init, this pipe already active, or you have to set opts.allowPipe=true`)
                    // already active pie
                    return this
                }
            }

            this.lastUID = uid
            // make sure this can only be called once per job
            if (this.allowPipe) {
                if (!this.initPipeSet[uid]) {
                    this.initPipeSet[uid] = {
                        data: firstPipedData,
                        resolution: resolveReject || false
                    }
                }
            } else {
                if (!this.initPipeSet[uid] && !this.pipeList[uid]) {
                    this.initPipeSet[uid] = {
                        data: firstPipedData,
                        resolution: resolveReject || false
                    }
                }
            }

            if (typeof this._startPipeCBs[uid] === 'function') {
                this._startPipeCBs[uid](uid, firstPipedData, resolveReject)
            }

            return this
        }

        /**
         * @uniqPipeIndexID
         * pipes are async, not always do we have matching `uids` passed within callback
         * to avoid miss-piped uids, store them by index of called pipe
         */
        uniqPipeIndexID(uid) {
            if (!this.pipeUIDindex[`${uid}-${this.pipeIndex[uid]}`]) {
                this.pipeUIDindex[`${uid}-${this.pipeIndex[uid]}`] = uid
                return uid
            } else {
                return this.pipeUIDindex[`${uid}-${this.pipeIndex[uid]}`]
            }
        }
        /**
         * @beginPipe
         * start pipe from a callback, when data arrived!
         */
        beginPipe(uid, cb) {
            this.lastUID = uid
            this.testUID(uid)

            if (!this._startPipeCBs[uid]) {
                this._startPipeCBs[uid] = cb
            } else if (typeof this._startPipeCBs[uid] === 'function') {
                // this._startPipeCBs[uid]()
            }
        }

        fail(uid) {
            uid = this._getLastRef(uid)
            var index = (this.pipeIndex[uid] !== undefined ? this.pipeIndex[uid] : 0)
            this.pipePassFail[`${uid}-${index}`] = false

            return this
        }

        pass(uid) {
            uid = this._getLastRef(uid)
            var index = (this.pipeIndex[uid] !== undefined ? this.pipeIndex[uid] : 0)
            this.pipePassFail[`${uid}-${index}`] = true

            return this
        }

        /**
         * @passFailExists
         * check for call to pass() or fail, if doesnt exist return null
         */
        passFailExists(uid, index) {
            if (this.pipePassFail[`${uid}-${index}`] === true) {
                return true
            }
            if (this.pipePassFail[`${uid}-${index}`] === false) {
                return false
            }

            return null
        }
        /**
         * @pipe
         * `cb` if privided you can pipe each new data thru callback, you need to return it
         * `uid` will check for last used uid if not provided
         * `firstPipedData` only provide this initialy at first pipe sequence of this job id
         * `resolveReject` is this a resolve or reject
         * `endPipe` TODO add option for enc pipe sequence
         * */
        pipe(cb, uid, firstPipedData = null, resolution = null, endPipe) {
            uid = this._getLastRef(uid)

            if (this.pipeIndex[uid] === undefined) this.pipeIndex[uid] = 0
            uid = this.uniqPipeIndexID(uid)

            if (!this.setPipePromise(uid)) {
                const errMessage = `[pipe] invalid pipe id ${uid}`
                return this.pipeErrHandler(errMessage, cb)
            }

            const pipeCallStart = (uid, firstPipedData, resolution) => {
                // update vars if `initPipe` was called initially
                if (this.initPipeSet[uid]) {
                    firstPipedData = firstPipedData === null ? this.initPipeSet[uid].data : firstPipedData
                    resolution = resolution === null ? this.initPipeSet[uid].resolution : resolution
                    delete this.initPipeSet[uid] // delete after it was set
                }
                // this will be only called at index 0
                this.startPipingSequence(uid, true, resolution, firstPipedData)
            }

            const pipeCallEnd = (cb, uid) => {
                this.pipeIndex[uid]++ // increment each pipe count
                // NOTE when pass() or fail() was set we decide resolution of each pipe, otherwise continue as usual
                var passFailResolution = this.passFailExists(uid, this.pipeIndex[uid] - 1)
                var nextPipe = this.getPipe(uid)
                if (!nextPipe) {
                    return this.pipeErrHandler('not a pipe', cb)
                }

                this.waitingJob(uid)

                var pipeID = `${uid}-${this.jobIndex(uid)}`

                if (isFunction(cb)) {
                    nextPipe.then(async(v) => {
                        if (this.pipeMarkDel[uid] === 'used') {
                            return
                        }
                        try {
                            var resol = passFailResolution !== null ? passFailResolution : true
                            var d
                            if (resol) d = await cb(v)
                            else d = await cb(null, v)

                            // NOTE will call only when `end()` was initiated
                            this.endPipe(uid)
                            this.callPipeResolution(pipeID, resol, d, uid)
                        } catch (err) {
                            notify.ulog({ error: err, uid, message: 'tip: make sure you handle reject resolution' }, true)
                            // return rejection if callback error
                            this.callPipeResolution(pipeID, false, { error: err }, uid)
                        }
                    }, async(err) => {
                        if (this.pipeMarkDel[uid] === 'used') {
                            return
                        }
                        try {
                            var resol = passFailResolution !== null ? passFailResolution : false
                            var d
                            if (resol) d = await cb(err)
                            else d = await cb(null, err)

                            // NOTE will call only when `end()` was initiated
                            this.endPipe(uid)

                            this.callPipeResolution(pipeID, resol, d, uid)
                        } catch (err) {
                            notify.ulog({ error: err, uid, message: 'tip: make sure you handle reject resolution' }, true)
                            // return rejection if callback error
                            this.callPipeResolution(pipeID, false, { error: err }, uid)
                        }
                    })
                    return this
                } else {
                    return nextPipe.then(v => {
                        if (this.pipeMarkDel[uid] === 'used') {
                            return
                        }
                        try {
                            // NOTE will call only when `end()` was initiated
                            this.endPipe(uid)

                            var resol = passFailResolution !== null ? passFailResolution : true

                            this.callPipeResolution(pipeID, resol, v, uid)
                            if (resol) return v
                            else return Promise.reject(v)
                        } catch (err) {
                            notify.ulog({ error: err, uid, message: 'tip: make sure you handle reject resolution' }, true)
                        }
                    }, err => {
                        if (this.pipeMarkDel[uid] === 'used') {
                            return
                        }
                        try {
                            var resol = passFailResolution !== null ? passFailResolution : false
                            this.callPipeResolution(pipeID, resol, err, uid)
                            // NOTE will call only when `end()` was initiated
                            this.endPipe(uid)
                            if (resol) return err
                            else return Promise.reject(err)
                        } catch (err) {
                            notify.ulog({ error: err, uid, message: 'tip: make sure you handle reject resolution' }, true)
                        }
                    })
                }
            }

            // when we start the pipe but our data has not arrived, we wait for callback, and continue
            if (this.allowPipe === true && (firstPipedData === null && !this.initPipeSet[uid])) {
                this.beginPipe(uid, (_uid_, _readyData, _resolution) => {
                    pipeCallStart(uid, _readyData, _resolution)
                    delete this._startPipeCBs[_uid_] // delete callback after called once
                })
                // if (this.debug) notify.ulog(`allowPipe=ture is set, waiting for initPipe on ready`)
                return pipeCallEnd(cb, uid)
            } else {
                pipeCallStart(uid, firstPipedData, firstPipedData, resolution)
                return pipeCallEnd(cb, uid)
            }
        }

        /**
         * @end
         * end XPipe
         */
        end(uid) {
            uid = this._getLastRef(uid)
            this.pipe(d => {
                this.pipeMarkDel[uid] = 'set'
                return null
            }, uid)
            return this
        }

        /**
         * @endPipe
         * initiated from `pipe` method when `end()` was called to `set` pipes
         * @param {*} uid
         */
        endPipe(uid) {
            if (this.pipeMarkDel[uid] === 'set') {
                //  const before = this.testDeleted()
                this.pipeCBList = reduce(this.pipeCBList, (n, el, k) => {
                    if (k.indexOf(uid) === -1) n[k] = el
                    return n
                }, {})

                this.pipePassFail = reduce(this.pipePassFail, (n, el, k) => {
                    if (k.indexOf(uid) === -1) n[k] = el
                    return n
                }, {})

                this.pipeUIDindex = reduce(this.pipeUIDindex, (n, el, k) => {
                    if (k.indexOf(uid) === -1) n[k] = el
                    return n
                }, {})

                this._pipeList = reduce(this._pipeList, (n, el, k) => {
                    if (k.indexOf(uid) === -1) n[k] = el
                    return n
                }, {})

                delete this.pipeIndex[uid]
                delete this._startPipeCBs[uid]
                this.pipeMarkDel[uid] = 'used'

                const totalJobs = Object.keys(this._pipeList).length
                if (this.testDeleted() === totalJobs) {
                    if (this.debug) notify.ulog(`[endPipe] all pipe reference for job #${uid} deleted`)
                }
            }
        }

        testDeleted() {
            const pipeList = Object.keys(cloneDeep(this.pipeList)).length || 0
            const pipeCBList = Object.keys(cloneDeep(this.pipeCBList)).length || 0
            const pipePassFail = Object.keys(cloneDeep(this.pipePassFail)).length || 0
            const pipeUIDindex = Object.keys(cloneDeep(this.pipeUIDindex)).length || 0
            const pipeIndex = Object.keys(cloneDeep(this.pipeIndex)).length || 0
            const _startPipeCBs = Object.keys(cloneDeep(this._startPipeCBs)).length || 0
            const pipeMarkDel = Object.keys(cloneDeep(this.pipeMarkDel)).length || 0
            const allIndexesArr = [].concat(pipeCBList, pipePassFail, pipeUIDindex, pipeIndex, _startPipeCBs, pipeMarkDel, pipeList)
            const totalIndexes = sum(allIndexesArr)
            if (totalIndexes === 0) return 0
            return Math.round((totalIndexes / 6) / (pipeList || 1))
        }

        get pipeList() {
            return this._pipeList
        }

        set pipeList(v) {
            if (isEmpty(v)) {
                if (this.debug) notify.ulog(`[pipeList] cannot be set as empty`, true)
                return
            }
            if (isArray(v)) {
                if (this.debug) notify.ulog(`[pipeList] cannot be an array`, true)
                return
            }
            if (!isObject(v)) {
                if (this.debug) notify.ulog(`[pipeList] must be an object`, true)
                return
            }

            // all must be a promise
            for (var k in v) {
                var jobPipelist = v[k]
                if (isEmpty(jobPipelist)) {
                    notify.ulog(`[pipeList] jobPipelist empty for ${k}`, true)
                    throw ('error')
                }
                for (var kk in jobPipelist) {
                    if (!this.isPromise(jobPipelist[kk])) {
                        notify.ulog(`[pipeList] each pipe in jobList must be a promise, but id ${k} is not`, true)
                        throw ('error')
                    }
                }
            }

            this._pipeList = v
        }

        /**
         *
        */
        pipeActive(uid) {
            if (this.pipeList[uid]) {
                if (Object.keys(this.pipeList[uid]).length) {
                    return true
                }
            }
            return false
        }

        /**
         * @newPipePromise
         * set new pipe promise for each pipe that is called and wait for callback
         */
        newPipePromise(id) {
            return new Promise((resolve, reject) => {
                if (!this.pipeCBList[id]) {
                    this.pipeCBList[id] = (name, value, data) => {
                        if (value === true) {
                            return resolve(data)
                        }
                        if (value === false) {
                            return reject(data)
                        }
                    }
                    return
                }
                resolve(true)
            })
        }

        /**
         * @setPipePromise
         * add promise to each pipe and update `pipeList` object setter
         */
        setPipePromise(id) {
            var pipeSet = null

            if (!this.pipeList[id]) {
                this.pipeList[id] = {}
                const pipeID = `${id}-${this.jobIndex(id)}`
                this.pipeList[id][this.jobIndex(id)] = this.newPipePromise(pipeID)
                pipeSet = true
            } else {
                const pipeID = `${id}-${this.jobIndex(id)}`
                if (!this.pipeList[id][this.jobIndex(id)]) {
                    this.pipeList[id][this.jobIndex(id)] = this.newPipePromise(pipeID)
                    pipeSet = true
                }
            }
            if (pipeSet) {
                this.pipeList = Object.assign({}, this.pipeList)
            }

            // in case it exists update state
            if (!pipeSet) {
                pipeSet = this.pipeList[id][this.jobIndex(id)] !== undefined
            }
            return pipeSet
        }

        /**
         * @waitingJob
         *  check for delayed jobs and resolve them then delete pendingPipes[index]
        */
        waitingJob(uid) {
            var prevJob = this.jobIndex(uid) - 1
            var prevPipeID = `${uid}-${prevJob}`
            var waitingJob = this.pendingPipes[prevPipeID]
            if (waitingJob && typeof this.pipeCBList[prevPipeID] === 'function') {
                this.pipeCBList[prevPipeID](prevPipeID, waitingJob.resolution, waitingJob.data)
                delete this.pendingPipes[prevPipeID]
            }
        }

        callPipeResolution(pipeID, resolution, data, jobId) {
            if (typeof this.pipeCBList[pipeID] === 'function') {
                this.pipeCBList[pipeID](pipeID, resolution, data)
            } else {
                // when we call for pipe that doesnt yet exist, maybe its delayed
                if (jobId) {
                    if (!this.setPipePromise(jobId)) {
                        if (this.debug) notify.ulog(`[callPipeResolution] pipeID ${pipeID} not found`, true)
                        return
                    }
                    if (!this.pendingPipes[pipeID]) this.pendingPipes[pipeID] = {}
                    this.pendingPipes[pipeID].resolution = resolution
                    this.pendingPipes[pipeID].data = data
                    this.pendingPipes[pipeID].uid = jobId
                }
            }
        }
        /**
         * @startPipingSequence
         * the first pipe starts the pipe chain sequence, starts from index 0
         */
        startPipingSequence(id, pipeAssigned, trueFalse, pipedData) {
            if (this.allowPipe && pipeAssigned) {
                const pipeID = `${id}-${0}`
                this.callPipeResolution(pipeID, trueFalse, pipedData)
            }
            if (this.jobIndex(id) === 0 && pipeAssigned && !this.allowPipe) {
                const pipeID = `${id}-${this.jobIndex(id)}`
                this.callPipeResolution(pipeID, trueFalse, pipedData)
            } else {
                // startPipingSequence already set
            }
            return this
        }

        jobIndex(uid) {
            return this.pipeIndex[uid]
        }

        pipeErrHandler(errMessage, cb) {
            if (isFunction(cb)) {
                if (this.debug) notify.ulog(errMessage, true)
                return this
            } else {
                return Promise.reject(errMessage).catch(err => {
                    notify.ulog(errMessage, true)
                })
            }
        }

        pipeExists(uid) {
            if (this.pipeList[uid]) return true
            return false
        }
        /**
         * @getPipe
         * get pipe by index, `this.ps[uid].pipes[index]`
         */
        getPipe(uid) {
            // first pipe should always be zero, index is incremented before `getPipe` is called
            const index = this.jobIndex(uid) === 0 ? this.jobIndex(uid) : this.jobIndex(uid) - 1
            var pipe = this.pipeList[uid][index]
            if (this.isPromise(pipe)) return pipe
            else {
                if (this.debug) notify.ulog(`[getPipe] pipe for index ${index} not available`, true)
                return false
            }
        }
    }
    return XPipe
}
