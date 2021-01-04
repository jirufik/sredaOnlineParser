const vision = require('@google-cloud/vision');

export class Vision {

  constructor({logger, clientEmail, privateKey, projectId}) {
    this._logger = logger;

    this.client = new vision.ImageAnnotatorClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      projectId
    });
  }

}