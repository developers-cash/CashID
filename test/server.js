const assert = require('assert')

const URL = require('url').URL
const Server = require('../src/server')
const Client = require('../src/client')

describe('# Server', function () {
  const server = new Server('cashid.infra.cash', '/api/auth')
  
  describe('# createRequest', () => {
    it('Should not throw error if valid request', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name', 'family', 'nickname', 'email'],
        optional: ['country', 'state']
      })
    })
  })

  describe('# validateRequest', () => {
    it('Should not throw error if valid response', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name']
      })

      const payload = Client.createResponse(cashIDRequest.request, {
        name: 'firstname'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      server.validateRequest(payload)
    })

    it('Should throw error if signature invalid', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name']
      })

      const payload = Client.createResponse(cashIDRequest.request, {
        name: 'firstname'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      // Overwrite signature
      payload.signature = 'IIGPrv2ZzPN0HHAtrxAiaZHDm0Elxx95hGbbAYhVw3v+TDy2UQnOf7djuQLjnRJ0fd0T/EcKDEBAFBqKi8cSyfc='

      assert.throws(() => {
        server.validateRequest(payload)
      }, Error)
    })
    
    it('Should throw error if nonce does not match', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name']
      })
      
      // Change the nonce
      let modifiedRequest = new URL(cashIDRequest.request)
      modifiedRequest.searchParams.set('x', '1000000')

      const payload = Client.createResponse(modifiedRequest.href, {
        name: 'firstname'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      assert.throws(() => {
        server.validateRequest(payload)
      }, Error)
    })
    
    it('Should throw error if request already consumed', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name']
      })

      const payload = Client.createResponse(cashIDRequest.request, {
        name: 'firstname'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      // Send first payload
      server.validateRequest(payload)
      
      // Then try resending
      assert.throws(() => {
        server.validateRequest(payload)
      }, Error)
    })

    it('Should throw error if required field missing', () => {
      const server = new Server('test', 'test')

      const cashIDRequest = server.createRequest('auth', {
        required: ['name', 'family']
      })

      const payload = Client.createResponse(cashIDRequest.request, {
        name: 'firstname',
        family: 'lastname'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      // Delete family (last name) field from payload
      delete payload.metadata.family
      
      assert.throws(() => {
        server.validateRequest(payload)
      }, Error)
    })
  })
})
