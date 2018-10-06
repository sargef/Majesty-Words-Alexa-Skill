const Alexa = require('ask-sdk'); // Using the default Alexa Skills Kit SDK v2 for Node 8.10
const https = require('https'); // For making an HTTPS Request
const HELP_MESSAGE = 'You can say, What does happy mean?';
const HELP_REPROMPT = 'What can i help you with?';
const STOP_MESSAGe = 'Goodbye';

// Oxford Dictionary specific information -- CONFIDENTIAL
const oxford_app_id = 'YOUR APP ID GOES HERE-KEEP PRIVATE'; // ENTER THIS VALUE
const oxford_app_key = 'YOUR APP KEY GOES HERE-KEEP PRIVATE'; // ENTER THIS VALUE

const oxford_api_host = 'od-api.oxforddictionaries.com';
const oxford_api_path = '/api/v1/entries/en/'; // Make sure there is a trailing / in the path.


// The Launch Request Handler - it is called when the skill initialises without any intent
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'Welcome to majesty. Ask me the meaning of any word.';
    const repromptSpeechText = 'What word would you like to ask me about?';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptSpeechText)
      .getResponse();
  },
};


const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(STOP_MESSAGE)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

// The OxfordIntent - when the user says "what is the meaning of the word XXXX"
// Then this handler initialises, connects to the Oxford Dictionary API and
// Gets the information
const OxfordIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'OxfordIntent';
  },
  async handle(handlerInput) {
    const itemSlot = handlerInput.requestEnvelope.request.intent.slots.Word;

    // Get the slot information (the word for the dictionary) and save it under itemName
    let itemName;
    if (itemSlot && itemSlot.value) {
      itemName = itemSlot.value.toLowerCase();
    }

    // Now Search the Oxford Dictonary through its API and get the total words
    const params = {
      host: oxford_api_host,
      path: oxford_api_path + itemName,
      port: 443,
      method: 'GET',
      headers: {
        "Accept": "application/json",
        "app_id": oxford_app_id,
        "app_key": oxford_app_key
      }
    };

    // The output that you get from the Oxford API - which is a JSON encoded format
    const output = await httpRequest(params);

    // The total number of results for the word (itemName)
    const count = (output.results[0].lexicalEntries[0].entries[0].senses).length;

    // What follows is an if/else statement. Depending on the results, the total content is played
    // Note that I didn't use 'const' but 'let' because the speechText value will keep on changing
    let speechText = "";
    if (count > 1) {
      speechText += "There are " + count + " definitions of the word " + output.results[0].id + '. <break time="1s" />';
    }
    else if (count == 1) {
      speechText += "There is " + count + " definition of the word " + output.results[0].id + '. <break time="1s" />';
    }
    else if (count == 0) {
      speechText += "No definition found or the word is not understood. The word was " + itemName;
    }

    // Only modify the speech text further with definitions if there is any definition available
    if (count >= 1) {
      for (let counter = 0; counter < count; counter++) {

        let num = counter + 1;

        if (count == 1) {
          speechText += "The definition is, " + output.results[0].lexicalEntries[0].entries[0].senses[0].definitions[0] + '<break time="0.5s" />';
        }
        else {
          speechText += num + ". " + output.results[0].lexicalEntries[0].entries[0].senses[counter].definitions[0] + '<break time="0.5s" />';
        }

        if (output.results[0].lexicalEntries[0].entries[0].senses[counter].hasOwnProperty('examples')) {
          speechText += "Example: " + output.results[0].lexicalEntries[0].entries[0].senses[counter].examples[0].text + '. <break time="1.2s" />';
        }
        else {
          speechText += 'There is no example available for this definition. <break time="1.2s" />';
        }
      } // for loop closed
    }

    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse();
  },
};



const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command.')
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    OxfordIntentHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();


// Function  for making an HTTPS Request
// For this function the https module is used, along with
// Promises & Async/Await functions which are available in Node 8.10
// In the older version of Node, 6.10, the callbacks were used
async function httpRequest(params, postData) {
  return new Promise(function(resolve, reject) {
    var req = https.request(params, function(res) {
      // reject on bad status
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error('statusCode=' + res.statusCode));
      }
      // cumulate data
      var body = [];
      res.on('data', function(chunk) {
        body.push(chunk);
      });
      // resolve on end
      res.on('end', function() {
        try {
          body = JSON.parse(Buffer.concat(body).toString());
        }
        catch (e) {
          reject(e);
        }
        resolve(body);
      });
    });
    // reject on request error
    req.on('error', function(err) {
      // This is not a "Second reject", just a different sort of failure
      reject(err);
    });
    if (postData) {
      req.write(postData);
    }
    // IMPORTANT
    req.end();
  });
}
