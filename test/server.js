const assert = require('assert')

const Server = require('../src/server')
const Client = require('../src/client')

describe('# Server', function () {
  describe('# createRequest', () => {
    it('Should not throw error if valid request', () => {
      const server = new Server('test', 'test')

      const request = server.createRequest('auth', {
        required: ['name', 'family', 'nickname', 'email'],
        optional: ['country', 'state']
      })
    })
  })

  describe('# validateRequest', () => {
    it('Should not throw error if valid response', () => {
      const server = new Server('test', 'test')

      const request = server.createRequest('auth', {
        required: ['name', 'family', 'nickname', 'email'],
        optional: ['country', 'state']
      })

      const payload = Client.createResponse(request, {
        name: 'firstname',
        family: 'lastname',
        nickname: 'example',
        email: 'test@mailinator.com',
        country: 'nigeria',
        state: 'somewhere'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      server.validateRequest(payload)
    })

    it('Should throw error if signature invalid', () => {
      const server = new Server('test', 'test')

      const request = server.createRequest('auth', {
        required: ['name', 'family', 'nickname', 'email'],
        optional: ['country', 'state']
      })

      const payload = Client.createResponse(request, {
        name: 'firstname',
        family: 'lastname',
        nickname: 'example',
        email: 'test@mailinator.com',
        country: 'nigeria',
        state: 'somewhere'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      payload.signature = 'IIGPrv2ZzPN0HHAtrxAiaZHDm0Elxx95hGbbAYhVw3v+TDy2UQnOf7djuQLjnRJ0fd0T/EcKDEBAFBqKi8cSyfc='

      assert.throws(() => {
        server.validateRequest(payload)
      }, Error)
    })

    it('Should throw error if required field missing', () => {
      const server = new Server('test', 'test')

      const request = server.createRequest('auth', {
        required: ['name', 'family']
      })

      const payload = Client.createResponse(request, {
        name: 'firstname',
        family: 'lastname'
      }, 'L5GPEGxCmojgzFoBLUUqT2GegLGqobiYhTZzfLtpkLTfTb9E9NRn')

      delete payload.family

      payload.signature = 'IIGPrv2ZzPN0HHAtrxAiaZHDm0Elxx95hGbbAYhVw3v+TDy2UQnOf7djuQLjnRJ0fd0T/EcKDEBAFBqKi8cSyfc='

      assert.throws(() => {
        server.validateRequest(payload)
      }, Error)
    })
  })
})
