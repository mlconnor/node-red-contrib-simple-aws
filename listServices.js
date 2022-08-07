const dir = './node_modules/aws-sdk/apis/' 
const AWS = require('aws-sdk')

const fs = require('fs')
let files = fs.readdirSync(dir)
   .filter(f => { return f.indexOf(".min.json") >= 0 })
   .map(f => {
     let file = JSON.parse(fs.readFileSync(dir + f, 'utf8'))
     return file
   })

let validServices = Object.keys(AWS)
//console.log(validServices)
var sAndMeta = files.map(f => {
  let sid = f.metadata.serviceId.replaceAll(' ', '')
  let actualId = validServices.find(s => { return s.toLowerCase() == sid.toLowerCase() })

  return { serviceId: actualId, listed: f.metadata.serviceId, apiVersion: f.metadata.apiVersion, operations: Object.keys(f.operations).map(o => o.substring(0,1).toLowerCase() + o.substring(1)) }
})

sAndMeta.sort((a,b) => { return a.serviceId < b.serviceId ? -1 : a.serviceId > b.serviceId ? 1 : 0})
console.log(JSON.stringify(sAndMeta))
return

let valid = []
sAndMeta.filter(s => s.serviceId).forEach(s => {
  //console.log(s)
  try {
    let service = new AWS[s.serviceId]({apiVersion:s.apiVersion})
    valid.push(s)
  } catch(e) {
    //console.log("unable to construct " + s.serviceId + " " + e)
  }
})
sAndMeta.forEach(v => delete v.listed)


//console.log(JSON.stringify(sAndMeta))
sAndMeta.forEach(s => { 
  console.log('    <option value="' + s.serviceId + ':' + s.apiVersion + '">' + s.serviceId + ' ' + s.apiVersion + '</option>')
})

