const assert = require('assert')

const { CashId, CashIdClient, CashIdServer } = require('../src')

describe('# Server', async function() {
  const client = new CashIdClient('L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
  const server = new CashIdServer('cashid.infra.cash', '/api/auth')
  
  describe('# createRequest', async function() {
    it('Should not throw error if valid request', async function() {
      const cashIDRequest = await server.createRequest({
        action: 'auth',
        required: ['name', 'family', 'nickname', 'email'],
        optional: ['country', 'state']
      })
    })
  })

  describe('# validateRequest', async function() {
    describe('Success case - Server-initiated', async function() {
      
      let cashIDRequest = null
      let payload = null
      let result = null
      
      before(async function () {
        cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        }, {
          extraParam: 69
        })

        payload = client.createPayload(cashIDRequest.request, {
          name: 'firstname'
        })
        
        result = await server.validateRequest(payload)
      });

      it('Should return nonce (result.nonce)', function() {
        return assert.equal(typeof result.nonce, 'string')
      })
      
      it('Should return request (result.request)', function() {
        assert.equal(typeof result.request, 'string')
      })
      
      it('Should return created timestamp (result.timestamp)', function() {
        assert.equal(result.timestamp instanceof Date, true)
      })
      
      it('Should return success status (result.status === 0)', function() {
        assert.equal(result.status, 0)
      })
      
      it('Should return consumed timestamp (result.consumed)', function() {
        assert.equal(result.consumed instanceof Date, true)
      })
      
      it('Should return payload object (result.payload)', function() {
        assert.equal(typeof result.payload, 'object')
      })
      
      it('Should contain extra params from the "store" param', function() {
        assert.equal(typeof result.extraParam, 'number')
      });
    })
    
    describe('Success case - User-initiated', async function() {
      
      let cashIDRequest = null
      let payload = null
      let result = null
      
      before(async function () {
        payload = client.createPayload({
          domain: 'cashid.infra.cash',
          path: '/api/auth',
          action: 'update' 
        }, {
          country: 'United States'
        })
        
        result = await server.validateRequest(payload)
      });
    })
    
    describe('Fail cases', function() {
      it('Should throw ResponseBroken if payload is not an object', async function() {
        return assert.rejects(async function() {
          await server.validateRequest("FullFuckedPayload")
        }, {
          name: 'ResponseBroken'
        })
      })
      
      it('Should throw ResponseMissingAddress if missing address', async function() {
        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        })

        const payload = client.createPayload(cashIDRequest.request, {
          name: 'firstname'
        })
        
        delete payload.address
        
        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'ResponseMissingAddress'
        })
      })
      
      it('Should throw ResponseMalformedAddress if address is not a CashAddr', async function() {
        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        })

        const payload = client.createPayload(cashIDRequest.request, {
          name: 'firstname'
        })
        
        payload.address = "abcde12345"
        
        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'ResponseMalformedAddress'
        })
      })
      
      it('Should throw ResponseMissingSignature if missing signature', async function() {
        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        })

        const payload = client.createPayload(cashIDRequest.request, {
          name: 'firstname'
        })
        
        delete payload.signature
        
        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'ResponseMissingSignature'
        })
      })
      
      it('Should throw RequestInvalidNonce if nonce does not exist', async function() {
        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        })
        
        // Change the nonce
        let modifiedRequest = new URL(cashIDRequest.request)
        modifiedRequest.searchParams.set('x', '1000000')

        const payload = client.createPayload(modifiedRequest.href, {
          name: 'firstname'
        })

        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'RequestInvalidNonce'
        })
      })
      
      it('Should throw RequestInvalidNonce if nonce timestamp invalid on User-Initiated request', async function() {
        payload = client.createPayload({
          domain: 'cashid.infra.cash',
          path: '/api/auth',
          action: 'update',
          nonce: Math.floor(new Date().getTime() / 1000) - 60 * 20 // Subtract 20 minutes
        }, {
          country: 'United States'
        })

        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'RequestInvalidNonce'
        })
      })
      
      it('Should throw RequestAltered if request altered', async function() {
        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        })
        
        // Change the nonce
        let modifiedRequest = new URL(cashIDRequest.request)
        modifiedRequest.searchParams.set('o', 'c1')

        const payload = client.createPayload(modifiedRequest.href, {
          name: 'firstname'
        })

        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'RequestAltered'
        })
      })
      
      it('Should throw RequestConsumed if request already consumed', async function() {
        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        })

        const payload = client.createPayload(cashIDRequest.request, {
          name: 'firstname'
        })

        // Send first payload
        await server.validateRequest(payload)
        
        // Then try resending
        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'RequestConsumed'
        })
      })

      it('Should throw ResponseInvalidSignature if signature invalid', async function() {
        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name']
        })

        const payload = client.createPayload(cashIDRequest.request, {
          name: 'firstname'
        })

        // Overwrite signature
        payload.signature = 'IIGPrv2ZzPN0HHAtrxAiaZHDm0Elxx95hGbbAYhVw3v+TDy2UQnOf7djuQLjnRJ0fd0T/EcKDEBAFBqKi8cSyfc='

        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, {
          name: 'ResponseInvalidSignature'
        })
      })

      it('Should throw ResponseMissingMetadata if required field missing', async function() {
        const server = new CashIdServer('test', 'test')

        const cashIDRequest = await server.createRequest({
          action: 'auth',
          required: ['name', 'family']
        })

        const payload = client.createPayload(cashIDRequest.request, {
          name: 'firstname',
          family: 'lastname'
        })

        // Delete family (last name) field from payload
        delete payload.metadata.family
        
        assert.rejects(async function() {
          await server.validateRequest(payload)
        }, { 
          name: 'ResponseMissingMetadata'
        })
      })
    })
  })
})
