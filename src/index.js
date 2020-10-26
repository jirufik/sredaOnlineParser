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
import isMultCinema from "./utils/isMultCinema";

const config = require("../config");
const graylog = new Graylog({
  port: config.graylog.port,
  address: config.graylog.address,
  host: config.graylog.host,
  node: config.graylog.node,
});

const TIMEOUT = config.timeouts.updateFilms;

async function addFilm({film, filmsModel, processId}) {

  const prefix = film.tmdb ? 'tmdb.' : '';

  const code = pathExists(film, `${prefix}id`);
  const name = pathExists(film, 'filmName');
  const year = pathExists(film, 'year', moment().format('YYYY'));
  const tagline = pathExists(film, `${prefix}tagline`);
  const country = pathExists(film, `${prefix}country`);
  const age = pathExists(film, 'age');
  const about = pathExists(film, `${prefix}about`);
  const genre = pathExists(film, `${prefix}genre`);
  const producer = pathExists(film, `${prefix}producer`);
  const img = pathExists(film, `${prefix}img`);
  const idTmdb = pathExists(film, `${prefix}id`, 0);
  const vote = pathExists(film, `${prefix}vote`);
  const runtime = pathExists(film, `${prefix}runtime`);
  const originalName = pathExists(film, `${prefix}originalName`);

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

  const prefix = film.tmdb ? 'tmdb.' : '';

  const filmCode = pathExists(film, `${prefix}id`);
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

async function processNotFoundInTMDB({film, filmsModel, processId}) {

  const name = pathExists(film, 'filmName', '');
  if (!isMultCinema(name)) {

    graylog.error({
      message: `Film not found; name: ${name}`,
      processId,
      film
    });

    return;

  }

  try {

    const code = await filmsModel.getCodeForMultCinema({name});
    film.id = code;
    film.age = 0;
    film.about = 'Мультики для юных зрителей';
    film.img = 'https://st.kp.yandex.net/im/poster/3/5/2/kinopoisk.ru-MULT-v-kino-116-Leto-prishlo-3522901.jpg';
    film.vote = 0;
    film.runtime = 0;
    film.tagline = '';
    film.originalName = '';
    film.country = ['Россия'];
    film.genre = ['Мультфильм', 'Детский'];

  } catch (error) {

    graylog.error({
      message: `Error in processNotFoundInTMDB; film name: ${name}`,
      processId,
      film,
      error
    });

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

      if (info) {
        film.tmdb = info;
      } else {
        await processNotFoundInTMDB({film, filmsModel, processId});
      }

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

Promise.resolve()
  .then(updateFilms)
  .catch(e => console.log(e));

// setInterval(async () => {
//   await updateFilms();
// }, TIMEOUT);