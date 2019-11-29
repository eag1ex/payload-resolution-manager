#### [ Developed by Eaglex ](http://eaglex.net)
##### Name: Payload Resolution Manager
* License: `CC BY` 

#### Description
- Easy to use Micro toolkit for your data handling
- You are issuing many async calls and want to track all requests by uniq id.
- Individual sets of data[index] that maybe worked on independently (out-of-order) will be tracked with resolution index (`_ri`).
 * `Example` You issued 20 requests, each request is 5 data sets [x5]. Because all 20 requests are issued at the same time, each will be out-of-order, we can track then with resolution index, and correctly collect data in the end.

##### Stack
 - Lodash, ES6, javascript, node.js

##### Usage
- Examples in the `index.js`, simply uncomment each one.


##### Features:
- This application supports chaining of methods, example:
```
/**
 * Application, advance chaining example
 * We declared 3 jobs and did some computation to update original data states, the 3rd jobs is delayed. all jobs are returned
 * using `batchResolution`
 */
const notify = require('./libs/notifications')()
const PRM = require('./payload.resolution.manager')(notify)

const options = {
    onlyComplete: true, // `resolution` will only return dataSets marked `complete`
    batch: true, // after running `resolution` method, each job that is batched using `batchResolution([jobA,jobB,jobC])`, only total batch will be returned when ready
    finSelf: true, // allow chaning multiple resolution
    autoComplete: true // auto set complete on every computation iteration within `each` call
}

const prm = new PRM(true, options)
var job50 = 'job_50'
var job60 = 'job_60'
var job70 = 'job_70'
var d1 = [{ name: 'alex', age: 20 }, { name: 'jackie', age: 32 }] // _ri = 0
var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
var d4 = [{ name: 'mayson', age: 27 }, { name: 'bradly', age: 72 }, { name: 'andrew', age: 63 }] // _ri = 4,5,6

var d = prm.setupData(d1, job50)
    .setupData(d2)
    .setupData(d3)
    .computation(item => {
        if (item._ri === 3) {
            item.dataSet.age = 70
            item.dataSet.occupation = 'retired'
        } else item.dataSet.occupation = 'stock broker'
        //  item.complete = true // because we set an option for `onlyComplete` we have to set when we are ready, otherwise `resolution` will not return this change and data will still exist
        return item
    }, 'each')
    .markDone() // no future changes are allowed to `job_50`

    // this change will be ignored!
    .setupData(d2)
    .computation(item => {
        //   item.complete = true
        return item
    }, 'each')

    .setupData(d1, job60)
    .setupData(d3)
    .computation(items => {
        var allNewItems = items.map((zz, inx) => {
            return { name: zz.dataSet.name, surname: 'anonymous', age: zz.dataSet.age + inx }
        })
        // return value need to match total length of initial job
        return allNewItems
    }, 'all')
    .resolution(null, job50)
    .resolution(null, job60).d // since last resolution was `job_60` this job will be returned first
    /**
     * if you prefer to return each resolution seperatry:
     * var d1 = prm.resolution(null,job50).d
     * var d2 = prm.resolution(null,job60).d
     */
notify.ulog({ job60: d })

var delayedJob = (() => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            prm.setupData(d4, job70)
                .computation(items => {
                    return items.map((zz, inx) => {
                        var orVals = zz.dataSet
                        return Object.assign({}, orVals, { status: 'updated', age: orVals.age + 10 + inx })
                    })
                }, 'all')
                .resolution()
            resolve(true)
        }, 1000)
    })
})()

delayedJob.then(d => {
    var batch = prm.batchResolution([job50, job60, job70])
    notify.ulog({ batch, message: 'delayed results' })

    /**
     * returns..
  [ { name: 'mayson', age: 37, status: 'updated' },
     { name: 'bradly', age: 82, status: 'updated' },
     { name: 'andrew', age: 73, status: 'updated' },
     { name: 'alex', surname: 'anonymous', age: 20 },
     { name: 'jackie', surname: 'anonymous', age: 33 },
     { name: 'max', surname: 'anonymous', age: 46 },
     { name: 'smith', surname: 'anonymous', age: 69 },
     { name: 'jane', surname: 'anonymous', age: 39 },
     { name: 'alex', age: 20, occupation: 'stock broker' },
     { name: 'jackie', age: 32, occupation: 'stock broker' },
     { name: 'daniel', age: 55, occupation: 'stock broker' },
     { name: 'john', age: 70, occupation: 'retired' },
     { name: 'max', age: 44, occupation: 'stock broker' },
     { name: 'smith', age: 66, occupation: 'stock broker' },
     { name: 'jane', age: 35, occupation: 'stock broker' } ]
     */
})

/// //////////////////////////
```


