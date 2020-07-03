const assert = require('assert')

const Server = require('../src/server')
const Client = require('../src/client')

describe('# Client', function () {
  describe('# createResponse', () => {
    it('Should throw error if required field missing', () => {
      const server = new Server('test', 'test')

      const request = server.createRequest('auth', {
        required: ['name', 'family']
      })

      assert.throws(() => {
        // Missing family (lastname)
        const payload = Client.createResponse(request, {
          name: 'firstname'
        }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')
      }, Error)
    })
  })
})
