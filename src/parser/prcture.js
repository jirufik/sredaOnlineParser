import {Vision} from "../vision/vision";
import Graylog from "jrf-graylog";
import {TextProcessor} from "../textProcessor/textProcessor";

const config = require("../../config");

const graylog = new Graylog({
  port: config.graylog.port,
  address: config.graylog.address,
  host: config.graylog.host,
  node: config.graylog.node,
});

export class PictureParser {

  constructor({logger, processId}) {
    this._logger = logger;
    this._processId = processId;
    this._vision = this._initVision();
    this._textProcessor = this._initTextProcessor();
  }

  _initVision() {
    const vision = new Vision({
      logger: this._logger,
      privateKey: config.vision.privateKey,
      clientEmail: config.vision.clientEmail,
      projectId: config.vision.projectId,
      processId: this._processId
    });

    return vision;
  }

  _initTextProcessor() {
    const textProcessor = new TextProcessor({
      logger: this._logger,
      processId: this._processId
    });

    return textProcessor;
  }

  async parseWebImages() {

    this._logger.info({message: 'Start parse web images', processId: this._processId});

    const urls = config.images;
    this._logger.info({message: 'Web image urls', urls, processId: this._processId});

    const texts = await this._parseWebImageByUrls(urls);
    if (!texts || !texts.length) {
      this._logger.error({message: 'No text in web images', processId: this._processId});
      return;
    }
    this._logger.info({message: 'Web image texts', texts, processId: this._processId});

    const films = await this._textProcessor.processTexts(texts);

    this._logger.info({message: 'End parse web images', processId: this._processId});

    return films;
  }

  async _parseWebImageByUrls(urls) {

    const texts = [];

    const promises = urls.map((url) => {
      return (async () => {
        const text = await this._vision.getTextFromWebImgByUrl(url);
        texts.push(text);
      })();
    });
    await Promise.all(promises);

    return texts;
  }

}

// const parser = new PictureParser({logger: graylog, processId: 'test'});
// Promise.resolve()
//   .then(async () => await parser.parseWebImages())
//   .catch(e => console.error(e));