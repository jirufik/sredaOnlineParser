import df from "../dialogflow/dialogflow";
import moment from 'moment'
import pathExists from 'jrf-path-exists'

const ACTION_FILM_INFO = 'filmInfo';
const COST_COLLECTIVE = 180;
const ID_COLLECTIVE = 5;

const MONTHS = {

  'янв': {
    name: 'январь',
    number: 1,
    jsNumber: 0,
    strNumber: '01'
  },

  'фев': {
    name: 'февраль',
    number: 2,
    jsNumber: 1,
    strNumber: '02'
  },

  'мар': {
    name: 'март',
    number: 3,
    jsNumber: 2,
    strNumber: '03'
  },

  'апр': {
    name: 'апрель',
    number: 4,
    jsNumber: 3,
    strNumber: '04'
  },

  'май': {
    name: 'май',
    number: 5,
    jsNumber: 4,
    strNumber: '05'
  },

  'июн': {
    name: 'июнь',
    number: 6,
    jsNumber: 5,
    strNumber: '06'
  },

  'июл': {
    name: 'июль',
    number: 7,
    jsNumber: 6,
    strNumber: '07'
  },

  'авг': {
    name: 'август',
    number: 8,
    jsNumber: 7,
    strNumber: '08'
  },

  'сен': {
    name: 'сентябрь',
    number: 9,
    jsNumber: 8,
    strNumber: '09'
  },

  'окт': {
    name: 'октябрь',
    number: 10,
    jsNumber: 9,
    strNumber: '10'
  },

  'ноя': {
    name: 'ноябрь',
    number: 11,
    jsNumber: 10,
    strNumber: '11'
  },

  'дек': {
    name: 'декабрь',
    number: 12,
    jsNumber: 11,
    strNumber: '12'
  },

};

export class TextProcessor {

  constructor({logger, processId}) {
    this._logger = logger;
    this._processId = processId;
  }

  async processTexts(texts) {

    texts = this._fixSessionTimes(texts);

    const films = {};
    for (const text of texts) {
      await this._processText(text, films);
    }

    return films;
  }

  _fixSessionTimes(texts) {
    return [...texts.map(text => text.replace(/J/g, '1'))];
  }

