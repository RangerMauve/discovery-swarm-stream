# discovery-swarm-stream
Give access to a discovery swarm instance over a stream.

**THIS IS A WORK IN PROGRESS! NOTHING TO SEE HERE.**

## (Dream) Example

```javascript
// On a server
const DSS = require('discovery-swarm-stream/server')

const swarm = new DSS({
	// swarm options here
	// "stream" option will be ignored since that's processed by the client
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
	connection: socket
	// Could have `stream` here for replication logic
})

swarm.join('wowcool')

swarm.on('connection', function(connection) {
	connection.write('hello!')
})
```

## Plans:

### Protocol

Sent to the server
- connect()
- join(discoveryKey)
- leave(discoveryKey)
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