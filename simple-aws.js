const AWS = require('aws-sdk')

module.exports = function(RED) {
    function SimpleAWSNode(config) {
        console.log("config", config)
        RED.nodes.createNode(this, config);
        var node = this;
		    let awsConfig = RED.nodes.getNode(config.aws);
         
        this.region = awsConfig.region
        /*  
        this.parameterType = config.parameterType
        this.parameter = config.parameter
        this.operation = config.operation
        this.service = config.service
        this.aws = config.aws
        */
		    AWS.config.update({
			    accessKeyId: awsConfig.accessKey,
			    secretAccessKey: awsConfig.secretKey
		    });

        let serviceParams = {}
        if ( config.apiVersion ) {
          serviceParams.apiVersion = config.apiVersion
        }
        if ( this.region ) {
          serviceParams.region = this.region
        }
        console.log("creating new AWS service " + config.service + " with params", serviceParams)
        let client = new AWS[config.service](serviceParams)


        let valid = true
        if ( config.parameterType === 'json' ) {
          try {
            // check this is parsable JSON
            JSON.parse(config.parameter);
          } catch(e) {
            this.error(RED._("change.errors.invalid-json, "));
          }
        } else if ( config.parameterType === 'jsonata') {
          try {
            node.jsonata = RED.util.prepareJSONataExpression(config.parameterType, this);
          } catch(e) {
            valid = false;
            this.error(RED._("change.errors.invalid-expr",{error:e.message}));
          }
        }

        /*
        if (this.awsConfig.proxyRequired){
            var proxy = require('proxy-agent');
            AWS.config.update({
                httpOptions: { agent: new proxy(this.awsConfig.proxy) }
            });
        */

        node.on('input', async function(msg, nodeSend, nodeDone) {
          //console.log("message received", msg, "node", node,"send",nodeSend,"done",nodeDone)
          let operationParam = {}
          switch (config.parameterType) {
            case 'jsonata' :
              operationParam = RED.util.evaluateNodeProperty(config.parameter, config.parameterType, node);
              break
            case 'msg':
              operationParam = RED.util.getMessageProperty(msg,config.parameter);
              break
            case 'json':
              operationParam = JSON.parse(config.parameter)
              break
            default:
              throw "unexpected parameterType " + config.parameterType
          }
          node.status({ fill: "green", shape: "ring", text: "calling " + config.service + ":" + config.operation });
          let combinedResponse = []
          let operationParamCopy = { ... operationParam }

          try {
            let done = false
            let msgCopy = { ...msg }

            while (!done) {
              var response = await client[config.operation](operationParamCopy).promise()
              //console.log("response", response)

              if (config.nextContinuationToken) {
                combinedResponse.push(response)
                if (response[config.nextContinuationToken]) {
                  operationParamCopy[config.continuationToken] = response[config.nextContinuationToken]
                  combinedResponse.push(response)
                  node.status({ fill: "green", shape: "ring", text: "chunk" });
                } else {
                  done = true
                  msgCopy.complete = true
                  msgCopy.payload = combinedResponse
                  node.send(msgCopy)
                  node.status({ fill: "green", shape: "ring", text: "done multi" });
                  nodeDone()
                }
              } else {
                done = true
                msgCopy.complete = true
                msgCopy.payload = response
                node.status({ fill: "green", shape: "ring", text: "done" });
                console.log("sending message", msgCopy)
                node.send(msgCopy)
                nodeDone()
              }
            }
          } catch (err) {
            node.status({ fill: "red", shape: "ring", text: err });
            node.error(err, "error calling " + config.operation + ": " + err);
          }
        });
    }
    RED.nodes.registerType("simple-aws",SimpleAWSNode);
}

