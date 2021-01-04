import {ImageAnnotatorClient} from '@google-cloud/vision';
import axios from 'axios'
import pathExists from 'jrf-path-exists';

const TEXT_DETECTION = 'TEXT_DETECTION';

export class Vision {

  constructor({logger, clientEmail, privateKey, projectId, processId}) {
    this.client = new ImageAnnotatorClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      projectId
    });

    this._logger = logger;
    this._processId = processId;
  }

  async getTextFromWebImgByUrl(url) {
    try {

      const imageBuffer = await this._getImageBufferByUrl(url);
      const imageBase64 = this._convertImageToBase64(imageBuffer);
      const result = await this._sendRequestInVision(imageBase64);
      const text = pathExists(result, '[0].responses[0].fullTextAnnotation.text');

      return text;

    } catch (error) {
      this._logger.error({error, processId: this._processId});
    }
  }

  async _getImageBufferByUrl(url) {
    const res = await axios.get(url, {responseType: 'arraybuffer'});
    return res.data;
  }

  _convertImageToBase64(imageBuffer) {
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    return imageBase64;
  }

  async _sendRequestInVision(imageBase64) {
    const request = this._createRequest(imageBase64);
    const requests = [request];
    const results = await this.client.batchAnnotateImages({requests});
    return results;
  }

  _createRequest(imageBase64) {
    const request = {
      image: {
        content: imageBase64,
      },
      features: [{type: TEXT_DETECTION}],
    };

    return request;
  }

}