
// NOTE partial chaining example with anonymous `uid` and `each` callback
module.exports = (notify) => {
    const PRM = require('@root').PRM
    var debug = true
    const prm = new PRM(debug, {
        strictMode: true, // make sure jobs of the same uid cannot be called again!
        // onlyCompleteSet: true, // `resolution` will only return dataSets marked `complete`
        // batch: true, // after running `resolution` method, each job that is batched using `batchReady([jobA,jobB,jobC])`, only total batch will be returned when ready
        resSelf: true, // allow chaning multiple resolution
        autoComplete: true // auto set complete on every compute iteration within `each` call
    })

    var exampleData = (id = 0) => {
        var data = {
            // each item in array is 1 payload
            0: [{ name: 'mike', age: 20 }, { name: 'alex', age: 50 }, { name: 'john', age: 25 }, { name: 'cris', age: 22 }],
            1: [{ name: 'john', age: 22 }, { name: 'mary', age: 15 }, { name: 'denny', age: 19 }, { name: 'gery', age: 55 }, { name: 'greg', age: 66 }],
            2: [{ name: 'daniel', age: 35 }, { name: 'lary', age: 65 }, { name: 'andy', age: 54 }],
            3: [{ name: 'jamie', age: 31 }, { name: 'derick', age: 44 }, { name: 'lily', age: 21 }, { name: 'marcus', age: 68 }, { name: 'alexander', age: 44 }, { name: 'derick', age: 77 }],
            4: [[1], [2]],
            5: ['a', [], {}, null, false, 1, new Function()]
        }
        if (data[id] === undefined) throw (`invalid id provided ${id}`)
        return data[id]
    }

    var d1 = [{ name: 'alex', age: 20 }] // _ri = 0
    var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
    var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
    var d4 = ['a', null, false] // _ri = 6,7,8

    var uid = 'job_2'
    var nn = prm.set(d1, uid) // add
    prm.set(d2) // add
        .set(d3) // add

    // we update only 3 items
    var nn2 = prm.compute(item => { // compute so far
        /**
         * NOTE
         *  allow query without job `uid`, we set `this.itemDataSet=[{dataSet, _uid,_ri},...]`
         *  will anonymously search each items _uid and make valid updates in our scope
         *  Now we know what each itemDataSet is.. On `each` callback we can make further changes, whala!
         *  resx.itemDataSet = nn.d
         */
        prm.itemDataSet = nn.d// .slice(0, 3)
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

    notify.ulog({ job_2: nn2 })
}
