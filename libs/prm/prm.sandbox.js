/**
 * @PRMsandbox
 * handle throw errors with soft exception
 */
module.exports = (PRM, notify) => {
    class PRMsandbox extends PRM {
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
    }
    return PRMsandbox
}
