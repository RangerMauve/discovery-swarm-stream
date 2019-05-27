# Discovery Swarm Stream

Alows clients to use [discovery-channel](https://github.com/maxogden/discovery-channel) to discover and connect to peers.

Clients connect to the server, search for "discovery keys", and the proxy automatically discovers and connects to peers and then proxies those connections to the client.

If two clients are discovering the same key, the proxy can connect them to each other if you set the `connectExistingClients` on the server.

By default it supports connections for the [hypercore-protocol](https://github.com/mafintosh/hypercore-protocol) used in [Dat](https://datproject.org/). If you'd like to support a different protocol, provide a `stream` argument that conforms to what's expected in [discovery-swarm](https://www.npmjs.com/package/discovery-swarm#var-sw--swarmopts).

Requires:

- ES6 classes
- Arrow functions
- Weak Sets (server only)

## Example

```javascript
// On a server
const DSS = require('discovery-swarm-stream/server')

const swarm = new DSS({
	// Hash topics through sha1 before passing them through
	defaultHash: false,

	// Use the default discovery-swarm handshaking
	defaultHandshake: false,

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
const websocket = require('websocket-stream')

const socket = websocket('ws://localhost:4200')

const swarm = new DSS({
	connection: socket,
	stream: (connection) => connection.write('hello!')
})

swarm.join('wowcool')

swarm.leave('wowcool')

// If you want to add auto-reconnect logic
swarm.on('disconnected', () => {
	swarm.reconnect(websocket('ws://localhost:4200'))
})

setTimeout(() => {
	swarm.close()
}, 10000)
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
