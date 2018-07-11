var discoveryChannel = require('discovery-channel')
var sodium = require('sodium-universal')
var EventEmitter = require('events')
var net = require('net')

var DiscoverySwarmStream = require('./')
var ProxyStream = require('./proxystream')

module.exports = class DiscoverySwarmStreamServer extends EventEmitter {
  constructor (options) {
    super()
    if (!options) {
      options = {}
    }
    this._discovery = discoveryChannel(options)
    this._discovery.on('peer', (key, peer) => {
      this.emit('key:' + key.toString('hex'), key, peer)
    })
    this._discovery.on('close', () => this.emit('close'))

    // List of clients
    this._clients = []
    // Map of weaksets that looks like `subscription -> [clients]`
    this._subs = {}
  }

  destroy (cb) {
    this._discovery.destroy(cb)
    this._clients.forEach((client) => {
      client.destroy()
    })
  }

  addClient (stream) {
    var client = new Client(stream)
    this._clients.push(client)

    // TODO: Add timeout and clear on "connection" packet
    client.once('connection', client.init.bind(client, this))

    return client
  }
}

class Client extends DiscoverySwarmStream {
  constructor (stream) {
    super(stream)
    this._connections = {}
    this._subscriptions = []
    this._doJoin = this._doJoin.bind(this)
    this._doLeave = this._doLeave.bind(this)
    this.connectPeer = this.connectPeer.bind(this)
    this.destroy = this.destroy.bind(this)
  }

  init (swarm) {
    this._swarm = swarm
    this.on('swarm:join', (key) => {
      var stringKey = key.toString('hex')
      this._swarm.on('key:' + stringKey, this.connectPeer)
      this._subscriptions.push(stringKey)
    })
    this.on('swarm:leave', (key) => {
      var stringKey = key.toString('hex')
      this._swarm.removeListener('key:' + stringKey, this.connectPeer)
      this._subscriptions = this._subscriptions.filter((existing) => {
        return existing !== stringKey
      })
    })
    this.once('end', this.destroy)
  }

  destroy () {
    this._connections.forEach((connection) => {
      connection.end()
    })
    this._subscriptions.forEach((key) => {
      this._swarm.removeListener('key:' + key, this.connectPeer)
    })
  }

  connectPeer (key, peer) {
    var url = peer.host + ':' + peer.port

    if (this._connections[url]) {
      return this._connections[url]
    }

    var connection = net.connect(peer.port, peer.host)
    this._connections[url] = connection
    var id = Buffer.allocUnsafe(12) // Cryptographically random data
    sodium.randombytes_buf(id)

    this.openStream(id, key)

    var proxy = new ProxyStream(this, id)

    proxy.on('end', () => connection.end())

    connection.once('end', () => {
      this._connections[url] = null
    })

    connection.pipe(proxy).pipe(connection)
  }
}
