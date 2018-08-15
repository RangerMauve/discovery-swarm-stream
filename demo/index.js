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
  server.addClient(socket)
})

tcpServer.listen(6669, () => {
  // Beaker browser website key
  var archiveKey = '87ed2e3b160f261a032af03921a3bd09227d0a4cde73466c17114816cae43336'

  addClient('127.0.0.1', 6669, archiveKey)
})

function addClient (hostname, port, archiveKey) {
  var socket = net.connect(port, hostname)

  var archive = hyperdrive(RAM, archiveKey)

  archive.metadata.update((err) => {
    if (err) return
    archive.readFile('/index.html', 'utf-8', (err, data) => {
      if (err) return
      console.log('Got data:', data)
    })
  })

  var client = new DSSClient({
    connection: socket,
    stream: (info) => {
      var replicationStream = archive.replicate({
        sparse: true,
        live: true
      })

      replicationStream.on('error', (e) => {
        console.error('Replication error', info, e)
      })

      return replicationStream
    }
  })

  setTimeout(() => {
    client.join(archive.discoveryKey)
  }, 2000)
}
