
/**
     * @PrmProto prototype
     * assing prototype to each job set to make sure `_uid` and `_ri` cannot be chnaged
*/
module.exports = (notify) => {
    if (!notify) notify = require('../notifications')()
    const { isEmpty, isNumber, isObject, isArray, omit, isString } = require('lodash')

    class PrmProto {
        constructor(debug) {
            this.debug = debug
            this._modelBase = {}
            this.modelBase = {} // set only once
            this.modelStateChange_CB = null
        }

        /**
         * @modelStateChange
         * needs to be initiated before `assign` is called
         * cb: cb(uid, PrmProto)
         */
        modelStateChange(cb) {
            this.modelStateChange_CB = cb
            return this
        }

        get props() {
            return ['dataSet', '_uid', '_ri', '_timestamp', 'complete', 'error']
        }

        testdataSet(data) {
            if (isEmpty(data)) return false
            if (isArray(data)) return false

            var attrsFiltered = this.props.filter(z => z !== 'error' && z !== 'complete')
            var dataCopy = omit(data, ['complete', 'error'])
            return attrsFiltered.length === Object.keys(dataCopy).length
        }

        /**
         * @resetModel
         * reset model for every assing
         */
        resetModel() {
            this._modelBase = {}
            this.modelBase = {} // set only once
        }

        // NOTE doesnt work well with dynamic changes
        createAndModel(prop, conf, strip = null) {
            if (!isEmpty(this.modelBase[prop])) return
            const self = this
            const _prop = prop
            var configure = ((conf, prop, strip) => {
                // manual confing override
                var setting = {
                    enumerable: true,
                    configurable: true
                }

                if ((prop === '_uid' || prop === '_ri') && !strip) {
                    if (!isEmpty(conf) && isObject(conf)) {
                        for (var k in conf) {
                            setting[k] = conf[k]
                        }
                    } else {
                        setting.enumerable = false
                        setting.configurable = false
                    }

                    if (strip) {
                        // allow all changes and mods
                        setting.enumerable = true
                        setting.configurable = true
                        // setting.writable = true
                    }
                }

                delete setting['writable'] // in case
                return setting
            })(conf, prop, strip)

            try {
                (function(prop) {
                    Object.defineProperty(self.modelBase, prop, {
                        get: function() {
                            return self[`_modelBase`][_prop]
                        },
                        set: function(val) {
                            if (self[`_modelBase`][_prop] === undefined) self[`_modelBase`][_prop] = null
                            //  self[`_modelBase`][_prop] = val
                            var updated = null

                            // NOTE `_uid` and `_ri` can only be set once!
                            if (prop === '_uid' || prop === '_ri') {
                                if (isEmpty(self[`_modelBase`][_prop]) &&
                                    !isNumber(self[`_modelBase`][_prop]) &&
                                    !isString(self[`_modelBase`][_prop])) {
                                    self[`_modelBase`][_prop] = val
                                    updated = true
                                } else {
                                    notify.ulog({ message: 'you cannot update _uid and _ri props, those are private' }, true)
                                }
                            } else {
                                self[`_modelBase`][_prop] = val
                                updated = true
                            }

                            if (updated) {
                                // if (self.debug) notify.ulog({ message: 'new value set', prop: _prop, value: val })
                                if (typeof self.modelStateChange_CB === 'function') {
                                    // NOTE only initiate callback when `dataSet` already exists
                                    if (self[`_modelBase`].dataSet !== undefined) {
                                        self.modelStateChange_CB(self[`_modelBase`]._uid, self[`_modelBase`])
                                    }
                                }
                            }
                        },
                        ...configure
                    })
                })(prop)
            } catch (err) {
                console.log('-- err cresting listener ', err)
            }
            return this.modelBase
        }

        /**
         * @reorderDataSets
         *  each time `createAndModel` is called, it will assing new data and on update callback
         * we want to make sure that `_uid` is assign first!
         */
        reorderDataSets(dataSets) {
            var modArr = []
            for (var prop in dataSets) {
                modArr.push({ prop, data: dataSets[prop] })
            }
            var reorderArr = []
            var temp
            for (var i = 0; i < modArr.length; i++) {
                if (modArr[i].prop === '_uid') temp = modArr[i]
                if (modArr[i].prop !== '_uid') reorderArr.push(modArr[i])
                // add uid at the end

                if (modArr.length - 1 === i) {
                    reorderArr.unshift(temp)
                }
            }
            return reorderArr
        }
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
            this.resetModel()
            // NOTE REQUIRE VALIDATION
            if (!this.testdataSet(dataSetItem)) {
                if (this.debug) notify.ulog(`[assign] dataSetItem failed testdataSet validation`, true)
                return null
            }

            var createMod = (_strip) => {
                var reorderArr = this.reorderDataSets(dataSetItem)
                for (var n = 0; n < reorderArr.length; n++) {
                    var item = reorderArr[n]
                    // NOTE will assing modelBase proto
                    this.createAndModel(item.prop, conf, _strip)[item.prop] = item.data
                }

                return this.modelBase

                // return Object.keys(dataSetItem).reduce((all, prop) => {
                //     var p = dataSetItem[prop]
                //     var val = (p !== undefined && p !== null) ? p : null
                //     all[prop] = {
                //         value: val,
                //         writable: true,
                //         enumerable: true,
                //         configurable: false
                //     }

                //     // manual confing override
                //     var test = !lock ? (prop === '_uid' || prop === '_ri') : true
                //     if (test && !_strip) {
                //         if (!isEmpty(conf) && isObject(conf)) {
                //             reduce(conf, (n, el, k) => {
                //                 all[prop][k] = el
                //             }, {})
                //         } else {
                //             all[prop].writable = false
                //             all[prop].enumerable = false
                //             all[prop].configurable = false
                //         }
                //     }
                //     if (_strip) {
                //         // allow all changes and mods
                //         all[prop].writable = true
                //         all[prop].enumerable = true
                //         all[prop].configurable = true
                //     }

                //     return all
                // }, {})
            }

            return createMod(strip)
            // return Object.create(PrmProto.prototype, createMod(strip))
        }
    }

    return PrmProto
}
