var EventEmitter = require('events')

var DiscoverySwarmStream = require('./')
var ProxyStream = require('./proxystream')

/*
  Create map of [streamid] => [node stream]
  Emit handshaking event when getting the `open` event
  Emit the connection and connection-closed events
  Peer info objects look similar, but use `-1` for the port and use the ID to hex as the host. Initiator is always false. Type is `proxy`
*/

module.exports = class DiscoverySwarmClient extends EventEmitter {
  constructor (options) {
    super()
    var connection = options.connection
    if (!connection) throw new TypeError('Must specify `connection` in options')
    this.connecting = 0
    this.queued = 0
    this.connected = 0

    this._handleOpen = this._handleOpen.bind(this)
    this._handleEnd = this._handleEnd.bind(this)

    if (options.stream) {
      this._replicate = options.stream
    }

    this._channels = new Set()

    this.reconnect(connection)
  }

  reconnect (connection) {
    if (this._protocol) {
      this._protocol.removeListener('close', this._handleEnd)
      this._protocol.end()
    }
    this._protocol = new DiscoverySwarmStream(connection)
    this._protocol.on('swarm:open', this._handleOpen)
    this._protocol.connect()
    this._protocol.once('close', this._handleEnd)

    for (let key of this._channels) {
      this.join(key)
    }
  }

  _handleEnd () {
    this._protocol = null
    this.emit('disconnected')
  }

  _handleOpen (streamid, channel) {
    var stream = new ProxyStream(this._protocol, streamid)
    // Save locally
    var info = {
      type: 'proxy',
      initiator: false,
      id: null,
      host: streamid.toString('hex'),
      port: -1,
      channel: channel
    }

    var replicationStream = this._replicate(info)
    var self = this

    self.emit('handshaking', stream, info)

    replicationStream.once('handshake', function (remoteId) {
      if (remoteId) {
        var remoteIdHex = remoteId.toString('hex')
        info.id = remoteIdHex
      }
      self.emit('connection', stream, info)
    })

    replicationStream.pipe(stream).pipe(replicationStream)
  }

  join (key, options, cb) {
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex')
    }
    if (!cb && (typeof options === 'function')) {
      cb = options
    }
    this._protocol.join(key)

    this._channels.add(key.toString('hex'))
    if (cb) cb()
  }

  leave (key, cb) {
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex')
    }

    this._protocol.leave(key)

    this._channels.delete(key.toString('hex'))

    if (cb) cb()
  }

  listen () {
    // No-op, just in case
  }

  close (cb) {
    this._protocol.end(cb)
  }

  _replicate (info) {
    // TODO: Do the default handshake thing for replication
    throw new Error('Missing `stream` in options')
  }
}
