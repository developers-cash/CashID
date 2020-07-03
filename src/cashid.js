class CashID {
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
      path: '/' + requestURL.pathname.split(/\/(.+)/)[1],
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
        } else {
          throw new Error(`Unsupported field metadataType/code given: ${char}`)
        }
      }

      // Add fields to our parsed object
      parsed[fieldStatus] = fields
    }

    return parsed
  }

  static _buildError (type, contextData = null) {
    const statusCodes = {
      authenticationSuccessful: 0,
      requestBroken: 100,
      requestMissingScheme: 111,
      requestMissingDomain: 112,
      requestMissingNonce: 113,
      requestMalformedScheme: 121,
      requestMalformedDomain: 122,
      requestInvalidDomain: 131,
      requestInvalidNonce: 132,
      requestAltered: 141,
      requestExpired: 142,
      requestConsumed: 143,
      responseBroken: 200,
      responseMissingRequest: 211,
      responseMissingAddress: 212,
      responseMissingSignature: 213,
      responseMissingMetadata: 214,
      responseMalformedAddress: 221,
      responseMalformedSignature: 222,
      responseMalformedMetadata: 223,
      responseInvalidMethod: 231,
      responseInvalidAddress: 232,
      responseInvalidSignature: 233,
      responseInvalidMetadata: 234,
      serviceBroken: 300,
      serviceAddressDenied: 311,
      serviceAddressRevoked: 312,
      serviceActionDenied: 321,
      serviceActionUnavailable: 322,
      serviceActionNotImplemented: 323,
      serviceInternalError: 331
    }

    const humanReadable = type.split(/(?<=[a-z])(?=[A-Z])/).join(' ').toLowerCase()

    return new Error(`${statusCodes[type]}: ${humanReadable}`)
  }
}

module.exports = CashID
