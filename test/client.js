const assert = require('assert')

const Server = require('../src/server')
const Client = require('../src/client')

describe('# Client', function () {
  describe('# createResponse', () => {
    const server = new Server('cashid.infra.cash', '/api/auth')
    
    it('Should throw error if required field missing', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name', 'family']
      })

      assert.throws(() => {
        // Missing family (lastname)
        const payload = Client.createResponse(cashIDRequest.request, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
      }, Error)
    })
  })
})
