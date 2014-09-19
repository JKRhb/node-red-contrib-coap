/* used for testing, remove this file later */
const coap    = require('coap') // or coap
    , cbor    = require('cbor')
    , server  = coap.createServer();

coap.registerFormat('application/cbor', 60);

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
    return payload;
}

server.on('request', function(req, res) {
    
    console.log(req.payload);
    
    var encode;
    
    if (req.headers['Content-Format'] === 'application/json') {
        res.setOption('Content-Format', 'application/json');
        encode = JSON.stringify;
        payload = JSON.parse(req.payload);
        console.log(payload);
        
    } else if(req.headers['Content-Format'] === 'application/cbor') {
        res.setOption('Content-Format', 'application/cbor');
        encode = cbor.encode;
        cbor.decode(req.payload, function(err, payload) {
            console.log(payload[0]);
        });
    }

    if (req.headers['Observe'] !== 0)
      return res.end(encode(getPayload()));
    
    var interval = setInterval(function() {
      res.write(encode(getPayload()));
    }, 1000);

    res.on('finish', function(err) {
      clearInterval(interval)
    });
});

server.listen(function() {
  console.log('server started');
});