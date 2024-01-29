const { Worker } = require("worker_threads");
var fs = require('fs');
const readline = require('readline');
const e = require("express");


const INPUT_FILE  = 'example-words.txt';
const OUTPUT_FILE = 'available-domains-all.txt';
const WORKER_FILE = './worker.js';

const THREAD_COUNT = 16;
const DOMAIN_EXTENSION = '.com';

// start & end point of words list
// if your
const START_POINT = 1000;
var END_POINT = 2000;


const MAX_WORD_LENGTH = 11;

// indicators, dont change them
var WORD_COUNT = 0;
var PROGRESS = 1;
var CURSOR_POINT = 2;
var WORKERS_DONE = 0;


async function checkWordsForDomain() {
  try {

    var totalReadenWordList = [];

    // here we created a promise and it wont end untill we resolve or reject it!
    await new Promise((resolve, reject) => {
      var lineReader = readline.createInterface({
        input: fs.createReadStream(INPUT_FILE)
      });
  
      lineReader.on('error', (err) => {
        console.log(`An error occured while reading the file : ${INPUT_FILE}`);
        reject(err);
      });

      lineReader.on('line', function (line) {
        totalReadenWordList.push(line);
      });
  
      lineReader.on('close', function () {
          resolve();
      });
    });

    // total words found
    console.log('Total words found:', totalReadenWordList.length);

    // if user entered end_point bigger than the word count, make it word count
    if(END_POINT >= totalReadenWordList.length) {
      END_POINT = totalReadenWordList.length;
    }

    // read all the words and slice accordingly
    const wordList = await totalReadenWordList.slice(START_POINT, END_POINT);
    const wordCount = wordList.length;

    // assign word count to be used in progress later
    WORD_COUNT = wordCount;

    // slice the word list in chunks cause we are using threads
    let wordListChunks = [];

    for(var i = 0 ; i < THREAD_COUNT ; i++) {
      wordListChunks.push(wordList.slice(Math.floor(wordCount * i * (1 / THREAD_COUNT)), 
                                         Math.floor(wordCount * (i+1) * (1 / THREAD_COUNT))));
    }

    console.log('\n ');
    const workerPromises = [];
    for (let i = 0; i < THREAD_COUNT; i++) {
      workerPromises.push(createWorker(wordListChunks[i], i));
    }
    await Promise.all(workerPromises);
  }
  catch(e) {
    console.log(e.message);
  }
}




function progress(data) {
  const {message} = data;
  readline.cursorTo(process.stdout, 35 + MAX_WORD_LENGTH, CURSOR_POINT);

  // if domain not available, log the progress
  if(message == 'worker-update') {
    process.stdout.write('[' + PROGRESS + '/' + WORD_COUNT + ']' +" ".repeat(30) + '\n');
  }
  // if domain available dont log the progress
  else if(message == 'domain-available'){
    process.stdout.write('\n');
  }
  // if worker is done
  else if(message == 'worker-done') {
    ++WORKERS_DONE;
    readline.cursorTo(process.stdout, 0, CURSOR_POINT);
    process.stdout.write('Worker - ' + data.workerID + ' is done\n');
    if(WORKERS_DONE === THREAD_COUNT) {
      process.stdout.write('All workers are done!\n');
    }
    ++CURSOR_POINT;
    return;
  }
  ++CURSOR_POINT;
  ++PROGRESS;
}

// create and listen workers here
function createWorker(domainlist, num) {
    const workerData = { arrayData: domainlist , 
                         workerNum: num, 
                         extension: DOMAIN_EXTENSION,
                         output_file: OUTPUT_FILE,
                         max_word_length: MAX_WORD_LENGTH};
    return new Promise(function (resolve, reject) {
      const worker = new Worker(WORKER_FILE, { workerData });
      worker.on("message", (data) => {
        progress(data);
      });
      worker.on("error", (msg) => {
        console.log(msg);
        reject(`An error ocurred: ${msg}`);
      });
    });
  }

checkWordsForDomain();
