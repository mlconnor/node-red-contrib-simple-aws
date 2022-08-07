const dir = './node_modules/aws-sdk/apis/' 
const AWS = require('aws-sdk')

const fs = require('fs')
let files = fs.readdirSync(dir)
   .filter(f => { return f.indexOf(".min.json") >= 0 })
   .map(f => {
     let file = JSON.parse(fs.readFileSync(dir + f, 'utf8'))
     return file
   })

let paginators = {}
const paginatorRex = /^([^-]+)-(\d{4}-\d{2}-\d{2}).paginators.json$/
fs.readdirSync(dir)
   .filter(f =>  f.match(paginatorRex))
   .forEach(f => {
     try {
       let file = JSON.parse(fs.readFileSync(dir + f, 'utf8'))
       let nameMatch = f.match(paginatorRex)
       let pagination = {}
       //console.log("pag", file)
       for ( let key in file.pagination ) {
         let val = file.pagination[key]
         //console.log("key", key, "val", val)
         pagination[key.substring(0,1).toLowerCase() + key.substring(1)] = val
       }
       paginators[nameMatch[1] + '-' + nameMatch[2]] = pagination
       //console.log("PAG", nameMatch[1], nameMatch[2])
     } catch(e) { "failed on " + f + " " + e }
   })


// paginators
// sso-oidc-2019-06-10.paginators.json

let validServices = Object.keys(AWS)
//console.log(validServices)
var sAndMeta = files.map(f => {
  //console.log("uid", f.metadata)
  let sid = f.metadata.serviceId.replaceAll(' ', '')
  let actualId = validServices.find(s => { return s.toLowerCase() == sid.toLowerCase() })

  let paginatorKey = (sid + '-' + f.metadata.apiVersion).toLowerCase()
  //console.log("key=" + paginatorKey)
  if ( paginatorKey in paginators ) {
   // console.log("found " + paginatorKey)
  }

  return { serviceId: actualId, listed: f.metadata.serviceId, apiVersion: f.metadata.apiVersion, operations: Object.keys(f.operations).map(o => o.substring(0,1).toLowerCase() + o.substring(1)) }
})

console.log("paginators: " + Object.keys(paginators).length)
fs.writeFileSync('paginators.json', JSON.stringify(paginators))

sAndMeta.sort((a,b) => { return a.serviceId < b.serviceId ? -1 : a.serviceId > b.serviceId ? 1 : 0})
//console.log(JSON.stringify(sAndMeta))

console.log("services: " + Object.keys(sAndMeta).length)
fs.writeFileSync('services.json', JSON.stringify(sAndMeta))
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

