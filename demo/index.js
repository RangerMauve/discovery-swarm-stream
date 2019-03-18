var net = require('net')
var hyperdrive = require('hyperdrive')
var RAM = require('random-access-memory')

var DSSServer = require('../server')
var DSSClient = require('../client')

// Taken from dat swarm defaults
var DAT_DOMAIN = 'dat.local'
var DEFAULT_DISCOVERY = [
  'discovery1.datprotocol.com',
  'discovery2.datprotocol.com'
]
var DEFAULT_BOOTSTRAP = [
  'bootstrap1.datprotocol.com:6881',
  'bootstrap2.datprotocol.com:6881',
  'bootstrap3.datprotocol.com:6881',
  'bootstrap4.datprotocol.com:6881'
]

var DEFAULT_OPTS = {
  dns: { server: DEFAULT_DISCOVERY, domain: DAT_DOMAIN },
  dht: { bootstrap: DEFAULT_BOOTSTRAP },
  // MAKE SURE YOU ADD THIS!
  hash: false
}

var server = new DSSServer(DEFAULT_OPTS)

var tcpServer = net.createServer((socket) => {
  console.log('Server got connection')
  server.addClient(socket)
})

tcpServer.listen(6669, () => {
  // Dat website key
  var archiveKey = '60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

  addClient('127.0.0.1', 6669, archiveKey)
})

function addClient (hostname, port, archiveKey) {
  var socket = net.connect(port, hostname)

  var archive = hyperdrive(RAM, archiveKey)

  setTimeout(() => {
    console.log('Reading data from archive')
    archive.readFile('/dat.json', 'utf-8', (err, data) => {
      if (err) throw err
      console.log('Got data:', data)
    })
  }, 4000)

  var client = new DSSClient({
    connection: socket,
    stream: (info) => {
      console.log('Client got a peer', info.host)
      var replicationStream = archive.replicate({
        sparse: true,
        live: true
      })

      replicationStream.on('error', (e) => {
        // Ignore replication errors for now
      })

      return replicationStream
    }
  })

  setTimeout(() => {
    client.join(archive.discoveryKey)
  }, 2000)
}
