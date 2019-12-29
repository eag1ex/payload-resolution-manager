#### [ Developed by Eaglex ](http://eaglex.net)
##### Name: Payload Resolution Manager (PRM)
* License: `CC BY` 

#### Description
* Easy to use full featured *Data Management Service* for async handling with Node.js
* Good for: 
    - Sorting DATA at different states
    - Referencing and assesing jobs status
    - Validating results
    - returning async/ defered data
    - munipulating independant jobs

* Perhaps you manage many data sources and want to make sure they are in-sync
* Individual jobs can be worked on independently, and will be tracked by resolution index (`_ri`), and job (`_uid`)
* You can setup timely job batches for any number of jobs to be called when done.
    - `For example` You issued 20 job requests with each 5 data sets [x5]. Since all requests are issued at different times, they will be out-of-order, `PRM` will track them with resolution index, and collect data by `_uid` in the end.

* You can Provide async/defered data, and chain the calls, it will wait... Then continue after data becomes available, this is possible with the help of `XPromise/XPipe` (from another tool) available at : `https://bitbucket.org/eag1ex/xpromise` - take a look for more details.

##### Stack
 - Lodash, ES6, javascript, node.js

##### Usage
- Examples in `./examples/index.js and ./examples/..` folder


##### Features:
* This application supports chaining of methods, example:

```
/**
 * Application, advance chaining example
 * We declared 3 jobs and did some compute to update original data states, the 3rd jobs is delayed. all jobs are returned
 * using `batchReady`
 */

const notify = require('../libs/notifications')()
const PRM = require('../libs/prm/payload.resolution.manager')(notify)

const options = {
    onlyComplete: true, // `resolution` will only return dataSets marked `complete`
    batch: true, // after running `resolution` method, each job that is batched using `batchReady([jobA,jobB,jobC])`, only total batch will be returned when ready
    resSelf: true, // allow chaning multiple resolution
    autoComplete: true // auto set complete on every compute iteration within `each` call
}

const debug = true
const prm = new PRM(debug, options)
var job50 = 'job_50'
var job60 = 'job_60'
var job70 = 'job_70'
var d1 = [{ name: 'alex', age: 20 }, { name: 'jackie', age: 32 }] // _ri = 0,1
var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 2,3
var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 4,5,6
var d4 = [{ name: 'mayson', age: 27 }, { name: 'bradly', age: 72 }, { name: 'andrew', age: 63 }] // _ri = 0,1,2

var d = prm.set(d1, job50)
    .set(d2)
    .set(d3)
    .from(3) // will only make computes starting from(number)  < `_ri` index
    .compute(item => {
        // if (item._ri === 3) {
        //  item._uid = '10000_error' // protected cannot be changed
        //  item._ri = '-50'  // protected cannot be changed
        item.dataSet.age = 70
        item.dataSet.occupation = 'retired'
        return item
    }, 'each')
// .markDone() // no future changes are allowed to `job_50`
    .set(d1, job60)
    .compute(items => {
        var allNewItems = items.map((zz, inx) => {
            return { name: zz.dataSet.name, surname: 'anonymous', age: zz.dataSet.age + inx + 1 }
        })
        // return value need to match total length of initial job
        return allNewItems
    }, 'all')

    .of(job50) // of what job
    .from(5) // from what `_ri` index
    .compute(item => {
        // make more changes to job_50, starting from `_ri` index 5
        return item
    }, 'each')
// .resolution(null, job50) // NOTE  since job is not resolved we can see work on it
    .resolution(null, job60).d // since last resolution was `job_60` this job will be returned first
    /**
     * if you prefer to return each resolution seperatry:
     * var d1 = prm.resolution(null,job50).d
     * var d2 = prm.resolution(null,job60).d
     */

notify.ulog({ job60: d })

/**
* PRM Framework can handle delayed jobs very well
* below is an async job uid:`job_50` which hasnt resolved, so we can make more changes
*/
/// update job50 again
setTimeout(() => {
    var d = [{ name: 'danny', age: 15 }, { name: 'jane', age: 33 }, { name: 'rose', age: 25 }] // _ri =  7, 8 ,9
    prm.set(d, job50)
        .compute(item => {
            if (item._ri >= 7) {
                item.dataSet.message = 'job delayed and updated'
            }
            return item
        }, 'each')
        .resolution()
}, 2000)

var delayedJob = (() => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            prm.set(d4, job70)
                .compute(items => {
                    return items.map((zz, inx) => {
                        var orVals = zz.dataSet
                        return Object.assign({}, orVals, { status: 'updated', age: orVals.age + 10 + inx })
                    })
                }, 'all')
                .resolution()
            resolve(true)
        }, 500)
    })
})()

prm.batchReady([job50, job60, job70], 'flat', d => {
    notify.ulog({ batch: d, message: 'delayed results' })
})

```

##### Methodes explained:
* `Data Prototypes`: each Job:uid consists of item/s:[{dataSet,_uid,_ri,complete, _timestamp},...]. Each array slot is a prototype of `PrmProto` instance, props: `_uid, _ri` are protected and cannot be overriten to make sure of consistency and prone errors. Only  `dataSet, _timestamp, complete` props can be changed. 
* `uid:String`: Provide uid for every data asset, per job. If not specified, will  try to find last used uid.
* `data[...]`: Every job must be an array of any value, example: ['string',[],{},null,false,1, new Function()]
* `set(data:Array,uid:String)`: Provide data as array, with `uid` > uniq identifier,
this item will be saved by reference in class variable with `_ri` and `_uid`. You can provide concurent `set` for the same `uid` via chaining or by line.

