/**
 * @PRMconnect
 * connect to another job if allowed and by accept, requires authentication via key
 */
module.exports = (PRM) => {
    return class PRMconnect extends PRM {
        constructor(debug, settings) {
            super(debug, settings)

            this.connections = {/** uid:data */} // store connection data to another job
            /**
             * TODO
             * - need 2 seperate scripts, one which holds awaiting transaction, and second that can access that information via accept
             * - each job has uniq {key phrase} (not job uid) which can be used to access each other
             */
        }

        connect() {

        }
    }
}
