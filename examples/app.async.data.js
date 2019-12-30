exports.assignONE = {
    jobID: 'bank_1',
    cusListA: [
        {
            uid: 'steve_jobs_12345',
            accountName: 'Steve Jobbs',
            bankName: 'Swiss Bank',
            accountNumber: '2346547435',
            accountType: 'investment',
            'SWIFT_BIC': '34575',
            portfolio: 20000000000
        }, // _RI = 0
        {
            uid: 'bill_gates_12345',
            accountName: 'Bill Gates',
            bankName: 'Swiss Bank',
            accountNumber: '23497344567867',
            accountType: 'investment',
            'SWIFT_BIC': '34575',
            portfolio: 50000000000
        } // _RI = 1
    ],
    cusListB: [
        {
            uid: 'warren_buffet_12345',
            accountName: 'Warren Buffet',
            bankName: 'Swiss Bank',
            accountNumber: '345546768789',
            accountType: 'investment',
            'SWIFT_BIC': '34575',
            portfolio: 100000000000
        } // _RI = 2
    ]
}

exports.assignTWO = {
    jobID: 'bank_2',
    cusListA: [
        {
            uid: 'steve_jobs_12345',
            accountName: 'Steve Jobbs',
            bankName: 'ICBC',
            accountNumber: '32456767876',
            accountType: 'investment',
            'SWIFT_BIC': '237687',
            portfolio: 50000000000
        }, // _RI = 3
        {
            uid: 'bill_gates_12345',
            accountName: 'Bill Gates',
            bankName: 'ICBC',
            accountNumber: '3247890890',
            accountType: 'investment',
            'SWIFT_BIC': '4565',
            portfolio: 90000000000
        } // _RI = 4
    ],
    cusListB: [{
        uid: `warren_buffet_12345`,
        accountName: 'Warren Buffet',
        bankName: 'ICBC',
        accountNumber: '345567898074',
        accountType: 'investment',
        'SWIFT_BIC': '89456',
        portfolio: 70000000000
    }] // _RI = 5
}
