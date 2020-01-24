/**
 * @PRMsandbox
 * handle throw errors with soft exception
 */
module.exports = (PRM, notify) => {
    return class PRMsandbox extends PRM {
        constructor(debug, opts) {
            super(debug, opts)
            this.sandbox = opts.sandbox || null
        }

        resolution(...args) {
            if (this.sandbox) {
                try {
                    return super.resolution(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.resolution(...args)
        }

        compute(...args) {
            if (this.sandbox) {
                try {
                    return super.compute(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.compute(...args)
        }

        updateSet(...args) {
            if (this.sandbox) {
                try {
                    return super.updateSet(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.updateSet(...args)
        }

        updateJob(...args) {
            if (this.sandbox) {
                try {
                    return super.updateJob(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.updateJob(...args)
        }

        get(...args) {
            if (this.sandbox) {
                try {
                    return super.get(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.get(...args)
        }

        set(...args) {
            if (this.sandbox) {
                try {
                    return super.set(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.set(...args)
        }

        batchReady(...args) {
            if (this.sandbox) {
                try {
                    return super.batchReady(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.batchReady(...args)
        }

        filter(...args) {
            if (this.sandbox) {
                try {
                    return super.filter(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.filter(...args)
        }

        pipe(...args) {
            if (this.sandbox) {
                try {
                    return super.pipe(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.pipe(...args)
        }

        onSet(...args) {
            if (this.sandbox) {
                try {
                    return super.onSet(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.onSet(...args)
        }

        async(...args) {
            if (this.sandbox) {
                try {
                    return super.async(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.async(...args)
        }

        complete(...args) {
            if (this.sandbox) {
                try {
                    return super.complete(...args)
                } catch (err) {
                    notify.ulog({ err }, true)
                    return this
                }
            } else return super.complete(...args)
        }
    }
}
