import Nightmare from 'nightmare'
import moment from 'moment'
import df from "../dialogflow/dialogflow";
import pathExists from 'jrf-path-exists'

const config = require("../../config");

const TIMEOUT = config.parser.timeout;
const URL = config.parser.vkUrl;
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

async function getScheduleData({n, graylog, processId}) {

  const res = await n.evaluate(() => {

    const block = document.querySelectorAll('#content > div > div.pages_cont > div');
    const elements = block[0].childNodes;
    const result = [];

    for (const el of elements) {

      const isText = el.nodeName.trim().toLowerCase() === '#text';
      if (isText) {

        const value = el.data.replace(/\n/g, '').trim();
        if (!value) continue;

        result.push({text: true, value});

      }

      const isB = el.nodeName.trim().toLowerCase() === 'b';
      if (isB) {

        const value = el.innerText.replace(/\n/g, '').trim();
        if (!value) continue;

        result.push({text: true, value});

      }

      const isTable = el.nodeName.trim().toLowerCase() === 'table';
      if (isTable) {

        let value = el.innerText;
        if (!value) continue;

        value = value.split('\n').map(el => el.trim()).filter(el => el);

        result.push({table: true, value});

      }

    }

    return result;

  });

  return res;

}

function getMonth(month) {

  month = month.trim().toLowerCase();
  const keys = Object.keys(MONTHS);
  month = keys.find(key => month.includes(key));
  if (!month) return;

  return {...MONTHS[month]};

}

function getMonths({startMonth, endMonth}) {

  const start = getMonth(startMonth);
  const end = getMonth(endMonth);

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

function getDates({months, daysOfMonth, startDayOfMonth, endDayOfMonth, year}) {

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

async function getPeriod({textMessage, graylog, processId}) {

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
    const data = {textMessage, res};
    graylog.warning({message: `The text does not contain period data`, data, processId});
    return;
  }

  const months = getMonths({startMonth, endMonth});
  const dates = getDates({months, daysOfMonth, startDayOfMonth, endDayOfMonth, year});

  return dates;

}

function getHall(text) {

  const isBigHall = text.trim().toLowerCase().includes('бол');
  if (isBigHall) return 1;

  const isSmallHall = text.trim().toLowerCase().includes('мал');
  if (isSmallHall) return 2;

}

async function getFilmName({nameFilm, graylog, processId}) {

  const sessionId = 'sredaOnline';
  const textMessage = `filmName ${nameFilm}`;
  let res = await df.sendTextMessage({textMessage, sessionId});

  res = pathExists(res, '[0].queryResult');

  const action = pathExists(res, 'action');
  const noFilmName = action !== 'filmName';
  if (noFilmName) {
    const data = {textMessage, res};
    graylog.warning({message: `The text does not contain film data`, data, processId});
    return;
  }

  const cinemaType = pathExists(res, 'parameters.fields.cinemaType.stringValue');
  let filmName = pathExists(res, 'parameters.fields.nameFilm.stringValue', '');
  filmName = filmName.replace('filmName', '').trim();
  const age = pathExists(res, 'parameters.fields.age.stringValue');

  return {filmName, age, cinemaType};

}

function getTickets({cost, date}) {

  let costs = cost.split('/');

  if (!costs.length) {
    costs = cost.split('\\');
  }

  const time = date.format('HH:mm');
  const startTime = moment(time, 'HH:mm');
  const endTime = moment('16:59', 'HH:mm');
  const isCollective = startTime <= endTime;

  const tickets = [];

  for (let i = 0; i < costs.length; i++) {

    let cost = costs[i];

    const id = i === 0 ? 1 : 2;
    cost = parseInt(cost);

    tickets.push({id, cost});

  }

  const addCollective = isCollective && tickets[0].cost > COST_COLLECTIVE;
  if (addCollective) {
    tickets.push({id: ID_COLLECTIVE, cost: COST_COLLECTIVE});
  }

  return tickets;

}

async function fillFilms({films, hall, period, tickets, graylog, processId}) {

  while (tickets.length) {

    const time = tickets.shift();
    const nameFilm = tickets.shift();
    const keyFilm = nameFilm.replace(/ /g, '').replace(/\u00A0/g, '');
    const cost = tickets.shift();

    if (!films[keyFilm]) {

      const res = await getFilmName({nameFilm, graylog, processId});
      const filmName = res.filmName;
      const age = res.age;
      const cinemaType = res.cinemaType;

      films[keyFilm] = {schedule: [], filmName, age, cinemaType};

    }

    for (const day of period) {

      const date = moment(`${day} ${time}`, 'DD.MM.YYYY HH:mm');
      const tickets = getTickets({cost, date});

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

}

async function getFilms({n, graylog, processId}) {

  const data = await getScheduleData({n, graylog, processId});

  if (!data) {
    graylog.warning({message: 'No schedule data in VK', processId})
    return;
  }

  graylog.info({message: 'VK html data', data, processId});

  let hall, period;
  const films = {};

  for (const el of data) {

    if (el.text) {

      hall = getHall(el.value);
      if (hall) {
        continue;
      }

      period = await getPeriod({textMessage: el.value, graylog, processId});
      if (period) {
        continue;
      }

      graylog.warning({message: `Failed to process text: ${el.value}`, processId});

    }

    const tickets = el.value;

    await fillFilms({films, hall, period, tickets, graylog, processId});

  }

  graylog.info({message: 'VK parser data', films, processId});

  return films;

}

const vkParse = async ({graylog, processId}) => {

  let n;
  try {

    const nightmare = Nightmare({show: false});
    n = nightmare.goto(URL);
    await n.wait(TIMEOUT);

    // Get films
    let films;
    try {

      films = await getFilms({n, graylog, processId});
      return films;

    } catch (error) {

      graylog.error({error, processId});

    }

  } catch (error) {

    graylog.error({error, processId});

  } finally {

    if (n) {
      await n.end();
    }

  }

}

export default vkParse;