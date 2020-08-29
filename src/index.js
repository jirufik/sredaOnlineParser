import ConnectorPG from "./db/conectorPG";
import pathExists from 'jrf-path-exists'
import Halls from "./model/Halls";
import Tickets from "./model/Tickets";
import Films from "./model/Films";
import Schedules from "./model/Schedules";
import Graylog from "jrf-graylog";
import TMDB from "./tmdb";
import generateId from "./utils/generateId";
import vkParse from "./parser/vk";
import moment from "moment";

const config = require("../config");
const graylog = new Graylog({
  port: config.graylog.port,
  address: config.graylog.address,
  host: config.graylog.host,
  node: config.graylog.node,
});

const TIMEOUT = config.timeouts.updateFilms;

async function addFilm({film, filmsModel, processId}) {

  const code = pathExists(film, 'tmdb.id');
  const name = pathExists(film, 'filmName');
  const year = pathExists(film, 'year', moment().format('YYYY'));
  const tagline = pathExists(film, 'tmdb.tagline');
  const country = pathExists(film, 'tmdb.country');
  const age = pathExists(film, 'age');
  const about = pathExists(film, 'tmdb.about');
  const genre = pathExists(film, 'tmdb.genre');
  const producer = pathExists(film, 'tmdb.producer');
  const img = pathExists(film, 'tmdb.img');
  const idTmdb = pathExists(film, 'tmdb.id');
  const vote = pathExists(film, 'tmdb.vote');
  const runtime = pathExists(film, 'tmdb.runtime');
  const originalName = pathExists(film, 'tmdb.originalName');

  const data = {
    code,
    name,
    year,
    tagline,
    country,
    age,
    about,
    genre,
    producer,
    img,
    idTmdb,
    vote,
    runtime,
    originalName
  };

  try {

    await filmsModel.add({
      code,
      name,
      year,
      tagline,
      country,
      age,
      about,
      genre,
      producer,
      img,
      idTmdb,
      vote,
      runtime,
      originalName,
      data
    });

  } catch (error) {

    graylog.error({
      message: `No add film; code: ${code}; name: ${name}`,
      processId,
      data,
      error
    });

  }

}

async function addSchedule({film, scheduleModel, processId}) {

  const filmCode = pathExists(film, 'tmdb.id');
  const name = pathExists(film, 'filmName');
  const schedule = pathExists(film, 'schedule', []);

  for (const session of schedule) {

    const date = session.date.format('YYYY-MM-DD HH:mm:ss');
    const hallId = session.hall;
    const ticketId = session.ticket;
    const cost = session.cost;
    const data = {date, filmCode, hallId, ticketId, cost};

    try {

      await scheduleModel.add({date, filmCode, hallId, ticketId, cost});

    } catch (error) {

      graylog.error({
        message: `No add session; code: ${filmCode}; name: ${name}`,
        processId,
        data,
        error
      });

    }

  }

}

async function updateFilms() {

  const processId = generateId();

  const host = pathExists(config, 'postgres.host');
  const port = pathExists(config, 'postgres.port');
  const user = pathExists(config, 'postgres.user');
  const password = pathExists(config, 'postgres.password');
  const database = pathExists(config, 'postgres.database');

  const postgres = new ConnectorPG({host, port, user, password, database});
  await postgres.testConnect();

  const tmdb = new TMDB({graylog, processId});
  const start = Date.now();

  graylog.info({message: 'start parse', processId});

  try {

    graylog.info({message: 'start parse vk sreda online', processId});

    const films = await vkParse({graylog, processId});

    const endParse = Date.now();
    let time = endParse - start;
    graylog.info({message: 'end parse vk sreda online', processId, data: {time}});

    const noFilms = !films;
    if (noFilms) return;

    const filmsModel = new Films({postgres});
    const scheduleModel = new Schedules({postgres});

    for (const film of Object.values(films)) {

      const name = film.filmName;
      const year = moment().format('YYYY');
      const info = await tmdb.getInfo({name, year});
      film.tmdb = info;

      graylog.info({message: `film: ${name}`, film, processId});

      await addFilm({film, filmsModel, processId});
      await addSchedule({film, scheduleModel, processId});

    }

  } catch (error) {

    graylog.error({error, processId});

  } finally {

    try {

      const time = Date.now() - start;
      graylog.info({message: 'end parse', processId, data: {time}});

      await postgres.end();

    } catch (error) {

      graylog.error({error, processId});
      const time = Date.now() - start;
      graylog.info({message: 'end parse', processId, data: {time}});

    }

  }

}

// Promise.resolve()
//   .then(updateFilms)
//   .catch(e => console.log(e));

setInterval(async () => {
  await updateFilms();
}, TIMEOUT);