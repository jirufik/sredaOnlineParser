import pathExists from 'jrf-path-exists'

export default function processFilm({film, about}) {

  const info = {
    id: pathExists(film, 'id', 0),
    img: pathExists(film, 'poster_path'),
    vote: pathExists(film, 'vote_average', 0),
    runtime: pathExists(film, 'runtime', 0),
    tagline: pathExists(film, 'tagline', ''),
    originalName: pathExists(film, 'original_title', ''),
    about: about || pathExists(film, 'overview', ''),
  };

  const genres = pathExists(film, 'genres', []);
  info.genres = genres.map(el => pathExists(el, 'name'));

  const country = pathExists(film, 'production_countries', []);
  info.country = country.map(el => pathExists(el, 'iso_3166_1'));

  return info;

}
