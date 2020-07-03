const URL = require('url').URL

const CashID = require('./cashid')

const LibCash = require('@developers.cash/libcash-js')
const libCash = new LibCash()

class Server {
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
        store: (request, data) => {
          this._requests[request] = data
        },
        get: (request) => {
          return this._requests[request]
        },
        remove: (request) => {
          delete this._requests[request]
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
      url.searchParams.set('r', Server._encodeFieldsAsString(metadata.required))
    }

    // Set optional fields (only if given)
    if (metadata.optional) {
      url.searchParams.set('o', Server._encodeFieldsAsString(metadata.optional))
    }

    // Set nonce
    url.searchParams.set('x', Math.floor(Math.random() * (1 + 999999999 - 0)) + 0)

    // Get URL string for request
    const finalUrl = url.href

    // Store this request (with a timestamp)
    this.adapter.store(finalUrl, { timestamp: new Date() })

    return finalUrl
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

    // Make sure this request was created by us (and is non-tampered)
    // (Only do this if it's not a user-initiated request)
    if (parsed.action === 'auth' && !this.adapter.get(payload.request)) {
      throw CashID._buildError('requestAltered')
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

    // Mark this request as consumed by deleting it
    this.adapter.remove(payload.request)

    // If we made it through return success
    return {
      status: 0,
      message: 'Authentication successful'
    }
  }

  static parseRequest (requestURL) {
    // Map of field codes to names
    const map = {
      identity: {
        1: 'name',
        2: 'family',
        3: 'nickname',
        4: 'age',
        5: 'gender',
        6: 'birthdate',
        8: 'picture',
        9: 'national'
      },
      position: {
        1: 'country',
        2: 'state',
        3: 'city',
        4: 'streetname',
        5: 'streetnumber',
        6: 'residence',
        9: 'coordinates'
      },
      contact: {
        1: 'email',
        2: 'instant',
        3: 'social',
        4: 'phone',
        5: 'postal'
      }
    }

    // Parse the URL into parts
    requestURL = new URL(requestURL)

    // Make sure it's a CashID intent
    if (requestURL.protocol.toLowerCase() !== 'cashid:') {
      throw new Error('Request does not appear to be a CashID request')
    }

    // Define response object
    const parsed = {
      domain: requestURL.pathname.split('/')[0],
      path: requestURL.pathname.split(/\/(.+)/)[1],
      action: requestURL.searchParams.get('a') || 'auth',
      required: requestURL.searchParams.get('r') || [],
      optional: requestURL.searchParams.get('o') || [],
      nonce: requestURL.searchParams.get('x') || null
    }

    // Parse the required and optional fields
    for (const fieldStatus of ['optional', 'required']) {
      // Create storage
      const fields = []
      let metadataType = ''

      // Loop through each character
      for (const char of parsed[fieldStatus]) {
        // Set metadataType to identity and go to next character
        if (char === 'i') { metadataType = 'identity'; continue }

        // Set metadataType to position and go to next character
        if (char === 'p') { metadataType = 'position'; continue }

        // Set metadataType to contact and go to next character
        if (char === 'c') { metadataType = 'contact'; continue }

        // Make sure the field is valid and add it to list of required/optional
        if (metadataType && map[metadataType][char]) {
          fields.push(map[metadataType][char])
        }
      }

      // Add fields to our parsed object
      parsed[fieldStatus] = fields
    }

    return parsed
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

module.exports = Server
