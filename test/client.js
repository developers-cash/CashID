const assert = require('assert')

const { Common, CashIdClient, CashIdServer } = require('../src')

describe('# Client', function () {
  describe('# createResponse', function() {
    const client = new CashIdClient('L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
    const server = new CashIdServer('cashid.infra.cash', '/api/auth')
    
    it('Should throw error if required field missing', function() {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name', 'family']
      })

      assert.throws(function() {
        // Missing family (lastname)
        const payload = client.createResponse(cashIDRequest.request, {
          name: 'firstname'
        })
      }, Error)
    })
  })
})
