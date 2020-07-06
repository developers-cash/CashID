const Common = require('./common')

const LibCash = require('@developers.cash/libcash-js')
const libCash = new LibCash()

class CashIdClient {
  constructor (wif) {
    this.wif = wif
  }

  parseRequest (requestURL) {
    return Common.parseRequest(requestURL)
  }

  createResponse (requestURL, metadata) {
    // Construct response object
    const response = {
      request: requestURL,
      address: '',
      signature: '',
      metadata: metadata
    }

    // Parse the request
    const parsed = Common.parseRequest(requestURL)

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
