var http = require('http');
const dns = require('dns');
const whois = require('whois');

var fs = require('fs');


const { workerData, parentPort } = require("worker_threads");



// constants etc getting from parent file.
const WORLD_LIST = workerData.arrayData;
const WORKER_ID = workerData.workerNum;
const WORD_COUNT = WORLD_LIST.length;
const EXTENSION = workerData.extension;
const OUTPUT_FILE = workerData.output_file;
const MAX_WORD_LENGTH = workerData.max_word_length;



var stream = fs.createWriteStream(OUTPUT_FILE, {flags:'a'});


// main function to do the job
async function checkWordList() {

  for(var index = 0 ; index < WORD_COUNT ; index++) {

    // domain to be checked
    const domain = WORLD_LIST[index] + EXTENSION;

    const result = await checkDomainAvailable(domain);

    // if all results seem good, log as available
    if (result[0] == 1 && result[1] == 1 && result[2] == 1) {
      stream.write(domain + " ".repeat(MAX_WORD_LENGTH - domain) +' available. \n');
      sendMessage({message: 'domain-available'});
    }
    // if it isn't available, just update the counter
    else {
      sendMessage({message: 'worker-update'});
    }
  }

  // send our worker done here
  sendMessage({message: 'worker-done', workerID: WORKER_ID});
  
}

checkWordList();



function sendMessage(message) {
  parentPort.postMessage(message);
}


async function checkDomainAvailable(domain) {

    // our results array to hold the results, default all 0 meaning not available
    let results = [0, 0, 0];


    await checkDNS(domain)
      .then(available => {
        if (available) {
          results[0] = 1;
        } 
      }
      ).catch(error => {
      console.error('Error occurred while checking domain DNS availability:', error.message);
      }
    );

    await checkHTTP(domain)
      .then(available => {
        if (available) {
          results[1] = 1;
        } 
      }
      ).catch(error => {
      console.error('Error occurred while checking domain HTTP availability:', error.message);
      }
    );

    await checkWHOIS(domain)
      .then(available => {
        if (available) {
          results[2] = 1;
        } 
      }
      ).catch(error => {
      console.error('Error occurred while checking domain WHOIS availability:', error.message);
      }
    );
    
    // print out domain name and results
    const outlog = domain + ": " + " ".repeat(MAX_WORD_LENGTH+5-domain.length) + " dns=" + results[0] + " http=" + results[1] + " whois=" + results[2] + resultString(results, domain);
    process.stdout.write(outlog);
    return(results);
    
}


// get OK or X according to results
function resultString(results, domain) {
  if(results[0] == 1 && results[1] == 1 && results[2] == 1) {
    return " | OK  " + domain + " available."
  }
  return " | X";
}


// these are all trying whether domain available or not, errors being counted as available
// otherwise you've got tons of errors while checking, prefer avoiding errors.

async function checkHTTP(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      host: domain,
      path: '/',
    };

    const request = http.request(options, (response) => {
      // Domain is accessible, regardless of the response status
      resolve(false);
    });

    request.on('error', (error) => {
      // An error occurred during the HTTP request
      if (error.code === 'ECONNRESET') {
        // Domain didn't respond, treat as available
        resolve(true);
      } else {
        // Other errors, consider domain not available
        resolve(true);
      }
    });
    request.end();
  });
}


async function checkWHOIS(domain) {
  return new Promise((resolve, reject) => {
    whois.lookup(domain, (err, data) => {
      if (err) {
        // An error occurred during the WHOIS lookup
        resolve(true);
      } else {
        const isAvailable = !checkAvailabilityWHOIS(data);
        resolve(isAvailable);
      }
    });
  });
}


async function checkDNS(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveAny(domain, (err, addresses) => {
      if (err) {
        // An error occurred during the DNS lookup
        resolve(true);
      } else {
        const isAvailable = addresses.length === 0;
        resolve(isAvailable);
      }
    });
  });
}

function checkAvailabilityWHOIS(whoisData) {
  // Check for specific indicators in the WHOIS data to determine availability
  const beingUsed = !(whoisData.includes('No match for domain') || whoisData.includes('Domain not found.')) ||
  whoisData.includes('This name is reserved by the Registry');

  return beingUsed;
}