##### Methodes explained:
* `uid:String`: Must provide uid for every data asset, per job. If you do not specify, it will first try to find last used uid.
* `data[...]`: Every job you provide must be an array of any value, example: ['string',[],{},null,false,1, new Function()] 
* `setupData(data:Array,uid:String)`: Provide your request data as array (can be single array),with uniq identifier,
this item will be saved by reference in class variable with `_ri` and `_uid` . You can provide concurent `setupData` for the same `uid` via chaining or by line, up to you, this item will then be updated in the class scope.

* `markDone(uid:String)`: Provide this call after any `setupData`, and it will make sure no other changes are allowed to this items/dataSet's - any subsequent calls to `setupData` will be ignored.

* `updateDataSet(uid,newDataSet,type)` : update item dataSet targted via `_ri` together with `uid` 
     - `newDataSet` can be any data, example: {},[],1,true, except for null
     - `type:string`: can specify `merge` or `new`. Best to do your own merging if its a large nested object, or array.
* `updateSetup(newData,uid)` : provide raw data produced by `setupData` or use `getItem(uid)` to return it. Will update only dataSet[..], will not grow the items array.

* `batchResolution(jobUIDS=[], type:string)`: You want to wait until specific jobs have been completed. Each job in batch is set uppon resolution is called, each time it will check if all your batch uids are set, and will return your batch 
     - `jobUIDS` :specify job uids which you are working on
     - `type`: can return as `flat` array, or `grouped` object

* `resolution(yourData:Object,uid:String,dataRef:String,doDelete:boolean )`: Last method you call when everything is done for your job.
     - `yourData`:optional, you wish to provide data from outside scope and know the format is correct, you can declare it instead. example: `yourData{ uid:[{dataSet},_ri,_uid],... }`, otherwise provide `null`
     - `dataRef` your data is from external source:yourData, you have the option to provide `dataRef` if its other then `dataSet`
     - `doDelete:true` will always delete the job from class cache after its finilized, you have the option not to delete it! 
* `computation(callback(), method='all',uid)`: use this method to perform data calculation for each `uid`.
     - `callback(item=>)`: returns all items from `uid`, by default 1 callback with `method=all` will be initiated. Make changes and return all new items (must provide same size). When `method=each` will loop thru each item sequently,  must return 1 item. If you do not know your uid and want to use `each` methog, you must set `this.itemDataSet` to update callback, for more clear explenation, take a look at `index.js` examples
     - `uid`: provide uid for data if not chaining. When `uid`=null, will look for last used uid, when uid is anonymous  because data was returned radomly, must provide dataSet format wrapped with {dataSet[],_uid,_ri} so method can search thru it and match available uid's 

* `getItem(uid,self:boolean)`:  return data for desired `uid` in raw state, with `_uid`, `_ri` and `dataSet`.
     - `self`: when provided you can chain this method. To return, you must provide: getItem(...).d (if self is set:true)

* `itemFormated(data[...], uid, dataRef, external, clean)` : for some reason you want to make sure your data is correct and return clean state. Provide data[...] as previously initialized with `setupData`. Does not update or change any internal states.
     - `dataRef:string` Provide different reference other then `dataSet`
     - `external:boolean` If its an external data that is not yet available in the class.

* `deleteSet(uid, force:true)`: you require some hacking, manualy delete cache and history from the class, specify `force=true` to delete all data.


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

##### Contact
 * Have questions, or would like to submit feedback, `contact me at: https://eaglex.net/app/contact?product=PayloadResolutionManager`

##### LICENSE
* LICENCE: CC BY
* SOURCE: https://creativecommons.org/licenses/by/4.0/legalcode
