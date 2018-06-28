var discoverySwarm = require('discovery-swarm')

function DiscoverySwarmStream(options) {
	discoverySwarm.prototype._onconnection = handleconnection

	discoverySwarm.call(this, options);
	// Initialize map of clients
	// Initialize map of weaksets to map subscription -> [clients]
}

DiscoverySwarmStream.prototype = util.inherits(DiscoverySwarmStream, discoverySwarm)

DiscoverySwarmStream.prototype.handleConnection = function (ws) {
	/*
	 * Add client to map, should look like 
	 * Listen on close to remove from map and close any streams
	 * Start processing messages, add listeners for listen/unlisten/close
	 */
}

// Modified from discovery-swarm
DiscoverySwarmStream.prototype._onconnection = function (connection, type, peer) {
	var self = this

	// internal variables used for debugging
	connection._debugId = ++connectionDebugIdCounter
	connection._debugStartTime = Date.now()

	var info = {
		type: type,
		initiator: !!peer,
		id: null,
		host: peer ? peer.host : connection.remoteAddress,
		port: peer ? peer.port : connection.remotePort,
		channel: peer ? peer.channel : null
	}

	this.emit('handshaking', connection, info)

	connection.on('close', onclose)
	self.connections.push(connection)
	self.emit('connection', connection, info)

	// Find which clients want data from this peer
	// Proxy to the first one
	// If more exist, open more connections to the peer

	function onclose() {
		self.totalConnections--
		self.emit('connection-closed', connection, info)

		var i = self.connections.indexOf(connection)
		if (i > -1) {
			var last = self.connections.pop()
			if (last !== connection) self.connections[i] = last
		}
	}
}