var DSS = require('./client')

var hyperdrive = require('hyperdrive')
var RAM = require('random-access-memory')
var websocket = require('websocket-stream')

// Beaker browser website key
var archiveKey = '87ed2e3b160f261a032af03921a3bd09227d0a4cde73466c17114816cae43336'

var archive = hyperdrive(RAM, archiveKey)

var socket = websocket('ws://localhost:3495')

function replicate (info) {
  // In a multi-archive scenario you'd want to look up which archive should be used via info.channel
  return archive.replicate({
    sparse: true,
    live: true
  })
}

var swarm = DSS({
  connection: socket,

  // Override this so that it does handshaking through the replication stream
  stream: replicate
})

swarm.join(archive.discoveryKey.toString('hex'))
