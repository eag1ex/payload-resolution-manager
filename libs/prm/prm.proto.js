
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
            this._modelBase = {}
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

        // NOTE doesnt work well with dynamic changes
        // createModel(prop, conf, strip = null) {
        //     const model = {}
        //     const self = this
        //     const _prop = prop

        //     var configure = (conf, prop, strip) => {
        //         // manual confing override
        //         var setting = {}
        //         if ((prop === '_uid' || prop === '_ri') && !strip) {
        //             if (!isEmpty(conf) && isObject(conf)) {
        //                 reduce(conf, (n, el, k) => {
        //                     setting[k] = el
        //                 }, {})
        //             } else {
        //                 setting.enumerable = false
        //                 setting.configurable = false
        //             }

        //             if (strip) {
        //                 // allow all changes and mods
        //                 setting.enumerable = true
        //                 setting.configurable = true
        //             }
        //         }

        //         delete setting['writable'] // in case
        //         return setting
        //     }

        //     try {
        //         (function(prop) {
        //             Object.defineProperty(model, prop, {
        //                 get: function() {
        //                     return self[`_modelBase`][_prop]
        //                 },
        //                 set: function(val) {
        //                     //  if (self[`_modelBase`][_prop] === undefined) self[`_modelBase`][_prop] = {}
        //                     self[`_modelBase`][_prop] = val

        //                     notify.ulog({ message: 'new value set', prop: _prop, value: val })
        //                     //  setTimeout(() => {
        //                     // var prps = cloneDeep(self[`_modelBase`])
        //                     // for (var k in prps) {
        //                     //     if (!prps.hasOwnProperty(k)) continue
        //                     //     var uid = k
        //                     //     if (typeof self.batchCBList[uid] === 'function') {
        //                     //         self.batchCBList[uid](val)
        //                     //     }
        //                     // }
        //                     // }, 100)
        //                 },
        //                 configure(conf, _prop, strip)
        //             })
        //         })(prop)
        //     } catch (err) {
        //         console.log('-- err cresting listener ', err)
        //     }
        //     return model // Object.assign(PrmProto.prototype, model)
        // }

        assign(dataSetItem, conf = null, strip = null, lock = null) {
            var defaults = { enumerable: true, writable: false, configurable: false }
            if (isEmpty(conf)) conf = defaults

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
                // var m = Object.keys(dataSetItem).reduce((model, prop) => {
                //     if (isEmpty(model)) model = this.createModel(prop, conf, _strip)
                //     model[prop] = dataSetItem[prop]
                //     return model
                // }, {})
                // return Object.assign(PrmProto.prototype, m)

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
                    var test = !lock ? (prop === '_uid' || prop === '_ri') : true
                    if (test && !_strip) {
                        if (!isEmpty(conf) && isObject(conf)) {
                            reduce(conf, (n, el, k) => {
                                all[prop][k] = el
                            }, {})
                        } else {
                            all[prop].writable = false
                            all[prop].enumerable = false
                            all[prop].configurable = false
                        }
                    }
                    if (_strip) {
                        // allow all changes and mods
                        all[prop].writable = true
                        all[prop].enumerable = true
                        all[prop].configurable = true
                    }

                    return all
                }, {})
            }

            return Object.create(PrmProto.prototype, createMod(strip))
        }
    }

    return PrmProto
}

// const prmMod = new PrmProto()
// var item = { dataSet: { name: 'alex', age: 50 }, _ri: 0, _uid: 'job1', _timestamp: new Date().getTime() }
// var m = prmMod.assign(item)
