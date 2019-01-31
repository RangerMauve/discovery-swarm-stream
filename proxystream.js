var Duplex = require('readable-stream').Duplex

module.exports = class ProxyStream extends Duplex {
  constructor (protocol, id) {
    super()
    this._id = id
    this._protocol = protocol
    this._isClosed = false
    this._handle_data = this._handleData.bind(this)
    this._handle_close = this._handleClose.bind(this)

    this._protocol.on('swarm:data', this._handle_data)
    this._protocol.on('swarm:close', this._handle_close)
  }
  _handleData (streamid, data) {
    // See if the event was for this stream
    if (this._isId(streamid)) {
      this.push(data)
    }
  }
  _handleClose (streamid) {
    if (this._isId(streamid)) {
      this.end()
      this.emit('close')
      this._cleanup()
    }
  }
  _cleanup () {
    this._isClosed = true
    this._protocol.removeListener('swarm:data', this._handle_data)
    this._protocol.removeListener('swarm:close', this._handle_close)
  }
  _isId (streamid) {
    return streamid.toString('hex') === this._id.toString('hex')
  }
  _read () { }
  _write (chunk, encoding, callback) {
    this._protocol.streamData(this._id, chunk)
    callback()
  }
  _final (callback) {
    if (!this._isClosed) {
      this._protocol.closeStream(this._id)
      this._cleanup()
    }
    callback()
  }
}
