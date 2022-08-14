const AWS = require('aws-sdk')
const paginators = require('./resources/paginators.json')

module.exports = function(RED) {
    function SimpleAWSNode(config) {
        //console.log("config", config)
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

        let serviceOptions = {}
        try {
          if ( config.serviceOptions && config.serviceOptions.trim() > 0 ) {
            serviceOptions = JSON.parse(config.serviceOptions)
          }
        } catch (e) {
          let eMsg = "service options were not valid JSON"
          node.status({ fill: "red", shape: "ring", text: sMsg })
          node.error(e, eMsg)
        }
        if ( config.apiVersion ) {
          serviceOptions.apiVersion = config.apiVersion
        }
        if ( this.region ) {
          serviceOptions.region = this.region
        }
        //console.log("creating new AWS service " + config.service + " with params", serviceOptions)
        let client = null
        try {
          client = new AWS[config.service](serviceOptions)
        } catch (e) {
          let eMsg = "error instantiating AWS service " + config.service + "(" + config.apiVersion + ":" + config.operation + " " + e.message
          node.status({ fill: "red", shape: "ring", text: eMsg})
          node.error(e, eMsg);
        }

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
            let eMsg = "error parsing JSONata expression " + config.service + "(" + config.apiVersion + ":" + config.operation + " " + e.message
            node.status({ fill: "red", shape: "ring", text: eMsg})
            node.error(e, eMsg);
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
          let msgCopy = { ...msg }
          try {
            switch (config.parameterType) {
              case 'jsonata' :
                operationParam = RED.util.evaluateNodeProperty(config.parameter, config.parameterType, node, msg);
                break
              case 'msg':
                operationParam = RED.util.getMessageProperty(msg,config.parameter);
                break
              case 'json':
                operationParam = JSON.parse(config.parameter)
                break
              default:
                throw "Unexpected config parameter type " + config.parameterType

            }
          } catch (e) {
            let eMsg = "AWS parameter to " + config.service + ":" + config.operation + " was malformed. " + e.message
            msgCopy.error = e
            msgCopy.errorMsg = eMsg
            node.status({ fill: "red", shape: "ring", text: eMsg})
            node.error(eMsg);
            node.send([null, msgCopy])
            return
          }

          node.status({ fill: "green", shape: "ring", text: "calling " + config.service + ":" + config.operation });
          
          let operationParamCopy = { ... operationParam }

          try {
            let done = false


            while (!done) {
              var response = await client[config.operation](operationParamCopy).promise()
              msgCopy.payload = response
              if ( config.paging !== 'disabled' && paginatorDef && response[paginatorDef.output_token]) {
                //console.log(`paginating ${config.service}:${config.operation} on ${paginatorDef.output_token}`)
                operationParamCopy[paginatorDef.input_token] = response[paginatorDef.output_token]
                delete msgCopy.complete
                node.send([msgCopy, null])
              } else {
                done = true
                msgCopy.complete = true
                node.status({ fill: "green", shape: "ring", text: "done" });
                node.send([msgCopy, null])
                nodeDone()
              }
            }
          } catch (e) {
            let eMsg = `Error while calling ${config.service}:${config.operation} ${e.message}`
            msgCopy.error = e
            msgCopy.errorMsg = eMsg
            node.status({ fill: "red", shape: "ring", text: e });
            node.error(e, `error calling ${config.service}:${config.operation} ${e}`);
            node.send([null, msgCopy])
          }
        });
    }
    RED.nodes.registerType("simple-aws",SimpleAWSNode);
}

