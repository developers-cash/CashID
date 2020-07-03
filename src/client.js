const CashID = require('./cashid')

const LibCash = require('@developers.cash/libcash-js')
const libCash = new LibCash()

class Client {
  static parseRequest (requestURL) {
    return CashID.parseRequest(requestURL)
  }

  static createResponse (requestURL, metadata, wif = null) {
    // Construct response object
    const response = {
      request: requestURL,
      address: '',
      signature: '',
      metadata: metadata
    }

    // Parse the request
    const parsed = CashID.parseRequest(requestURL)

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

    if (wif) {
      const ecPair = libCash.ECPair.fromWIF(wif)
      response.address = libCash.ECPair.toCashAddress(ecPair)
      response.signature = libCash.BitcoinCash.signMessageWithPrivKey(wif, response.request)
    }

    return response
  }

  static signRequest (request, wif) {
    return libCash.signMessageWithPrivKey(wif, request)
  }
}

module.exports = Client
