/* used for testing, remove this file later */
const coap    = require('coap') // or coap
    , server  = coap.createServer();

function getPayload() {
    var timestamp = Math.round(new Date().getTime() / 1000);
    var payload = {
        id: 'pump_1',
        states: {
            pressure_in: timestamp,
            pressure_out: timestamp,
            voltage: timestamp,
            current: timestamp,
            temperature: timestamp
        }
    };
    return JSON.stringify(payload);
}

server.on('request', function(req, res) {
    res.setOption('Content-Format', 'application/json')
    

    if (req.headers['Observe'] !== 0)
      return res.end(getPayload());
    
    var interval = setInterval(function() {
      res.write(getPayload());
    }, 1000);

    res.on('finish', function(err) {
      clearInterval(interval)
    });
});

server.listen(function() {
  console.log('server started');
});