# Discovery Swarm Stream

Alows clients to use [discovery-channel](https://github.com/maxogden/discovery-channel) to discover and connect to peers.

Clients connect to the server (thos module provides a default WS implementation), search for "discovery keys", and the proxy automatically discovers and connects to peers and then proxies those connections to the client.

If two clients are discovering the same key, the proxy can connect them to each other

Requires:

- ES6 classes
- Arrow functions
- Weak Sets (server only)

**THIS IS A WORK IN PROGRESS! Please report any bugs you encounter in the issue tracker.**

## Example

```javascript
// On a server
const DSS = require('discovery-swarm-stream/server')

const swarm = new DSS({
	// swarm options here
	// Doesn't support UTP for now
})

const httpServer = require('http').createServer()
httpServer.listen(4200)

const server = require('websocket-stream').createServer({server: httpServer}, (ws) => {
	swarm.handleConnection(ws)
})

// On a client
const DSS = require('discovery-swarm-stream/client')

const socket = require('websocket-stream')('ws://localhost:4200')

const swarm = new DSS({
	connection: socket,
	stream: (connection) => connection.write('hello!')
})

swarm.join('wowcool')

swarm.leave('wowcool')
```

Check out `demo/index.js` for an example of how this can be used with hyperdrive.

### Protocol

Sent to the server
- connect
- join(discoveryKey)
- leave(discoveryKey)

Sent from the server
- streamOpen(streamID)

Sent from either end
- streamData(streamId, data)
- streamClose(streamId)

### Behind the scenes
- Take a discovery-swarm instance
- When getting a new connection
	- Find out how many clients want it's advertising keys
	- If only one exists, proxy the connection to it
	- I multiples exist, create new connections per client and proxy them
- Client side will get streams and should do handshaking on them themselves