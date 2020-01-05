
// NOTE partial chaining example with anonymous `uid` and `each` callback
module.exports = (PRM, exampleData, notify) => {
    var d1 = [{ name: 'alex', age: 20 }] // _ri = 0
    var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
    var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
    var d4 = ['a', null, false] // _ri = 6,7,8

    var uid = 'job_2'
    var nn = PRM.set(d1, uid) // add
    PRM.set(d2) // add
        .set(d3) // add

    // we update only 3 items
    var nn2 = PRM.compute(item => { // compute so far
        /**
         * NOTE
         *  allow query without job `uid`, we set `this.itemDataSet=[{dataSet, _uid,_ri},...]`
         *  will anonymously search each items _uid and make valid updates in our scope
         *  Now we know what each itemDataSet is.. On `each` callback we can make further changes, whala!
         *  resx.itemDataSet = nn.d
         */
        PRM.itemDataSet = nn.d// .slice(0, 3)
        // NOTE do some calculation for `each` item, must return 1 item

        item.dataSet.age += 30
        item.dataSet.status = 'divorce'
        // update only one
        if (item._ri === 0) {
            item.dataSet.status = 'single'
        }
        // item.complete = true
        return item
    }, 'each') // anonymous uid, check `itemDataSet` first!
    //  .markDone(/* uid */) // will ignore set for uid:job_2 from future updates
        // .set(d4)
        .resolution().d

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
