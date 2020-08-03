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

Install from NPM

```sh
npm install @developers-cash/cashid-js
```

## Typical Service Implementation

A basic server implementation (assuming ExpressJS and a SPA app) might look as follows:

```javascript
// Include
const { CashId, CashIdServer } = require('@developers-cash/cashid-js')

// Instantiate CashID Server
const cashIdServer = new CashIdServer('example.com', '/cashid')

//
// Route: /cashid/create-request
// We need to generate a new nonce for each request.
// Additionally, we use SSE to listen for events.
//
app.get('/cashid', async (req, res) => {
  try {
    const request = cashIdServer.createRequest({ // Options
      action: 'auth',
      required: ['name', 'family', 'email']
    }, { // Extra data to store
      sseSocket: res // Store socket so we can send auth event back to browser
    })
    
    // Let client know it's an SSE (event-stream)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    
    return res.send(JSON.stringify({
      event: 'created',
      url: request.request
    }) + '\n')
  } catch (err) {
    return res.status(500).send({ message: err.message })
  }
})

//
// Route: /cashid/validate-request
// This is the endpoint your Wallet/IdentityManager will send payload to
//
app.post('/cashid', async (req, res) => {
  try {
    // Will throw error if fails
    let storedRequest = cashIdServer.validateRequest(req.body.payload)
    
    // TODO Create user and/or Auth/Session token to send to browser
    const token = 'SOME_TOKEN_TO_AUTH_USER' 
    
    // Emit event back to SEE Listener
    storedReqest.sseSocket.send(JSON.stringify({
      event: 'authenticated',
      token: token
    }) + '\n\n')
    
    // Send response to Wallet/Identity Manager
    return res.status(200).send({ status: 0 })
  } catch (err) {
    return res.status(200).send({ status: err.code, message: err.message })
  }
})
```

The corresponding client-side code may look something like the following:

```html
<a id="cashid-link">Login with CashID</a>

<script>
  // Make sure EventSource (SSE) is supported
  if (window.EventSource) {
    var source = new EventSource('/cashid')

    source.addEventListener('message', function(e) {
      // Parse message
      let msg = JSON.parse(e.data)
      
      // If this is an authentication request
      if (msg.type = 'authenticate') {
        // TODO Render QR Code
        document.getElementById('cashid-link').setAttribute('href', msg.url)
      }
      
      // If this is an authenticated event
      if (msg.type === 'authenticated') {
        // TODO Store token and set UI into logged-in state
        alert('You are now authenticated')
      }
    }, false)
  }
</script>
```

### Notes

- The above server examples will not work correctly behind a Load Balancer as the Socket cannot be shared across servers. Perhaps look at using Redis Storage and its PubSub feature if you need this.

### Resources

[CashID spec](https://gitlab.com/cashid/protocol-specification)

[CashID demo](https://demo.cashid.info/)
