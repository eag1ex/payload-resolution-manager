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
var uid = 'job_1'

var d1 = [{ name: 'alex', age: 20 }] // _ri = 0
var d2 = [{ name: 'daniel', age: 55 }, { name: 'john', age: 44 }] // _ri = 1,2
var d3 = [{ name: 'max', age: 44 }, { name: 'smith', age: 66 }, { name: 'jane', age: 35 }] // _ri = 3,4,5
var d4 = ['a', null, false] // _ri = 6

var nn = resx.setupData(d1, uid)
    .setupData(d2)
    .setupData(d3) // add data to this item
// .setupData(exampleData(5), 'index11')
    .computation(item => {
        // NOTE do some calculation for `each` item, must return 1 item

        // if (item._ri===0) // do something
        item.dataSet.age += 20
        return item
    }, null, 'each') // we ignored `uid:null` since we are chaining only one job
    // if we provided `index11` internal value will change, need to specify what to finalize!
// .markDone(/*uid */) // will ignore setupData for uid:index12 from future updates
    .setupData(d4)
    .finalize()
    // .finalize(/** customData, `index11`, doDelete=true */)
notify.ulog({ job_1_nn: nn })

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

* `finalize(yourData:Object,uid:String,dataRef:String,doDelete:boolean )`: Last method you call when everything is done for your job.
     - `yourData`:optional, you wish to provide data from outside scope and know the format is correct, you can declare it instead. example: `yourData{ uid:[{dataSet},_ri,_uid],... }`, otherwise provide `null`
     - `dataRef` your data is from external source:yourData, you have the option to provide `dataRef` if its other then `dataSet`
     - `doDelete:true` will always delete the job from class cache after its finilized, you have the option not to delete it! 

* `computation(callback(), uid, method='all')`: use this method to perform data calculation for each `uid`.
     - `callback(item=>)`: returns all items from `uid`, by default 1 callback with `method=all` will be initiated. Make changes and return all new items (must provide same size). When `method=each` then will loop thru each item sequently, you must return only 1 item. 
     - `uid`: must provide uid for data if not chaining. If you set `uid`=null it will look for last used uid

* `getItem(uid,self:boolean)`:  return data for desired `uid` in raw state, with `_uid`, `_ri` and `dataSet`.
     - `self`: when provided you can chain this method. To return, you must provide: getItem(...).d (if self is set:true)

* `itemFormated(data[...], uid)` : for some reason you want to make sure your data is correct and return clean unformated state. Provide data[...] in same size as previously initialized with `setupData`. Method does not update or change any internal states.

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
