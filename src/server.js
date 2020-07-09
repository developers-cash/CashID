const URL = require('url').URL

const CashId = require('./cashid')

const LibCash = require('@developers.cash/libcash-js')
const libCash = new LibCash()

class CashIdServer {
  /**
   * constructor
   *
   * @param {String} domain - Dont include http/https in front
   * @param {String} path - API endpoint ie "/api/test"
   * @param {Object} adapter - Storage adapter (default uses memory)
   * @example
   * // Using Memory storage adapter
   * let cashId = new CashIDServer('cashid.infra.cash', '/api/auth')
   *
   * // Using Redis storage adapter (Use, for example, if behind load-balancer)
   * // let redisClient = redis.createClient()
   * let cashId = new CashIDServer('cashid.infra.cash', '/api/auth', redisClient)
   */
  constructor (domain, path, adapter) {
    this.domain = domain || 'auth.cashid.org'
    this.path = path || '/api/auth'

    if (!adapter) {
      this._requests = new Map()

      this.adapter = {
        set: async (nonce, data) => {
          this._requests[nonce] = data
        },
        get: async (nonce) => {
          return this._requests[nonce]
        },
        del: async (nonce) => {
          delete this._requests[nonce]
        }
      }
    } else {
      this.adapter = adapter
    }
  }

  /**
   * Creates a CashID request
   *
   * @param {String} action - The action to be performed (e.g. "auth", "login", etce
   * @param {Object} metadata - The metadata being requested
   * @param {String} data - Additional data to pass sign
   * @example
   * let cashIdReq = cashId.createRequest('auth', {
   *   required: ['name', 'family'],
   *   optional: ['country']
   * })
   *
   * // {
   * //   nonce: 982827894,
   * //   request: "cashid:cashid.infra.cash/api/auth?a=auth&r=i2&o=p1&x=982827894",
   * //   timestamp: 2020-07-05T01:17:56.034Z
   * // }
   * @returns {Object} Data that was stored in adapter
   */
  async createRequest (action = 'auth', metadata = {}, data = '') {
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
      url.searchParams.set('r', CashIdServer._encodeFieldsAsString(metadata.required))
    }

    // Set optional fields (only if given)
    if (metadata.optional) {
      url.searchParams.set('o', CashIdServer._encodeFieldsAsString(metadata.optional))
    }

    // Set nonce
    const nonce = Math.floor(Math.random() * (1 + 999999999 - 0)) + 0
    url.searchParams.set('x', nonce)

    // Store this request (with a timestamp)
    const storedRequest = {
      request: url.href,
      timestamp: new Date()
    }
    await this.adapter.set(nonce, storedRequest)

    return Object.assign({
      nonce: nonce
    }, storedRequest)
  }

  /**
   * Validates a CashID request
   *
   * @param {Object} payload - The JSON payload sent by the Identity Manager
   * @example
   * let cashIdRes = cashId.validateRequest(payload)
   *
   * // {
   * //   nonce: '554077219',
   * //   request: 'cashid:cashid.infra.cash/api/auth?a=auth&r=i1&x=554077219',
   * //   timestamp: 2020-07-05T01:22:28.796Z,
   * //   status: 0,
   * //   consumed: 2020-07-05T01:22:28.911Z,
   * //   payload: {
   * //     request: 'cashid:cashid.infra.cash/api/auth?a=auth&r=i1&x=554077219',
   * //     address: 'bitcoincash:qz9nq206kteyv2t7trhdr4vzzkej60kqtytn7sxkxm',
   * //     signature: 'IL41BZR+KrcFr1I7iiYYt9XzekcIQ9jM1DTBKAfVwgJCc70n3+M0lokUxX18AmVSpyBtsBSO5kv5YtwRIiQ/650=',
   * //     metadata: { name: 'firstname' }
   * //   }
   * // }
   * @returns {Object} Data that was stored in adapter
   */
  async validateRequest (payload) {
    // Make sure payload is JSON
    if (typeof payload !== 'object') {
      throw CashId._buildError('ResponseBroken')
    }

    // Make sure payload contains request
    if (!payload.request) {
      throw CashId._buildError('ResponseMissingRequest')
    }

    // Parse the request as early as possible so we have the nonce
    const parsed = CashId.parseRequest(payload.request)

    // Make sure payload contains an address
    if (!payload.address) {
      throw CashId._buildError('ResponseMissingAddress', { nonce: parsed.nonce })
    }

    // Make sure the address is a CashAddr
    try {
      libCash.Address.isCashAddress(payload.address)
      if (payload.address.includes('bitcoincash:')) {
        throw new Error('Address should not contain "bitcoincash:" prefix')
      }
    } catch (err) {
      throw CashId._buildError('ResponseMalformedAddress', { nonce: parsed.nonce })
    }

    // Make sure payload contains an address
    if (!payload.signature) {
      throw CashId._buildError('ResponseMissingSignature', { nonce: parsed.nonce })
    }

    // Declare if user-initiated request and declare original request
    const userInitiated = !['auth', 'login'].includes(parsed.action)
    let storedRequest

    // If this is NOT a user-initiated request (i.e. action is "auth")...
    if (!userInitiated) {
      // Find the original based on nonce
      storedRequest = await this.adapter.get(parsed.nonce)

      // If it doesn't exist, throw error
      if (!storedRequest) {
        throw CashId._buildError('RequestInvalidNonce', { nonce: parsed.nonce })
      }

      // If it's been altered, throw error
      if (payload.request !== storedRequest.request) {
        throw CashId._buildError('RequestAltered', { nonce: parsed.nonce })
      }

      // If it's been consumed, throw error
      if (storedRequest.consumed) {
        throw CashId._buildError('RequestConsumed', { nonce: parsed.nonce })
      }
    }

    // Validate signature
    const sigValid = libCash.BitcoinCash.verifyMessage(
      payload.address,
      payload.signature,
      payload.request
    )

    if (!sigValid) {
      throw CashId._buildError('ResponseInvalidSignature')
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
      throw CashId._buildError('ResponseMissingMetadata', { nonce: parsed.nonce, fields: missingFields })
    }

    // Mark the original request as consumed
    if (!userInitiated) {
      storedRequest.status = CashId.getStatusCode('AuthenticationSuccessful')
      storedRequest.consumed = new Date()
      storedRequest.payload = payload
      await this.adapter.set(payload.nonce, storedRequest)
    }

    // If we made it through return success
    return Object.assign({
      nonce: parsed.nonce
    }, storedRequest)
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

module.exports = CashIdServer
