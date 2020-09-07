export default function isMultCinema(name) {
  return name.trim().toLowerCase().replace(/ /g, '').includes('мультвкино');
}