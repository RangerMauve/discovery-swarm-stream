var sodium = require('sodium-universal')
var EventEmitter = require('events')
var net = require('net')
var createDiscovery = require('hyperdiscovery')
var DiscoverySwarmStream = require('./')
var ProxyStream = require('./proxystream')

module.exports = class DiscoverySwarmStreamServer extends EventEmitter {
  constructor (options) {
    super()
    if (!options) {
      options = {}
    }

    this.connectExistingClients = !!options.connectExistingClients
    this._discovery = createDiscovery(options)

    // I am not proud of this code
    const createStream = options.stream || this._discovery._createReplicationStream.bind(this._discovery)
    this._discovery._swarm._stream = (info) => {
      const stream = createStream(info)

      stream.on('feed', (key) => {
        this.emit('key:' + key.toString('hex'), key, info)
      })

      return stream
    }

    this._discovery.on('close', () => this.emit('close'))

    // List of clients
    this._clients = []
    // Map of weaksets that looks like `subscription -> [clients]`
    this._subs = {}
  }

  _joinClient (key, client) {
    if (!this._subs[key]) {
      this._subs[key] = []
    }

    var subs = this._subs[key]

    subs.push(client)

    this.join(key)
  }

  _leaveClient (key, client) {
    var subs = this._subs[key]

    if (!subs) return

    var index = subs.indexOf(client)
    if (index === -1) return

    subs.splice(index, 1)

    if (!subs.length) {
      this.leave(key)
    }
  }

  join (key) {
    this._discovery._swarm.leave(key)
    this._discovery._swarm.join(key)
  }

  leave (key) {
    this._discovery._swarm.leave(key)
  }

  subscribedClients (key) {
    var subs = this._subs[key]
    return subs || []
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
    client.once('swarm:connect', client.init.bind(client, this))
    client.once('close', () => {
      this._clients.splice(this._clients.indexOf(client), 1)
    })

    return client
  }
}

class Client extends DiscoverySwarmStream {
  constructor (stream) {
    super(stream)
    this._connections = {}
    this._subscriptions = []
    this.connectTCP = this.connectTCP.bind(this)
    this.destroy = this.destroy.bind(this)

    var id = Buffer.allocUnsafe(12) // Cryptographically random data
    sodium.randombytes_buf(id)
    this.id = id

    stream.once('close', this.destroy.bind(this))
  }

  init (swarm) {
    this._swarm = swarm

    this.on('swarm:join', (key) => {
      var stringKey = key.toString('hex')
      this._swarm.on('key:' + stringKey, this.connectTCP)
      this._subscriptions.push(stringKey)
      this._swarm._joinClient(key, this)

      // Don't connect clients together unless you need it
      // This is to encourage connections through WebRTC
      if (!this._swarm.connectExistingClients) return

      var existing = this._swarm.subscribedClients(key)

      existing.forEach((client) => {
        // Don't connect to yourself
        if (client === this) return
        this.connectClient(key, client)
      })
    })

    this.on('swarm:leave', (key) => {
      var stringKey = key.toString('hex')
      this._swarm.removeListener('key:' + stringKey, this.connectTCP)
      this._subscriptions = this._subscriptions.filter((existing) => {
        return existing !== stringKey
      })
      this._swarm._leaveClient(key, this)
    })
  }

  destroy () {
    Object.keys(this._connections).forEach((id) => {
      var connection = this._connections[id]
      if (connection) {
        connection.end()
      }
    })
    this._subscriptions.forEach((stringKey) => {
      const key = Buffer.from(stringKey, 'hex')
      this._swarm.removeListener('key:' + stringKey, this.connectTCP)
      this._swarm._leaveClient(key, this)
    })
  }

  connectStream (key, stream, peerId) {
    var id = Buffer.allocUnsafe(12) // Cryptographically random data
    sodium.randombytes_buf(id)

    this.openStream(id, key)

    var proxy = new ProxyStream(this, id)

    proxy.on('close', () => stream.end())

    stream.once('close', () => {
      this._connections[peerId] = null
    })

    stream.once('error', () => {
      proxy.end()
      this._connections[peerId] = null
    })

    stream.pipe(proxy).pipe(stream)
  }

  connectClient (key, client) {
    var id = key + ':' + client.id

    if (this._connections[id]) {
      return this._connections[id]
    }

    var otherProxy = new ProxyStream(client, key)

    this.connectStream(key, otherProxy, id)
  }

  connectTCP (key, peer) {
    var id = peer.id || (key + ':' + peer.host + ':' + peer.port)
    if (this._connections[id]) {
      return this._connections[id]
    }

    var connection = net.connect(peer.port, peer.host)
    this._connections[id] = connection

    this.connectStream(key, connection, id)
  }

  toString () {
    return this.id.toString()
  }
}
