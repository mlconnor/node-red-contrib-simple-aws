module.exports = function(RED) {
  function AWSConfigNode(n) {
    RED.nodes.createNode(this,n);
    this.accessKey = this.credentials.accessKey;
    this.secretKey = this.credentials.secretKey;
	    this.region = n.region;
    this.name = n.name;
  }
  RED.nodes.registerType("AWS Config",AWSConfigNode,{credentials: {
     accessKey: {type:"text"},
     secretKey: {type:"password"}
   }});
}

module.exports = function(RED) {
  function AWSConfigNode(n) {
    RED.nodes.createNode(this,n);
    this.accessKey = this.credentials.accessKey;
    this.secretKey = this.credentials.secretKey;
  	  this.region = n.region;
    this.name = n.name;
  }
  RED.nodes.registerType("AWS Config",AWSConfigNode,{credentials: {
    accessKey: {type:"text"},
    secretKey: {type:"password"}
  }});
}
