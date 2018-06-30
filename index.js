var stream = require('readable-stream')
var lps = require('length-prefixed-stream')
var messages = require('./messages')

module.exports = function protocol(stream) {
	var protocolStream = new DiscoverySwarmStream();

	stream
		.pipe(lps.decode())
		.pipe(protocolStream)
		.pipe(lps.encode())
		.pipe(stream);

	return protocolStream;
}

class DiscoverySwarmStream {
	constructor(options) {
		super(options)
	}

	sendEvent(type, id, data) {
		this.push(messages.SwarmEvent.encode({
			type: messages.EventType[type],
			id: id,
			data: data
		}))
	}

	connect() {
		this.sendEvent("CONNECT")
	}

	join(discoveryKey) {
		this.sendEvent("JOIN", discoveryKey)
	}

	leave(discoveryKey) {
		this.sendEvent("LEAVE", discoveryKey)
	}

	openStream(streamId) {
		this.sendEvent("OPEN", streamId)
	}

	closeStream(streamId) {
		this.sendEvent("CLOSE", streamId)
	}

	streamData(streamId, data) {
		this.sendEvent("DATA", streamId, data);
	}

	_write(chunk, encoding, callback) {
		try {
			var decoded = messages.SwarmEvent.decode(chunk)
			switch(decoded.type) {
				case (messages.EventType.CONNECT): this.emit("swarm:connect"); break;
				case (messages.EventType.JOIN): this.emit("swarm:join", decoded.id); break;
				case (messages.EventType.LEAVE): this.emit("swarm:leave", decoded.id); break;
				case (messages.EventType.OPEN): this.emit("swarm:open", decoded.id); break;
				case (messages.EventType.CLOSE): this.emit("swarm:close", decoded.id); break;
				case(messages.EventType.DATA) : this.emit("swarm:data", decoded.id, decoded.data); break;
			}
		} catch(e) {
			callback(e);
		}
	}

	_read() {}
}