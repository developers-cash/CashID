const assert = require('assert')

const Common = require('../src/common')

describe('# Common', function () {
  describe('# parseRequest', () => {
    it('Should not throw error on valid CashID requests', () => {
      const requests = [
        'cashid:cashid.infra.cash/api/auth?a=auth&d=&r=i12345689p1234569c12345&x=135621001', // All fields required
        'cashid:cashid.infra.cash/api/auth?a=auth&d=&o=i12345689p1234569c12345&x=135621002', // All fields optional
        'cashid:cashid.infra.cash/api/auth?a=auth&d=&r=i123p12c12&o=i456p34c35&x=135621003' // Mix n match
      ]

      for (const request of requests) {
        Common.parseRequest(request)
      }
    })

    it('Should throw errors if invalid requests', () => {
      const requests = [
        'bitid:cashid.infra.cash/api/auth?a=auth&d=&r=i12345689p1234569c12345&x=135621001', // Invalid intent
        'cashid:cashid.infra.cash/api/auth?a=auth&d=&r=c9&x=135621002', // Invalid code "c9"
        'cashid:cashid.infra.cash/api/auth?a=auth&d=&r=@&x=135621003', // Invalid character
        'noscheme', // Fucked
        'cashid:somedomain/asdfasdf' // Completely fucked
      ]

      assert.throws(() => {
        Common.parseRequest(request)
      }, Error)
    })
  })
})