* `markDone(uid:String)`: Provide after any `set`, and will make sure no other changes are allowed to this job - any subsequent calls will be ignored.

* `updateDataSet(uid,_ri, newDataSet,type)` : update job, targted via `_ri` together with `uid` 
     - `newDataSet` can be any data, example: {},[],1,true, except for null
     - `type:string`: can specify `merge` or `new`. Best to do your own merging if its a large nested object, or array.
* `updateSet(newData,uid)` : provide raw data produced by `set` or use `getSet(uid)` to return it. Will update only dataSet[..], will not grow the items array.

* `batchReady(jobUIDS=[], type:string, cb=>)`: You want to wait until specific jobs has completed. Each job in batch is set uppon resolution is called, each time it checks if all your batch jobs are ready.
     - `jobUIDS` :specify working job uids
     - `type`: can return as `flat`> array, or `grouped`> object
     - `cb:` when ready returns callback

* `resolution(yourData:Object,uid:String,dataRef:String,doDelete:boolean )`: When ready call this to complete the job.
     - `yourData`:optional, provide data from outside source in correct format, example: `yourData {uid:[{dataSet},_ri,_uid],... }`, otherwise provide `null`
     - `dataRef` your data is from external source:yourData, you have the option to provide `dataRef` if its other then `dataSet`
     - `doDelete:true` will delete the job from class cache after finilized, you have the option not to delete it! 
* `compute(callback(), method='all',uid)`: use this method to perform data calculation for each `job:uid`.
     - `callback(item=>)`: returns all items from `uid`, by default 1 callback with `method=all` will be initiated. Make changes and return all new items (must provide same size). When `method=each` will loop thru each item sequently,  must return 1 item. If you do not know your uid and want to use `each`, you must set `this.itemDataSet` to update callback, for clear explanation, take a look at examples in `./examples/index.js`
     - `uid`: provide for data if not chaining, or switching to another job. When `uid`=null it will look for last used. If anonymous, because your data was async, must provide `formated()` > with {dataSet[],_uid,_ri} so it can search thru and match available. 
     - `tools`: compute works best with these tools: `of, from, filter, tap`, so you can make changes only to those dataSets without altering rest of job data.
* `getSet(uid,self:boolean)`:  return data for desired `uid` in formated state.
     - `self:true`: you can chain this method. Then you must provide: getSet(...).d  to return it.

* `formated(data[...], uid, external, clean)` : for some reason you want to make sure your data is correct. Provide job[...] as previously initialized with `set`. Does not update or change any internal class states.
     - `external:boolean` If its an external data that is not yet available in the class, will ignore validation.

* `delSet(uid, force:true)`:  manualy delete cache and history from the class, specify `force=true` to delete all data.

###### Beta Tools
* `of(uid)`: chaining multiple jobs, example: `a,b,c` `prm.of(uid:c)` > to start tracking from this job
* `from(ri:index)` : will return items starting from that index when using `compute`, based of last `uid`, all other dataSets, part of this job will still return in `resolution`. 
    - Notice no support for this method when using `async` option at the moment.

##### Example output:
```
     [{ dataSet: { name: 'daniel', age: 35 }, _ri: 0, _uid: 'index6' },
     { dataSet: { name: 'lary', age: 65 }, _ri: 1, _uid: 'index6' },
     { dataSet: { name: 'andy', age: 54 }, _ri: 2, _uid: 'index6' },
     { dataSet: { name: 'john', age: 22 }, _ri: 3, _uid: 'index6' },
     { dataSet: { name: 'mary', age: 15 }, _ri: 4, _uid: 'index6' },
     { dataSet: { name: 'denny', age: 19 }, _ri: 5, _uid: 'index6' },
     { dataSet: { name: 'gery', age: 55 }, _ri: 6, _uid: 'index6' },
     { dataSet: { name: 'greg', age: 66 }, _ri: 7, _uid: 'index6' },
     { dataSet: { name: 'jamie', age: 31 }, _ri: 8, _uid: 'index6' },
     { dataSet: { name: 'derick', age: 44 }, _ri: 9, _uid: 'index6' },
     { dataSet: { name: 'lily', age: 21 }, _ri: 10, _uid: 'index6' },
     { dataSet: { name: 'marcus', age: 68 }, _ri: 11, _uid: 'index6' },
     { dataSet: { name: 'alexander', age: 44 }, _ri: 12, _uid: 'index6'}]
```




##### Notes
- Can be implemented on browser/client and compiled down to ES5, in next version solution will be available.

##### log
* 20/10/2019 > Payload Resolution Manager 1.0.0
* 29/12/2019 > Payload Resolution Manager 1.6.0

##### Contact
 * Have questions, or would like to submit feedback, `contact me at: https://eaglex.net/app/contact?product=PayloadResolutionManager`

##### LICENSE
* LICENCE: CC BY
* SOURCE: https://creativecommons.org/licenses/by/4.0/legalcode
