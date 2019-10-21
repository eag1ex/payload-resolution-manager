#### [ Developed by Eaglex ](http://eaglex.net)
##### Name: Payload Resolution Manager
* License: `CC BY` 

#### Description
- You are issuing many async calls and want to track all the requests by uniq id.
- Individual sets of data[index] that maybe worked on independently (out-of-order) will be tracked with resolution index (`_ri`).
 * `Example` You issued 20 requests, each request is 5 data sets [x5]. Because all 20 requests are issued at the same time, each will be out-of-order, we can track then with resolution index, and correctly collect data in the end.

##### Stack
 - Lodash, ES6, javascript, node.js

##### Usage
- Examples in the `index.js`, simply uncomment each one.





##### Example output:
`
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
`




##### Notes
- Can be implemented on browser/client and compiled down to ES5, in next version solution will be available.

##### log
* 20/10/2019 > Payload Resolution Manager 1.0.0

##### Contact
 * Have questions, or would like to submit feedback, `contact me at: https://eaglex.net/app/contact?product=PayloadResolutionManager`

##### LICENSE
* LICENCE: CC BY
* SOURCE: https://creativecommons.org/licenses/by/4.0/legalcode
