export class TextProcessor {

  constructor({logger, processId}) {
    this._logger = logger;
    this._processId = processId;
  }

  async processTexts(texts) {
    const schedules = [];
    texts = this._fixSessionTimes(texts);

    for (const text of texts) {
      const schedule = await this._processText(text);
      schedules.push(schedule);
    }

    return schedules;
  }

  _fixSessionTimes(texts) {
    return [...texts.map(text => text.replace(/J/g, '1'))];
  }

  async _processText(text) {
    text = text.split('\n');
    text = this._deleteBadWords(text);
    this._logger.info({message: 'Text before delete bad word', text, processId: this._processId});
    console.log(text);
  }

  _deleteBadWords(text) {
    for (let i = 0; i < text.length; i++) {
      const suggestion = text[i];

      const isBadSuggestion = this._isBadSuggestion(suggestion);
      if (!isBadSuggestion) {
        continue
      }

      text.splice(i, 1);
      i--;
    }

    return text;
  }

  _isBadSuggestion(suggestion) {
    suggestion = suggestion.trim().toLowerCase();
    if (!suggestion) {
      return true;
    }

    if (suggestion.includes('киноаф')) {
      return true;
    }

    if (suggestion.includes('телефон касс')) {
      return true;
    }

    if (suggestion.includes('цена за детский')) {
      return true;
    }

    if (suggestion === 'развития') {
      return true;
    }

    if (suggestion === 'среда') {
      return true;
    }

    if (suggestion === 'центр культурного') {
      return true;
    }

    if (suggestion === '0.00') {
      return true;
    }

    if (suggestion === '600') {
      return true;
    }

    if (suggestion === '6,00') {
      return true;
    }

    return false;

  }

}