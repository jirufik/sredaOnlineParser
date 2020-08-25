import dialogflow from '@google-cloud/dialogflow';

const config = require("../../config");

class Dialogflow {

  constructor({projectId, privateKey, clientEmail}) {

    this.projectId = projectId;

    const credentials = {
      private_key: privateKey,
      client_email: clientEmail
    };

    this.sessionClient = new dialogflow.SessionsClient({credentials});

  }

  async sendTextMessage({textMessage, sessionId, languageCode = 'ru'}) {

    const sessionPath = this.sessionClient.projectAgentSessionPath(this.projectId, sessionId);

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: textMessage,
          languageCode
        }
      }
    };

    const res = await this.sessionClient.detectIntent(request);

    return res;
  }

}

const df = new Dialogflow({
  projectId: config.dialogflow.project_id,
  privateKey: config.dialogflow.private_key,
  clientEmail: config.dialogflow.client_email
});

export default df;

