const URL = require('url').URL

const CashID = require('./cashid')

const LibCash = require('@developers.cash/libcash-js')
const libCash = new LibCash()

class CashIDServer {
  /**
   * constructor
   *
   * @param {String} domain - dont include http/https in front
   * @param {String} path - api endpoint ie "/api/test"
   */
  constructor (domain, path, adapter = null) {
    this.domain = domain || 'auth.cashid.org'
    this.path = path || '/api/auth'

    if (!adapter) {
      this._requests = {}

      this.adapter = {
        store: (nonce, data) => {
          this._requests[nonce] = data
        },
        get: (nonce) => {
          return this._requests[nonce]
        },
        remove: (nonce) => {
          delete this._requests[nonce]
        }
      }
    } else {
      this.adapter = adapter
    }
  }

  /**
   * Validates a payload sent by an Identity Manager
   *
   * @param {Object} payload - example looks like
   *
   *  let responseObject = {
   *    request:
   *      'cashid:demo.cashid.info/api/parse.php?a=login&d=15366-4133-6141-9638&o=i3&x=557579911',
   *    address: 'qpaf03cxjstfc42we3480f4vtznw4356jsn27r5cs3',
   *    signature:'H3hCOFaVnzCz5SyN+Rm9NO+wsLtW4G9S8kLu9Xf8bjoJC3eR9sMdWqS+BJMW5/6yMJBrS+hkNDd41bYPuP3eLY0=',
   *    metadata: []
   *  };
   * @returns {Object} returns parsed request
   */
  createRequest (action = 'auth', metadata = {}, data = '') {
    // Create URL for holding request
    const url = new URL(`cashid:${this.domain}${this.path}`)

    // Set action
    url.searchParams.set('a', action)

    // Set data (only if given)
    if (data) {
      url.searchParams.set('d', data)
    }

    // Set required fields (only if given)
    if (metadata.required) {
      url.searchParams.set('r', CashIDServer._encodeFieldsAsString(metadata.required))
    }

    // Set optional fields (only if given)
    if (metadata.optional) {
      url.searchParams.set('o', CashIDServer._encodeFieldsAsString(metadata.optional))
    }

    // Set nonce
    const nonce = Math.floor(Math.random() * (1 + 999999999 - 0)) + 0
    url.searchParams.set('x', nonce)

    // Store this request (with a timestamp)
    this.adapter.store(nonce, {
      request: url.href,
      timestamp: new Date()
    })

    return {
      url: url.href,
      nonce: nonce
    }
  }

  /**
   * Validates a payload sent by an Identity Manager
   *
   * @param {Object} payload - example looks like
   *
   *  let responseObject = {
   *    request:
   *      'cashid:demo.cashid.info/api/parse.php?a=login&d=15366-4133-6141-9638&o=i3&x=557579911',
   *    address: 'qpaf03cxjstfc42we3480f4vtznw4356jsn27r5cs3',
   *    signature:'H3hCOFaVnzCz5SyN+Rm9NO+wsLtW4G9S8kLu9Xf8bjoJC3eR9sMdWqS+BJMW5/6yMJBrS+hkNDd41bYPuP3eLY0=',
   *    metadata: []
   *  };
   * @returns {Object} returns parsed request
   */
  validateRequest (payload) {
    // Make sure payload is JSON
    if (typeof payload !== 'object') {
      throw CashID._buildError('responseBroken')
    }

    // Make sure payload contains request
    if (!payload.request) {
      throw CashID._buildError('responseMissingRequest')
    }

    // Make sure payload contains an address
    if (!payload.address) {
      throw CashID._buildError('responseMissingAddress')
    }

    // Make sure payload contains an address
    if (!payload.signature) {
      throw CashID._buildError('responseMissingSignature')
    }

    // Parse the request
    const parsed = CashID.parseRequest(payload.request)

    // Declare if user-initiated request and declare original request
    const userInitiated = !['auth', 'login'].includes(parsed.action)
    let originalRequest

    // If this is NOT a user-initiated request (i.e. action is "auth")...
    if (!userInitiated) {
      // Find the original based on nonce
      originalRequest = this.adapter.get(parsed.nonce)

      // If it doesn't exist, throw error
      if (!originalRequest) {
        throw CashID._buildError('requestInvalidNonce')
      }

      // If it's been altered, throw error
      if (payload.request !== originalRequest.request) {
        throw CashID._buildError('requestAltered')
      }

      // If it's been consumed, throw error
      if (originalRequest.consumed) {
        throw CashID.buildError('requestConsumed')
      }
    }

    // Validate signature
    const sigValid = libCash.BitcoinCash.verifyMessage(
      payload.address,
      payload.signature,
      payload.request
    )

    if (!sigValid) {
      throw CashID._buildError('responseInvalidSignature')
    }

    // Ensure that all required fields are present
    const missingFields = []
    if (parsed.required) {
      for (const field of parsed.required) {
        if (!payload.metadata[field]) {
          missingFields.push(field)
        }
      }
    }

    if (missingFields.length) {
      throw CashID._buildError('responseMissingMetadata', missingFields)
    }

    // Mark the original request as consumed
    if (!userInitiated) {
      originalRequest.consumed = new Date()
      originalRequest.payload = payload
      this.adapter.store(payload.nonce, originalRequest)
    }

    // If we made it through return success
    return {
      status: 0,
      message: 'Authentication successful',
      nonce: parsed.nonce
    }
  }

  static _encodeFieldsAsString (fieldArray) {
    // Constants for array positions below
    const METADATA_TYPE = 0
    const METADATA_CODE = 1

    // Map of field names to metadataType+code
    const map = {
      name: 'i1',
      family: 'i2',
      nickname: 'i3',
      age: 'i4',
      gender: 'i5',
      birthdate: 'i6',
      picture: 'i8',
      national: 'i9',
      country: 'p1',
      state: 'p2',
      city: 'p3',
      streetname: 'p4',
      streetnumber: 'p5',
      residence: 'p6',
      coordinates: 'p9',
      email: 'c1',
      instant: 'c2',
      social: 'c3',
      phone: 'c4',
      postal: 'c5'
    }

    const fields = {}

    for (const field of fieldArray) {
      // Make sure field is supported
      if (!map[field]) throw new Error(`Field ${field} is not supported by CashID`)

      // If metadataType does not exist in fields, create it as array
      if (!fields[map[field][METADATA_TYPE]]) fields[map[field][METADATA_TYPE]] = []

      // Push the code to that field
      fields[map[field][METADATA_TYPE]].push(map[field][METADATA_CODE])
    }

    // Convert fields to string
    let asString = ''
    for (const metadataType of ['i', 'p', 'c']) {
      if (fields[metadataType]) {
        asString += `${metadataType}${fields[metadataType].reduce((codes, code) => code, '')}`
      }
    }

    return asString
  }
}

module.exports = CashIDServer
