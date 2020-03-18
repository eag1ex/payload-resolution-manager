require('module-alias/register') // required for javascript alias file nale loading

'use strict'
/* eslint-disable */

const { notify } = require('@root')
// NOTE `uncomment each example to see the output in console`
//const job_1 = require('./job_1')(notify)
//const job_2 = require('./job_2')(notify)
//const job_3 = require('./job_3')(notify)
//const completionExample = require('./app.completion.example')
//const asyncExample = require('./app.async.example')
//const mixedExample = require('./app.example')



const BANK_PROJECT = (() => {
    const AppProject = require('./app.project.example/app')()
    new AppProject(false)
})()


