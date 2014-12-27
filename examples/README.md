node-red-contrib-coap examples
==============================

CoAP Server written in Node-RED
-------------------------------

**Prerequisites:**

- [coap-cli](https://www.npmjs.com/package/coap-cli)

Import *server_flow.json* to your *Node-RED* instance and start red.js. Then, call the server with command line:

```bash
coap get coap://localhost/hello
```

**Observer (CoAP client) written in Node-RED**

Start *observe_server.js*. Then import *client_flow.json* to your *Node-RED* instance and start *red.js*.
