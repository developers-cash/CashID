const assert = require('assert')

const { CashId, CashIdClient, CashIdServer } = require('../src')

describe('# Client', function () {
  describe('# createPayload', function() {
    const client = new CashIdClient('L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
    
    it('Should handle CashID URL', function() {
      const url = CashId.createRequestURL({
        required: ['name', 'family']
      })
      
      const payload = client.createPayload(url, {
        name: 'firstname',
        family: 'lastname'
      })
    })
    
    it('Should generate user-initiated request (Request Object)', function() {
      const payload = client.createPayload({
        action: 'update'  
      }, {
        name: 'firstname',
        family: 'lastname'
      })
    })
    
    it('Should throw error if required field missing', function() {
      const url = CashId.createRequestURL({
        required: ['name', 'family']
      })

      assert.throws(function() {
        // Missing family (lastname)
        const payload = client.createPayload(url, {
          name: 'firstname'
        })
      }, Error)
    })
  })
})
