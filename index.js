var Duplex = require('readable-stream').Duplex
var lps = require('length-prefixed-stream')
var messages = require('./messages')

/*
Events:

`swarm:connect` Emitted when client connects to server, used to verify it's sane
`swarm:join` `(key)` Emitted by the client to get the server to join a swarm for the given key
`swarm:leave` `(key)` Emitted by the client to get the server to leave a swarm for the given key
`swarm:open` `(id, key)` Emitted by the server when a new peer is connected for a given key. The `id` is unique per peer, and `key` is the channel key
`swarm:close` `(id)` Emitted by the server when a peer's connection has closed.
`swarm:data` `(id, data)` Emtited by the server or the client when data is being sent down a stream
*/

module.exports = class DiscoverySwarmStream extends Duplex {
  constructor (stream) {
    super()

    // There's going to be a lot of listeners
    this.setMaxListeners(256)

    stream
      .pipe(lps.decode())
      .pipe(this)
      .pipe(lps.encode())
      .pipe(stream)
  }

  sendEvent (type, id, data) {
    this.push(messages.SwarmEvent.encode({
      type: messages.EventType[type],
      id: id,
      data: data
    }))
  }

  connect () {
    this.sendEvent('CONNECT')
  }

  join (discoveryKey) {
    this.sendEvent('JOIN', discoveryKey)
  }

  leave (discoveryKey) {
    this.sendEvent('LEAVE', discoveryKey)
  }

  openStream (streamId, channel) {
    this.sendEvent('OPEN', streamId, channel)
  }

  closeStream (streamId) {
    this.sendEvent('CLOSE', streamId)
  }

  streamData (streamId, data) {
    this.sendEvent('DATA', streamId, data)
  }

  _write (chunk, encoding, callback) {
    try {
      var decoded = messages.SwarmEvent.decode(chunk)
      switch (decoded.type) {
        case (messages.EventType.CONNECT): this.emit('swarm:connect'); break
        case (messages.EventType.JOIN): this.emit('swarm:join', decoded.id); break
        case (messages.EventType.LEAVE): this.emit('swarm:leave', decoded.id); break
        case (messages.EventType.OPEN): this.emit('swarm:open', decoded.id, decoded.data); break
        case (messages.EventType.CLOSE): this.emit('swarm:close', decoded.id); break
        case (messages.EventType.DATA) : this.emit('swarm:data', decoded.id, decoded.data); break
      }
      callback()
    } catch (e) {
      callback(e)
    }
  }

  _read () {}
}
