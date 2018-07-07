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
    var stream = options.connection
    if (!stream) throw new TypeError('Must specify `connection` in options')
    this._protocol = new DiscoverySwarmStream(stream)
    this.connecting = 0
    this.queued = 0
    this.connected = 0

    var handleOpen = this._handleOpen.bind(this)
    this._protocol.on('swarm:open', handleOpen)
    this._protocol.connect()

    if (options.stream) { this._replicate = options.stream }
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
    if (!cb && (typeof options === 'function')) {
      cb = options
    }
    this._protocol.join(key)
    cb()
  }
  leave (key) {
    this._protocol.leave(key)
  }
  listen () {
    // No-op, just in case
  }
  _replicate (info) {
    // Do the default handshake thing for replication
  }
}
