const assert = require('assert')

const URL = require('url').URL
const { Common, CashIdClient, CashIdServer } = require('../src')

describe('# Server', function () {
  const server = new CashIdServer('cashid.infra.cash', '/api/auth')
  
  describe('# createRequest', () => {
    it('Should not throw error if valid request', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name', 'family', 'nickname', 'email'],
        optional: ['country', 'state']
      })
    })
  })

  describe('# validateRequest', () => {
    describe('Success cases', () => {
      const cashIDRequest = server.createRequest('auth', {
        required: ['name']
      })

      const payload = CashIdClient.createResponse(cashIDRequest.request, {
        name: 'firstname'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
      
      let result = server.validateRequest(payload)

      it('Should return nonce (result.nonce)', () => {
        assert.equal(typeof result.nonce, 'string')
      })
      
      it('Should return request (result.request)', () => {
        assert.equal(typeof result.request, 'string')
      })
      
      it('Should return created timestamp (result.timestamp)', () => {
        assert.equal(result.timestamp instanceof Date, true)
      })
      
      it('Should return success status (result.status === 0)', () => {
        assert.equal(result.status, 0)
      })
      
      it('Should return consumed timestamp (result.consumed)', () => {
        assert.equal(result.consumed instanceof Date, true)
      })
      
      it('Should return payload object (result.payload)', () => {
        assert.equal(typeof result.payload, 'object')
      })
    })
    
    describe('Fail cases', () => {
      it('Should throw ResponseBroken if payload is not an object', () => {
        assert.throws(() => {
          server.validateRequest("FullFuckedPayload")
        }, {
          name: 'ResponseBroken'
        })
      })
      
      it('Should throw ResponseMissingAddress if missing address', () => {
        const cashIDRequest = server.createRequest('auth', {
          required: ['name']
        })

        const payload = CashIdClient.createResponse(cashIDRequest.request, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
        
        delete payload.address
        
        assert.throws(() => {
          server.validateRequest(payload)
        }, {
          name: 'ResponseMissingAddress'
        })
      })
      
      it('Should throw ResponseMalformedAddress if address is not a CashAddr', () => {
        const cashIDRequest = server.createRequest('auth', {
          required: ['name']
        })

        const payload = CashIdClient.createResponse(cashIDRequest.request, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
        
        payload.address = "abcde12345"
        
        assert.throws(() => {
          server.validateRequest(payload)
        }, {
          name: 'ResponseMalformedAddress'
        })
      })
      
      it('Should throw ResponseMissingSignature if missing signature', () => {
        const cashIDRequest = server.createRequest('auth', {
          required: ['name']
        })

        const payload = CashIdClient.createResponse(cashIDRequest.request, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
        
        delete payload.signature
        
        assert.throws(() => {
          server.validateRequest(payload)
        }, {
          name: 'ResponseMissingSignature'
        })
      })
      
      it('Should throw RequestInvalidNonce if nonce does not exist', () => {
        const cashIDRequest = server.createRequest('auth', {
          required: ['name']
        })
        
        // Change the nonce
        let modifiedRequest = new URL(cashIDRequest.request)
        modifiedRequest.searchParams.set('x', '1000000')

        const payload = CashIdClient.createResponse(modifiedRequest.href, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

        assert.throws(() => {
          server.validateRequest(payload)
        }, {
          name: 'RequestInvalidNonce'
        })
      })
      
      it('Should throw RequestAltered if request altered', () => {
        const cashIDRequest = server.createRequest('auth', {
          required: ['name']
        })
        
        // Change the nonce
        let modifiedRequest = new URL(cashIDRequest.request)
        modifiedRequest.searchParams.set('o', 'c1')

        const payload = CashIdClient.createResponse(modifiedRequest.href, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

        assert.throws(() => {
          server.validateRequest(payload)
        }, {
          name: 'RequestAltered'
        })
      })
      
      it('Should throw RequestConsumed if request already consumed', () => {
        const cashIDRequest = server.createRequest('auth', {
          required: ['name']
        })

        const payload = CashIdClient.createResponse(cashIDRequest.request, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

        // Send first payload
        server.validateRequest(payload)
        
        // Then try resending
        assert.throws(() => {
          server.validateRequest(payload)
        }, {
          name: 'RequestConsumed'
        })
      })

      it('Should throw ResponseInvalidSignature if signature invalid', () => {
        const cashIDRequest = server.createRequest('auth', {
          required: ['name']
        })

        const payload = CashIdClient.createResponse(cashIDRequest.request, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

        // Overwrite signature
        payload.signature = 'IIGPrv2ZzPN0HHAtrxAiaZHDm0Elxx95hGbbAYhVw3v+TDy2UQnOf7djuQLjnRJ0fd0T/EcKDEBAFBqKi8cSyfc='

        assert.throws(() => {
          server.validateRequest(payload)
        }, {
          name: 'ResponseInvalidSignature'
        })
      })

      it('Should throw ResponseMissingMetadata if required field missing', () => {
        const server = new CashIdServer('test', 'test')

        const cashIDRequest = server.createRequest('auth', {
          required: ['name', 'family']
        })

        const payload = CashIdClient.createResponse(cashIDRequest.request, {
          name: 'firstname',
          family: 'lastname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

        // Delete family (last name) field from payload
        delete payload.metadata.family
        
        assert.throws(() => {
          server.validateRequest(payload)
        }, { 
          name: 'ResponseMissingMetadata'
        })
      })
    })
  })
})
