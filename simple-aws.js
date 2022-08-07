const AWS = require('aws-sdk')
const paginators = require('./paginators.json')

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

        /* let's handle the payload parameter */
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

        /* let's deal with the paginators here */
        let paginatorsDef = paginators[config.service.toLowerCase() + '-' + config.apiVersion]
        let paginatorDef = paginatorsDef ? paginatorsDef[config.operation] : null
        //console.log("pagDefs", paginatorsDef, "pagDef", paginatorDef,"op", config.operation)
        

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
          
          let operationParamCopy = { ... operationParam }

          try {
            let done = false
            let msgCopy = { ...msg }

            while (!done) {
              var response = await client[config.operation](operationParamCopy).promise()
              //console.log("response", response)
              msgCopy.payload = response
              //console.log("paginator", paginatorDef)
              if ( paginatorDef && response[paginatorDef.output_token]) {
                operationParamCopy[paginatorDef.input_token] = response[paginatorDef.output_token]
                msgCopy.complete = false
                node.send(msgCopy)
              } else {
                done = true
                msgCopy.complete = true
                node.status({ fill: "green", shape: "ring", text: "done" });
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

