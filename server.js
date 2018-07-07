var discoveryChannel = require('discovery-channel')
var net = require('net')

var DiscoverySwarmStream = require('./')
var ProxyStream = require('./proxystream')

module.exports = class DiscoverySwarmStreamServer {
  constructor (options) {
    if (!options) {
      options = {}
    }
    this._discovery = discoveryChannel(options)

    // List of clients
    this._clients = []
    // Map of weaksets that looks like `subscription -> [clients]`
    this._subs = {}
  }

  destroy () {
    // Destroy all clients and discovery swarm
  }

  _onPeer (id, peer) {
    // Find the clients that want this id from the subMap
    // Pick a random subset of them
    // Open connections for each client to the peer and proxy them
  }

  _onClientSubscribe (client, key) {
    // Add to subMap for the key
    // See if any clients are already subscribed to this
    // Connect to a random subset of them
    // Invoke discovery.join(key)
  }

  _onClientUnsubscribe (client, key) {
    // Remove the client from the subMap
  }

  _proxyClient (client, peer, key) {
    var connection = net.connect(peer.port, peer.host)
    var id = null // TODO generate a random ID
    client.openStream(id, key)

    var proxy = new ProxyStream(client, id)

    proxy.on('end', () => connection.end())

    connection.pipe(proxy).pipe(connection)
  }

  _addSub (client, key) {
    var existing = this._subs[key]
    if (!existing) {
      existing = []
      this._subs[key] = existing
    }
    existing.push(client)
  }

  _removeSub (client, key) {

  }

  _removeCleint (client) {
    // Remove from all subs lists
  }

  addClient (stream) {
    var client = new DiscoverySwarmStream(stream)
    this._clients.push(client)

    // TODO: Add timeout and clear on "connection" packet
    client.once('connection', () => {
      // Listen to client events here
    })
  }
}
