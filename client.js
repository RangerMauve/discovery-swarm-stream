var Duplex = require('readable-stream').Duplex
var DiscoverySwarmStream = require('./')

/*
Create map of [streamid] => [node stream]
Emit handshaking event when getting the `open` event
Emit the connection and connection-closed events
Peer info objects look similar, but use `-1` for the port and use the ID to hex as the host. Initiator is always false. Type is `proxy`
*/ 

module.exports = class DiscoverySwarmClient {
	constructor(options, stream) {
		this._protocol = new DiscoverySwarmStream(stream)
		this.connecting = 0;
		this.queued = 0;
		this.connected = 0;

		if(options.stream)
			this._replicate = options.stream
	}

	_handle_open(streamid, channel) {
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

		var replicationStream = this._replicate(info);
		var self = this

		self.emit('handshaking', stream, info)

		replicationStream.once('handshake', function(remoteId) {
			var remoteIdHex = remoteId.toString('hex')
			info.id = remoteId
			self.emit('connection', stream, info)
		})

		replicationStream.pipe(stream).pipe(replicationStream)
	}

	join(key, options, cb) {
		if(!cb && (typeof options === 'function')) {
			cb = options
		}
		this._protocol.join(key)
		cb()
	}
	leave(key) {
		this._protocol.leave(key)
	}
	listen() {
		// No-op
	}
	_replicate(info) {
		// Do the default handshake thing for replication
	}
}

class ProxyStream extends Duplex{
	constructor(protocol, id) {
		this._id = id
		this._protocol = protocol
		this._isClosed = false;
		this.handle_data = this._handle_data.bind(this)
		this.handle_close = this._handle_close.bind(this)

		this._protocol.on('swarm:data', this._handle_data)
		this._protocol.on('swarm:close', this._handle_close)
	}
	_handle_data(streamid, data) {
		// See if the event was for this stream
		if(this._isId(streamid)) {
			this.push(data)
		}
	}
	_handle_close(streamid) {
		if (this._isId(streamid)) {
			this.end(data)
			this.emit('close')
			this._cleanup()
		}
	}
	_cleanup() {
		this._isClosed = true
		this._protocol.removeListener('swarm:data', this._handle_data)
		this._protocol.removeListener('swarm:close', this._handle_close)
	}
	_isId(streamid) {
		return streamid.toString('hex') === this._id.toString('hex')
	}
	_read() {}
	_write(chunk, encoding, callback) {
		this._protocol.streamData(this._id, chunk)
		callback()
	}
	_final(callback) {
		if(!this._isClosed) {
			this._protocol.closeStream(this._id)
			this._cleanup()
		}
		callback()
	}
}