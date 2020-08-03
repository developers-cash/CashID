const CashId = require('./cashid')

const LibCash = require('@developers.cash/libcash-js')
const libCash = new LibCash()

class CashIdClient {
  /**
   * Class for use by CashID clients.
   *
   * @param {String} wif Private Key in WIF format
   * @example
   * let client = new CashIdClient('L5DwfPuZ3bfrimYwY81ZHaGT76YraS494UDDzSRrv7VdCcNEXJi4')
   */
  constructor (wif) {
    this.wif = wif
  }

  /**
   * Class for use by CashID clients.
   *
   * @param {String|Object} request CashID Request or Object for User-initiated
   * @example
   * // Server-initiated
   * let payload = client.createPayload(requestURL, {
   *   name: 'Jim'
   *   // ...
   * })
   *
   * // User-initiated
   * let payload = client.createPayload({
   *   domain: 'cashid.infra.cash',
   *   path: '/api/auth',
   *   action: 'update'
   * }, {
   *   country: 'United States'
   *   // ...
   * })
   */
  createPayload (request, metadata) {
    // If it's an object (User-Initiated), then construct request
    if (typeof request === 'object') {
      // If a nonce (timestamp) has not been set...
      if (!request.nonce) {
        request.nonce = Math.floor(new Date().getTime() / 1000)
      }

      request = CashId.createRequestURL(request)
    }

    // Construct response object
    const response = {
      request: request,
      address: '',
      signature: '',
      metadata: metadata
    }

    // Parse the request
    const parsed = CashId.parseRequest(request)

    // Make sure all required fields are present
    const missingFields = []
    for (const field of parsed.required) {
      if (!metadata[field]) {
        missingFields.push(field)
      }
    }

    if (missingFields.length) {
      throw new Error(`Missing required fields specified in request: ${missingFields.join(',')}`)
    }

    const ecPair = libCash.ECPair.fromWIF(this.wif)
    response.address = libCash.ECPair.toCashAddress(ecPair).replace('bitcoincash:', '')
    response.signature = libCash.BitcoinCash.signMessageWithPrivKey(this.wif, response.request)

    return response
  }
}

module.exports = CashIdClient