  async _processText(text, films) {
    text = text.split('\n');
    text = this._deleteBadWords(text);
    this._logger.info({message: 'Text before delete bad word', text, processId: this._processId});
    await this._getFilms(text, films);
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

  async _getFilms(text, films) {

    let hall, period;

    for (const el of text) {

      const currentHall = hall;
      hall = this._getHall(el, currentHall);
      if (currentHall !== hall) {
        continue;
      }

      if (!period) {
        period = await this._getPeriod(el);
        if (period) {
          continue;
        }
      }

      await this._fillFilms({films, hall, period, tickets: el});

    }

  }

  _getHall(text, currentHall) {

    const isNotHall = !text.trim().toLowerCase().includes('зал');
    if (isNotHall) {
      return currentHall;
    }

    const isBigHall = text.trim().toLowerCase().includes('бол');
    if (isBigHall) {
      return 1;
    }

    const isSmallHall = text.trim().toLowerCase().includes('мал');
    if (isSmallHall) {
      return 2;
    }

    return currentHall;

  }

  async _getPeriod(textMessage) {

    const sessionId = 'sredaOnline';
    let res = await df.sendTextMessage({textMessage, sessionId});

    res = pathExists(res, '[0].queryResult');
    const action = pathExists(res, 'action');
    const params = pathExists(res, 'parameters.fields');

    const startMonth = pathExists(params, 'startMonth.stringValue');
    const endMonth = pathExists(params, 'endMonth.stringValue');

    const startDayOfMonth = pathExists(params, 'startDayOfMonth.stringValue');
    const endDayOfMonth = pathExists(params, 'endDayOfMonth.stringValue');
    const daysOfMonth = pathExists(params, 'daysOfMonth.stringValue');

    const year = pathExists(params, 'year.stringValue');

    const noPeriod = action !== 'period';
    if (noPeriod) {
      // const data = {textMessage, res};
      // this._logger.warning({message: `The text does not contain period data`, data, processId: this._processId});
      return;
    }

    const months = this._getMonths({startMonth, endMonth});
    const dates = this._getDates({months, daysOfMonth, startDayOfMonth, endDayOfMonth, year});

    return dates;

  }

  _getMonths({startMonth, endMonth}) {

    const start = this._getMonth(startMonth);
    const end = this._getMonth(endMonth);

    const one = !end || start.number === end.number;
    if (one) return [start];

    let add = false;
    const months = [];
    const keys = Object.keys(MONTHS);

    for (const key of keys) {

      const month = MONTHS[key];

      const onAdd = month.number === start.number;
      if (onAdd) add = true;

      if (add) months.push(month);

      const offAdd = add && month.number === end.number;
      if (offAdd) break;

    }

    return months;

  }

  _getMonth(month) {

    month = month.trim().toLowerCase();
    const keys = Object.keys(MONTHS);
    month = keys.find(key => month.includes(key));
    if (!month) return;

    return {...MONTHS[month]};

  }

  _getDates({months, daysOfMonth, startDayOfMonth, endDayOfMonth, year}) {

    year = year || moment().format('YYYY');
    const dates = [];

    if (daysOfMonth) {

      const days = daysOfMonth.replace(/ /g, '').split(',');
      const month = months[0].strNumber;
      days.forEach(day => dates.push(moment(`${day}.${month}.${year}`, 'DD.MM.YYYY').format('DD.MM.YYYY')));

      return dates;

    }

    const first = months[0];
    const last = months[months.length - 1];
    const oneMonth = months.length === 1;

    // let startDay = Number(startDayOfMonth);
    // let endDay = oneMonth ? Number(endDayOfMonth) : moment(`${year}-${first.strNumber}`, `YYYY-MM`).daysInMonth();

    for (const month of months) {

      const isFirst = month.number === first.number;
      const isLast = month.number === last.number;

      const startDay = isFirst ? Number(startDayOfMonth) : 1;
      const endDay = isLast ? Number(endDayOfMonth) : moment(`${year}-${month.strNumber}`, `YYYY-MM`).daysInMonth();

      for (let i = startDay; i <= endDay; i++) {
        const date = moment(`${i}.${month.strNumber}.${year}`, 'DD.MM.YYYY');
        dates.push(date.format('DD.MM.YYYY'));
      }

    }

    return dates;

  }

  async _fillFilms({films, hall, period, tickets}) {

    const filmInfo = await this._getFilmInfo(tickets);
    if (!filmInfo) {
      return;
    }

    const sessionTime = filmInfo.sessionTime;
    const filmName = filmInfo.nameFilm;
    const age = filmInfo.age;
    const price1 = filmInfo.price1;
    const price2 = filmInfo.price2;
    const keyFilm = filmName.replace(/ /g, '').replace(/\u00A0/g, '');

    if (!films[keyFilm]) {
      films[keyFilm] = {schedule: [], filmName, age};
    }

    for (const day of period) {

      const date = moment(`${day} ${sessionTime}`, 'DD.MM.YYYY HH:mm');
      const tickets = this._fillTickets({date, price1, price2});

      for (const ticket of tickets) {

        films[keyFilm].schedule.push({
          date,
          hall,
          ticket: ticket.id,
          cost: ticket.cost
        });

      }

    }

  }

  async _getFilmInfo(textMessage) {
    const sessionId = 'sredaOnline';
    let res = await df.sendTextMessage({textMessage, sessionId});

    res = pathExists(res, '[0].queryResult');
    const action = pathExists(res, 'action');
    const params = pathExists(res, 'parameters.fields');

    if (action !== ACTION_FILM_INFO) {
      this._logger.warning({
        message: `The text does not contain film info`,
        data: textMessage,
        processId: this._processId
      });
      return;
    }

    const filmInfo = {};

    const sessionTime = this._getFilmInfoPart({params, namePart: 'sessionTime'});
    if (!sessionTime) {
      this._logger.error({
        message: `The text does not contain session time`,
        data: textMessage,
        processId: this._processId
      });
      return;
    }
    filmInfo.sessionTime = sessionTime;

    let nameFilm = this._getFilmInfoPart({params, namePart: 'nameFilm'});

    if (nameFilm  === 'Реальные пацаны') {
      nameFilm = 'Реальные пацаны против зомби';
    }

    if (nameFilm  === 'Реальные пацаны') {
      nameFilm = 'Реальные пацаны против зомби';
    }

    if (nameFilm === 'Последний богатыры') {
      nameFilm = 'Последний богатырь';
    }

    if (nameFilm === 'Последний богатырь') {
      nameFilm = 'Последний богатырь: корень зла';
    }

    if (!sessionTime) {
      this._logger.error({
        message: `The text does not contain name film`,
        data: textMessage,
        processId: this._processId
      });
      return;
    }
    filmInfo.nameFilm = nameFilm;

    const age = this._getFilmInfoPart({params, namePart: 'age', parseToNumber: true});
    if (!age) {
      this._logger.warning({
        message: `The text does not contain age`,
        data: textMessage,
        processId: this._processId
      });
    } else {
      filmInfo.age = age;
    }

    const price1 = this._getFilmInfoPart({params, namePart: 'price1', parseToNumber: true});
    if (!price1) {
      this._logger.warning({
        message: `The text does not contain price1`,
        data: textMessage,
        processId: this._processId
      });
    } else {
      filmInfo.price1 = price1;
    }

    const price2 = this._getFilmInfoPart({params, namePart: 'price2', parseToNumber: true});
    if (price2) {
      filmInfo.price2 = price2;
    }

    return filmInfo;
  }

  _getFilmInfoPart({params, namePart, parseToNumber = false}) {
    let filmInfoPart = pathExists(params, `${namePart}.stringValue`);
    filmInfoPart = parseToNumber ? parseInt(filmInfoPart) : filmInfoPart;
    return filmInfoPart;
  }

  _fillTickets({date, price1, price2}) {

    const tickets = [];
    const time = date.format('HH:mm');
    const startTime = moment(time, 'HH:mm');
    const endTime = moment('16:59', 'HH:mm');
    const isCollective = startTime <= endTime;

    if (price1 && price2) {
      tickets.push({id: 2, cost: price1});
      tickets.push({id: 1, cost: price2});
    } else if (price1) {
      tickets.push({id: 1, cost: price1});
    }

    const addCollective = isCollective && tickets[0].cost > COST_COLLECTIVE;
    if (addCollective) {
      tickets.push({id: ID_COLLECTIVE, cost: COST_COLLECTIVE});
    }

    return tickets;

  }

}