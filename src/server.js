const CashId = require('./cashid')

const LibCash = require('@developers.cash/libcash-js')
const libCash = new LibCash()

class CashIdServer {
  /**
   * Class for use with CashID Services.
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
        delete: async (nonce) => {
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
   * @param {Object} opts The options for creating the request
   * @param {String} opts.action The action to be performed (e.g. "auth", "login", etce
   * @param {Array} opts.required Array of required metadata fields as strings
   * @param {Array} opts.optional Array of optional metadata fields as string
   * @param {String} opts.data Data to attach to action
   * @param {Object} store Extra data to store along with request
   * @example
   * let cashIdReq = cashId.createRequest({
   *   action: 'auth',
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
  async createRequest (opts, store = {}) {
    // Set domain and path
    opts.domain = this.domain
    opts.path = this.path

    // Create random nonce (if not specified manually)
    if (!opts.nonce) {
      opts.nonce = Math.floor(Math.random() * (1 + 999999999 - 0)) + 0
    }

    // Create the CashID URL
    const url = CashId.createRequestURL(opts)

    // Store this request (with a timestamp)
    const storedRequest = Object.assign(store, {
      request: url,
      timestamp: new Date()
    })
    await this.adapter.set(opts.nonce, storedRequest)

    return Object.assign({
      nonce: opts.nonce
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
    const userInitiated = ['delete', 'revoke', 'logout', 'update'].includes(parsed.action)

    // Default stored request to the parsed request
    let storedRequest = parsed

    // If this is a user-initiated request...
    if (userInitiated) {
      // Treat nonce as a timestamp and make sure within past 15m
      const currentTime = Math.floor(new Date().getTime() / 1000) + 60 // Accomodate to variance in server-clocks by adding 60s
      const recentTime = currentTime - 60 * 15

      // If timestamp isn't within 15m window
      if (parsed.nonce < recentTime || parsed.nonce > currentTime) {
        throw CashId._buildError('RequestInvalidNonce', { nonce: parsed.nonce })
      }
    } else { // If this is a server-generated request (e.g. "auth", "login", etc)
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

    // If it's invalid, throw error
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

    // If some are missing, throw error
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
}

module.exports = CashIdServer
