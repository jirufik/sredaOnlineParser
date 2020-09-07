import pathExists from 'jrf-path-exists'
import {xor} from 'lodash'

export default class Films {

  constructor({postgres}) {

    this.postgres = postgres;

  }

  async add({code, name, year, tagline, country, age, about, genre, producer, img, data, idTmdb, vote, runtime, originalName}) {

    const films = await this.get({code});

    const values = [];

    if (!films || !films.length) {

      const text = `INSERT INTO films(code, name, year, tagline, country, age, about, genre, producer, img, data, created, version, vote, original_name, id_tmdb, runtime)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 1, $12, $13, $14, $15) RETURNING * ;`;

      values.push(code);
      values.push(name);
      values.push(year);
      values.push(tagline);
      values.push(country);
      values.push(age);
      values.push(about);
      values.push(genre);
      values.push(producer);
      values.push(img);
      values.push(data);
      values.push(vote);
      values.push(originalName);
      values.push(idTmdb);
      values.push(runtime);

      const res = await this.postgres.query({text, values});

      return res.rows;

    }

    const film = pathExists(films, '[0]');
    if (!film) return;

    const update = this._update({
      film,
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
    });

    if (update) {
      const res = await this.edit({
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
        version: film.version
      });
      return res;
    }

    return [film];

  }

  async get({code}) {

    if (!this.postgres) throw new Error('Not initialized postgres');

    const strWhere = [];
    let valueNumber = 0;
    const values = [];

    if (code) {
      strWhere.push(`code = $${++valueNumber}`);
      values.push(code);
    }

    let text = `SELECT * FROM films`;
    text += strWhere.length ? ` WHERE ${strWhere.join(' AND ')}` : '';
    text += ';';

    const res = await this.postgres.query({text, values});

    return res.rows;

  }

  async edit({code, name, year, tagline, country, age, about, genre, producer, img, data, idTmdb, vote, runtime, originalName, version}) {

    const films = await this.get({code});

    const film = pathExists(films, '[0]');
    if (!film) throw new Error(`Not fount film with code: ${code}`);

    const curVersion = film.version;
    const badVersion = version !== curVersion;
    if (badVersion) {
      throw new Error(`Film has already been updated current version: ${curVersion}, our version: ${version}. Last update: ${film.updated}`);
    }

    const values = [];

    const text = `UPDATE films SET (name, year, tagline, country, age, about, genre, producer, img, data, updated, version, vote, original_name, id_tmdb, runtime) 
                  = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15)
                  WHERE code = ${code} RETURNING * ;`;

    values.push(name);
    values.push(year);
    values.push(tagline);
    values.push(country);
    values.push(age);
    values.push(about);
    values.push(genre);
    values.push(producer);
    values.push(img);
    values.push(data);
    values.push(++version);
    values.push(vote);
    values.push(originalName);
    values.push(idTmdb);
    values.push(runtime);

    const res = await this.postgres.query({text, values});

    return res.rows;

  }

  async getCodeForMultCinema({name}) {

    const text = `
    with t as (select (select code from films where name = '${name}') AS found_code)
    select found_code, 
    (case when found_code is not null then found_code
    else (select coalesce(max(code) + 1, 1) as code from films where code < 1000)
    end) as code
    from t;
    `;

    const res = await this.postgres.query({text});

    return pathExists(res, 'rows[0].code');

  }

  _update({film, name, year, tagline, country, age, about, genre, producer, img, idTmdb, vote, runtime, originalName}) {

    let update = film.name.toLowerCase() !== name.toLowerCase();
    if (update) return true;

    update = Number(film.year) !== year;
    if (update) return true;

    update = film.tagline.toLowerCase() !== tagline.toLowerCase();
    if (update) return true;

    update = xor(film.country, country).length;
    if (update) return true;

    update = Number(film.age) !== age;
    if (update) return true;

    update = film.about.toLowerCase() !== about.toLowerCase();
    if (update) return true;

    update = xor(film.genre, genre).length;
    if (update) return true;

    update = xor(film.producer, producer).length;
    if (update) return true;

    update = film.img.toLowerCase() !== img.toLowerCase();
    if (update) return true;

    update = Number(film.id_tmdb) !== Number(idTmdb);
    if (update) {
      console.log(Number(film.id_tmdb));
      console.log(idTmdb);
      return true;
    }

    update = Number(film.runtime) !== Number(runtime);
    if (update) return true;

    update = pathExists(film, 'original_name', '').toLowerCase() !== originalName.toLowerCase();
    if (update) return true;

    return false;

  }

}
