
/**
     * @PrmProto prototype
     * assing prototype to each job set to make sure `_uid` and `_ri` cannot be chnaged
*/
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, reduce, isObject, isArray } = require('lodash')

    class PrmProto {
        constructor(debug) {
            this.debug = debug
        }

        get props() {
            return ['dataSet', '_uid', '_ri', '_timestamp', 'complete']
        }

        testdataSet(data) {
            if (isEmpty(data)) return false
            if (isArray(data)) return false

            var ignoreCompete = this.props.length !== Object.keys(data).length
            return this.props.filter(z => {
                if (z === 'complete' && ignoreCompete) return false// ignore this one
                if (data[z] !== undefined) return true
            }).filter(z => !!z).length === Object.keys(data).length
        }

        assign(dataSetItem, conf = { enumerable: true, writable: false, configurable: false }, strip = null) {
            if (!isObject(dataSetItem) ||
                isArray(dataSetItem) ||
                isEmpty(dataSetItem) ||
                !Object.keys((dataSetItem || {})).length) {
                if (this.debug) notify.ulog(`[assign] assigning new dataSetItem you need to provide an object with all required dataArchAttrs/props, nothing done!`, true)

                return null
            }

            if (!this.testdataSet(dataSetItem)) {
                if (this.debug) notify.ulog(`[assign] dataSetItem failed testdataSet validation`, true)
                return null
            }

            var createMod = (_strip) => {
                return Object.keys(dataSetItem).reduce((all, prop) => {
                    var p = dataSetItem[prop]
                    var val = (p !== undefined && p !== null) ? p : null
                    all[prop] = {
                        value: val,
                        writable: true,
                        enumerable: true,
                        configurable: false
                    }

                    // manual confing override
                    if ((prop === '_uid' || prop === '_ri') && !_strip) {
                        if (!isEmpty(conf) && isObject(conf)) {
                            reduce(conf, (n, el, k) => {
                                all[prop][k] = el
                            }, {})
                        } else {
                            all[prop].writable = false
                            all[prop].enumerable = false
                            all[prop].configurable = false
                        }

                        if (_strip) {
                            // allow all changes and mods
                            all[prop].writable = true
                            all[prop].enumerable = true
                            all[prop].configurable = true
                        }
                    }

                    return all
                }, {})
            }

            /// strip prototype and return only object
            // if (strip === true) {
            //     var strippedModel = {}
            //     Object.keys(cloneDeep(dataSetItem)).reduce((n, kVal) => {
            //         Object.defineProperty(strippedModel, kVal, {
            //             value: cloneDeep(dataSetItem[kVal]),
            //             writable: true,
            //             configurable: true,
            //             enumerable: true
            //         })
            //     }, {})
            //     return strippedModel
            // }

            return Object.create(PrmProto.prototype, createMod(strip))
        }
    }

    return PrmProto
}
