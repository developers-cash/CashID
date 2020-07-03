# CashID Javaascript

## Quick Pitch

This is a convenient way to login and sign up to websites using Bitcoin Cash as your "identity".

## Description

CashID is an open protocol that allows secure authentication based on the public key cryptography infrastructure that is currently present in the Bitcoin Cash ecosystem. Each user can prove to a service provider that they control a specific Bitcoin Cash address by signing a challenge request, as well as provide optional metadata.

The typical flow might look as follows:

1. Request URI is generated and presented as Link and QR Code.
2. Event Listener is created on page to listen for Authentication Event (Google "Server-side-events", aka SSE)
3. User scans this QR Code using his Identity Manager and grants consent to the requested fields
4. Identity Manager sends payload to endpoint contained in Request URI
5. SSE endpoint sends event (or authentication tokens) to browser upon receiving valid payload.

## Installation

grab from NPM

```sh
npm install cashid
```

## Usage

A typical implementation might look as follows:

```javascript
const CashIDServer = require('cashid').Server

// Instantiate server
const cashID = new CashIDServer("your.host.com", '/cashid/auth')

//
// Route: /cashid/create-request
//
const uri = cashID.createRequest("auth", {
  required: ['name', 'family', 'email']
})

return uri

//
// Route: /cashid/auth
//
return cashID.validateRequest(payload)

//
// Route: /cashid/events (recommend to implement using SSE)
//
```

### Resources

[CashID spec](https://gitlab.com/cashid/protocol-specification)

[CashID demo](https://demo.cashid.info/)
