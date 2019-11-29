
// NOTE partial chaining example with anonymous `uid` and `each` callback
module.exports = (PRM, exampleData, notify) => {
    var d1 = [{ name: 'alex', age: 20 }] // _ri = 0
    var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
    var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
    var d4 = ['a', null, false] // _ri = 6,7,8

    var uid = 'job_2'
    var nn = PRM.setupData(d1, uid) // add
    PRM.setupData(d2) // add
        .setupData(d3) // add

    var nn2 = PRM.computation(item => { // compute so far
        /**
         * NOTE
         *  allow query without job `uid`, we set `this.itemDataSet=[{dataSet, _uid,_ri},...]`
         *  will anonymously search each items _uid and make valid updates in our scope
         *  Now we know what each itemDataSet is.. On `each` callback we can make further changes, whala!
         *  resx.itemDataSet = nn.d
         */

        // we update only 3 items
        PRM.itemDataSet = nn.d.slice(0, 3)

        // NOTE do some calculation for `each` item, must return 1 item

        item.dataSet.age += 30
        item.dataSet.status = 'divorce'

        // update only one
        if (item._ri === 0) {
            item.dataSet.status = 'single'
        }

        return item
    }, 'each', false) // anonymous uid, check `itemDataSet` first!
        .markDone(/* uid */) // will ignore setupData for uid:job_2 from future updates
        .setupData(d4)
        .resolution(null, uid)

    /**
         * returns
        [ { name: 'alex', age: 50, status: 'single' },
        { name: 'daniel', age: 85, status: 'divorce' },
        { name: 'john', age: 74, status: 'divorce' },
        { name: 'max', age: 44 },
        { name: 'smith', age: 66 },
        { name: 'jane', age: 35 } ]
         */

    return nn2
}
